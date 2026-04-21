#import "NitroFileSystemUtils.h"
#import "../cpp/rust_c_file_system.h"
#import <Foundation/Foundation.h>
#include <fcntl.h>
#include <sys/stat.h>
#include <unistd.h>
#import <UIKit/UIKit.h>
#import <UniformTypeIdentifiers/UniformTypeIdentifiers.h>
#import <objc/runtime.h>
#include <unordered_map>

#import "../nitrogen/generated/shared/c++/PickedFile.hpp"
#import "../nitrogen/generated/shared/c++/PickedDirectory.hpp"

using margelo::nitro::node_fs::PickedFile;
using margelo::nitro::node_fs::PickedDirectory;


static char kNitroFSPickerDelegateKey;

NSURLBookmarkCreationOptions GetNitroBookmarkCreationOptions() {
    NSURLBookmarkCreationOptions opts = 0; // Default for iOS
#if TARGET_OS_OSX || TARGET_OS_MACCATALYST
    opts = (1UL << 11); // NSURLBookmarkCreationWithSecurityScope
#else
    if (@available(iOS 14.0, *)) {
        if ([NSProcessInfo.processInfo respondsToSelector:@selector(isiOSAppOnMac)] && 
            [NSProcessInfo.processInfo isiOSAppOnMac]) {
            opts = (1UL << 11);
        }
    }
#endif
    return opts;
}


#ifndef NSURLBookmarkResolutionWithSecurityScope
  #define NITRO_RESOLUTION_OPTIONS ((1UL << 10) | NSURLBookmarkResolutionWithoutUI)
#else
  #define NITRO_RESOLUTION_OPTIONS (NSURLBookmarkResolutionWithSecurityScope | NSURLBookmarkResolutionWithoutUI)
#endif

@interface NitroFSPickerDelegate : NSObject <UIDocumentPickerDelegate>
@property (nonatomic, assign) BOOL isDirPicker;
@property (nonatomic, assign) BOOL requestLongTermAccess;
@property (nonatomic, assign) std::function<void(const std::vector<PickedFile>&)> resolveFiles;
@property (nonatomic, assign) std::function<void(const PickedDirectory&)> resolveDir;
@property (nonatomic, assign) std::function<void(const std::string&)> reject;
@end

@implementation NitroFSPickerDelegate

static std::string toBookmarkUri(NSData *bookmarkData) {
    if (!bookmarkData) return "";
    NSString *base64 = [bookmarkData base64EncodedStringWithOptions:0];
    // Convert to URL-safe base64
    base64 = [base64 stringByReplacingOccurrencesOfString:@"+" withString:@"-"];
    base64 = [base64 stringByReplacingOccurrencesOfString:@"/" withString:@"_"];
    return "bookmark://" + std::string(base64.UTF8String);
}

- (void)documentPicker:(UIDocumentPickerViewController *)controller didPickDocumentsAtURLs:(NSArray<NSURL *> *)urls {
  if (self.isDirPicker) {
    if (urls.count > 0) {
      PickedDirectory dir;
      dir.path = std::string(urls[0].path.UTF8String ? urls[0].path.UTF8String : "");
      dir.uri = std::string(urls[0].absoluteString.UTF8String ? urls[0].absoluteString.UTF8String : "");
      NSLog(@"[NitroFS] 📂 Picker picked directory: %@", urls[0].path);
      NSLog(@"[NitroFS] 🏷️ requestLongTermAccess: %d", self.requestLongTermAccess);
      
      if (self.requestLongTermAccess) {
        NSURL *targetUrl = [urls[0] URLByStandardizingPath];
        BOOL isSecurityScoped = [targetUrl startAccessingSecurityScopedResource];
        NSLog(@"[NitroFS] 🔓 startAccessingSecurityScopedResource: %d for %@", isSecurityScoped, targetUrl.path);
        
        NSError *error = nil;
        NSData *bookmarkData = [targetUrl bookmarkDataWithOptions:GetNitroBookmarkCreationOptions()
                                 includingResourceValuesForKeys:nil
                                                   relativeToURL:nil
                                                           error:&error];
        if (isSecurityScoped) {
          [targetUrl stopAccessingSecurityScopedResource];
        }
        
        if (error || !bookmarkData) {
          NSLog(@"[NitroFS] ❌ Failed to create dir bookmark: %@", error.localizedDescription);
          if (error) NSLog(@"[NitroFS] ❌ Error Code: %ld", (long)error.code);
        } else {
          NSLog(@"[NitroFS] ✅ Created dir bookmark, size: %lu", (unsigned long)bookmarkData.length);
          dir.bookmark = toBookmarkUri(bookmarkData);
        }
      }
      self.resolveDir(dir);
    } else {
      self.reject("No directory selected");
    }
  } else {
    std::vector<PickedFile> picked;
    for (NSURL *url in urls) {
      PickedFile file;
      file.path = url.path.UTF8String ? url.path.UTF8String : "";
      file.uri = std::string(url.absoluteString.UTF8String ? url.absoluteString.UTF8String : "");
      file.name = url.lastPathComponent.UTF8String ? url.lastPathComponent.UTF8String : "";
      
      if (self.requestLongTermAccess) {
        BOOL isSecurityScoped = [url startAccessingSecurityScopedResource];
        NSError *error = nil;
        NSData *bookmarkData = [url bookmarkDataWithOptions:GetNitroBookmarkCreationOptions() 
                                includingResourceValuesForKeys:nil 
                                                 relativeToURL:nil 
                                                         error:&error];
        if (!error && bookmarkData) {
          file.bookmark = toBookmarkUri(bookmarkData);
        } else {
          NSLog(@"[NitroFS] Failed to create file bookmark: %@", error.localizedDescription);
        }
        if (isSecurityScoped) {
          [url stopAccessingSecurityScopedResource];
        }
      }
      
      NSError *err;
      NSNumber *sizeNum;
      if ([url getResourceValue:&sizeNum forKey:NSURLFileSizeKey error:&err]) {
        file.size = [sizeNum doubleValue];
      } else {
        file.size = 0;
      }
      
      picked.push_back(file);
    }
    self.resolveFiles(picked);
  }
}

- (void)documentPickerWasCancelled:(UIDocumentPickerViewController *)controller {
  self.reject("User cancelled");
}
@end


namespace nitro {
namespace fs {

static NSURL *resolveBookmark(const std::string &base64Str, const std::string &subPath) {
  if (base64Str.empty()) return nil;

  @autoreleasepool {
    NSString *nsBase64 = [NSString stringWithUTF8String:base64Str.c_str()];
    // Handle URL-safe conversion
    nsBase64 = [nsBase64 stringByReplacingOccurrencesOfString:@"-" withString:@"+"];
    nsBase64 = [nsBase64 stringByReplacingOccurrencesOfString:@"_" withString:@"/"];

    NSData *data = [[NSData alloc] initWithBase64EncodedString:nsBase64 options:0];
    if (!data) {
      NSLog(@"[NitroFS] Failed to decode base64 bookmark data. String length: %lu", (unsigned long)base64Str.length());
      return nil;
    }

    NSError *error = nil;
    NSURL *url = [NSURL URLByResolvingBookmarkData:data
                                           options:NITRO_RESOLUTION_OPTIONS
                                     relativeToURL:nil
                               bookmarkDataIsStale:nil
                                             error:&error];
    if (error || !url) {
      return nil;
    }
    return url;
  }
}

static NSURL *urlFromBookmarkUri(const std::string &uri) {
  if (uri.find("bookmark://") != 0) {
    return nil;
  }

  std::string all = uri.substr(11); // Remove "bookmark://"
  
  size_t firstSlash = all.find('/');
  if (firstSlash != std::string::npos) {
    std::string base64Part = all.substr(0, firstSlash);
    std::string subPathPart = all.substr(firstSlash + 1);
    NSURL *url = resolveBookmark(base64Part, "");
    if (url) {
      NSString *nsSubPath = [[NSString stringWithUTF8String:subPathPart.c_str()] stringByRemovingPercentEncoding];
      return [url URLByAppendingPathComponent:nsSubPath];
    }
  }

  // Either no slash or split failed - try as a whole string (Legacy format)
  return resolveBookmark(all, "");
}

static NSURL *urlFromAnyUri(const std::string &uri) {
  if (uri.find("bookmark://") == 0) {
    return urlFromBookmarkUri(uri);
  }
  if (uri.find("file://") == 0) {
    return [NSURL URLWithString:[NSString stringWithUTF8String:uri.c_str()]];
  }
  return [NSURL fileURLWithPath:[NSString stringWithUTF8String:uri.c_str()]];
}

int openBookmark(const std::string &uri, int flags, int mode) {
  @autoreleasepool {
    std::string bookmarkUri = uri;
    if (bookmarkUri.find("bookmark://") != 0) return -1;
    std::string all = bookmarkUri.substr(11);
    
    size_t firstSlash = all.find('/');
    if (firstSlash != std::string::npos) {
      // Has subpath
      std::string base64Part = all.substr(0, firstSlash);
      std::string subPathPart = all.substr(firstSlash + 1);
      
      NSURL *rootUrl = resolveBookmark(base64Part, "");
      if (!rootUrl) return -1;
      
      BOOL success = [rootUrl startAccessingSecurityScopedResource];
      if (!success) {
        NSLog(@"[NitroFS] ⚠️ startAccessingSecurityScopedResource returned NO for root: %@", rootUrl.path);
      }
      NSString *nsSubPath = [[NSString stringWithUTF8String:subPathPart.c_str()] stringByRemovingPercentEncoding];
      NSURL *fileUrl = [rootUrl URLByAppendingPathComponent:nsSubPath];
      
      int fd = open(fileUrl.path.UTF8String, flags, mode);
      if (fd < 0) {
        NSLog(@"[NitroFS] ❌ openBookmark failed for path: %@, error: %s", fileUrl.path, strerror(errno));
      }
      if (success) [rootUrl stopAccessingSecurityScopedResource];
      return fd;
    } else {
      // No subpath
      NSURL *url = resolveBookmark(all, "");
      if (!url) return -1;
      BOOL success = [url startAccessingSecurityScopedResource];
      if (!success) {
        NSLog(@"[NitroFS] ⚠️ startAccessingSecurityScopedResource returned NO for URL: %@", url.path);
      }
      int fd = open(url.path.UTF8String, flags, mode);
      if (fd < 0) {
         NSLog(@"[NitroFS] ❌ openBookmark failed for path: %@, error: %s", url.path, strerror(errno));
      }
      if (success) [url stopAccessingSecurityScopedResource];
      return fd;
    }
  }
}

int unlinkBookmark(const std::string &uri) {
  @autoreleasepool {
    NSURL *url = urlFromBookmarkUri(uri);
    if (!url)
      return -1;

    BOOL success = [url startAccessingSecurityScopedResource];

    NSError *error = nil;
    BOOL deleted = [[NSFileManager defaultManager] removeItemAtURL:url
                                                             error:&error];

    if (success) {
      [url stopAccessingSecurityScopedResource];
    }

    if (!deleted) {
      NSLog(@"[NitroFS] unlinkBookmark failed: %@", error.localizedDescription);
      return -1;
    }
    return 0;
  }
}

int accessBookmark(const std::string &uri, int mode) {
  @autoreleasepool {
    std::string bookmarkUri = uri;
    if (bookmarkUri.find("bookmark://") != 0) return -1;
    std::string all = bookmarkUri.substr(11);
    
    size_t firstSlash = all.find('/');
    if (firstSlash != std::string::npos) {
      // Has subpath
      std::string base64Part = all.substr(0, firstSlash);
      std::string subPathPart = all.substr(firstSlash + 1);
      
      NSURL *rootUrl = resolveBookmark(base64Part, "");
      if (!rootUrl) return -1;
      
      BOOL success = [rootUrl startAccessingSecurityScopedResource];
      NSString *nsSubPath = [[NSString stringWithUTF8String:subPathPart.c_str()] stringByRemovingPercentEncoding];
      NSURL *fileUrl = [rootUrl URLByAppendingPathComponent:nsSubPath];
      
      int res = access(fileUrl.path.UTF8String, mode);
      if (success) [rootUrl stopAccessingSecurityScopedResource];
      return res;
    } else {
      // No subpath
      NSURL *url = resolveBookmark(all, "");
      if (!url) return -1;
      BOOL success = [url startAccessingSecurityScopedResource];
      int res = access(url.path.UTF8String, mode);
      if (success) [url stopAccessingSecurityScopedResource];
      return res;
    }
  }
}

int statBookmark(const std::string &uri, void *statsPtr) {
  @autoreleasepool {
    std::string bookmarkUri = uri;
    if (bookmarkUri.find("bookmark://") != 0) return -1;
    std::string all = bookmarkUri.substr(11);
    
    size_t firstSlash = all.find('/');
    if (firstSlash != std::string::npos) {
      // Has subpath
      std::string base64Part = all.substr(0, firstSlash);
      std::string subPathPart = all.substr(firstSlash + 1);
      
      NSURL *rootUrl = resolveBookmark(base64Part, "");
      if (!rootUrl) return -1;
      
      BOOL success = [rootUrl startAccessingSecurityScopedResource];
      NSString *nsSubPath = [[NSString stringWithUTF8String:subPathPart.c_str()] stringByRemovingPercentEncoding];
      NSURL *fileUrl = [rootUrl URLByAppendingPathComponent:nsSubPath];
      
      int res = rn_fs_stat(fileUrl.path.UTF8String, (RNStats *)statsPtr);
      if (success) [rootUrl stopAccessingSecurityScopedResource];
      return res;
    } else {
      // No subpath
      NSURL *url = resolveBookmark(all, "");
      if (!url) return -1;
      BOOL success = [url startAccessingSecurityScopedResource];
      int res = rn_fs_stat(url.path.UTF8String, (RNStats *)statsPtr);
      if (success) [url stopAccessingSecurityScopedResource];
      return res;
    }
  }
}

int copyBookmark(const std::string &src, const std::string &dest) {
  @autoreleasepool {
    NSURL *srcUrl = urlFromAnyUri(src);
    NSURL *destUrl = urlFromAnyUri(dest);

    if (!srcUrl || !destUrl)
      return -1;

    BOOL srcSuccess = [srcUrl startAccessingSecurityScopedResource];
    BOOL destSuccess = [destUrl startAccessingSecurityScopedResource];

    NSError *error = nil;
    BOOL success = [[NSFileManager defaultManager] copyItemAtURL:srcUrl
                                                           toURL:destUrl
                                                           error:&error];

    if (destSuccess)
      [destUrl stopAccessingSecurityScopedResource];
    if (srcSuccess)
      [srcUrl stopAccessingSecurityScopedResource];

    if (!success) {
      NSLog(@"[NitroFS] copyBookmark error: %@", error.localizedDescription);
      return -1;
    }
    return 0;
  }
}

std::string getBookmark(const std::string &path) {
  @autoreleasepool {
    NSURL *url = urlFromAnyUri(path);
    if (!url)
      return "";

    BOOL isSecurityScoped = [url startAccessingSecurityScopedResource];

    NSError *error = nil;
    NSData *bookmarkData = [url bookmarkDataWithOptions:GetNitroBookmarkCreationOptions()
                         includingResourceValuesForKeys:nil
                                          relativeToURL:nil
                                                  error:&error];

    if (isSecurityScoped) {
      [url stopAccessingSecurityScopedResource];
    }

    if (error || !bookmarkData) {
      NSLog(@"[NitroFS] getBookmark error: %@", error.localizedDescription);
      return "";
    }

    return toBookmarkUri(bookmarkData);
  }
}

std::string resolveBookmarkPath(const std::string &uri) {
  @autoreleasepool {
    NSURL *url = urlFromBookmarkUri(uri);
    if (!url)
      return "";

    return std::string(url.path.UTF8String ?: "");
  }
}

std::string resolveBookmark(const std::string &bookmark) {
  return resolveBookmarkPath(bookmark);
}

/**
 * Resolves a bookmark:// URI and runs an action with the physical path.
 * Handles security scoped resource access automatically.
 */
void withBookmarkPath(const std::string &uri, std::function<void(const std::string &path)> action) {
  @autoreleasepool {
    NSURL *url = urlFromBookmarkUri(uri);
    if (!url)
      return;

    BOOL success = [url startAccessingSecurityScopedResource];
    action(std::string(url.path.UTF8String ?: ""));
    if (success) {
      [url stopAccessingSecurityScopedResource];
    }
  }
}

void* startAccessingBookmark(const std::string &uri, std::string &outPath) {
  @autoreleasepool {
    NSURL *url = urlFromBookmarkUri(uri);
    if (!url) return nullptr;
    BOOL success = [url startAccessingSecurityScopedResource];
    outPath = std::string(url.path.UTF8String ?: "");
    if (success) {
      return (void*)CFBridgingRetain(url);
    } else {
      // If startAccessing failed, it might still have a path (if it's not actually scoped)
      return (void*)CFBridgingRetain(url); 
    }
  }
}

void stopAccessingBookmark(void *token) {
  if (!token) return;
  @autoreleasepool {
    NSURL *url = (NSURL*)CFBridgingRelease(token);
    [url stopAccessingSecurityScopedResource];
  }
}

void pickFilesIOS(bool multiple, bool requestLongTermAccess, margelo::nitro::node_fs::PickerMode mode, const std::vector<std::string>& extensions,
                  std::function<void(const std::vector<margelo::nitro::node_fs::PickedFile>&)> resolve,
                  std::function<void(const std::string&)> reject) {
  NSMutableArray<UTType *> *types = [NSMutableArray array];
  
  if (!extensions.empty()) {
    if (@available(iOS 14.0, *)) {
      for (const auto& ext : extensions) {
        NSString *nsExt = [NSString stringWithUTF8String:ext.c_str()];
        if ([nsExt hasPrefix:@"."]) {
          nsExt = [nsExt substringFromIndex:1];
        }
        UTType *type = [UTType typeWithFilenameExtension:nsExt];
        if (type) {
          [types addObject:type];
        }
      }
    }
  }
  
  if (types.count == 0) {
    if (@available(iOS 14.0, *)) {
      [types addObject:UTTypeContent];
    }
  }
  
  BOOL asCopy = (mode == margelo::nitro::node_fs::PickerMode::IMPORT);
  
  dispatch_async(dispatch_get_main_queue(), ^{
    UIDocumentPickerViewController *picker;
    if (@available(iOS 14.0, *)) {
      picker = [[UIDocumentPickerViewController alloc] initForOpeningContentTypes:types asCopy:asCopy];
    } else {
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
      UIDocumentPickerMode uiMode = asCopy ? UIDocumentPickerModeImport : UIDocumentPickerModeOpen;
      picker = [[UIDocumentPickerViewController alloc] initWithDocumentTypes:@[@"public.content"] inMode:uiMode];
#pragma clang diagnostic pop
    }
    
    picker.allowsMultipleSelection = multiple;
    
    NitroFSPickerDelegate *delegate = [[NitroFSPickerDelegate alloc] init];
    delegate.isDirPicker = NO;
    delegate.requestLongTermAccess = requestLongTermAccess;
    delegate.resolveFiles = resolve;
    delegate.reject = reject;
    
    picker.delegate = delegate;
    objc_setAssociatedObject(picker, &kNitroFSPickerDelegateKey, delegate, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
    
    UIViewController *rootContent = nil;
    if (@available(iOS 13.0, *)) {
      for (UIScene *scene in UIApplication.sharedApplication.connectedScenes) {
        if (scene.activationState == UISceneActivationStateForegroundActive && [scene isKindOfClass:[UIWindowScene class]]) {
          rootContent = ((UIWindowScene *)scene).windows.firstObject.rootViewController;
          break;
        }
      }
    }
    if (!rootContent) {
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
      rootContent = [UIApplication sharedApplication].keyWindow.rootViewController;
#pragma clang diagnostic pop
    }
    while (rootContent.presentedViewController) {
        rootContent = rootContent.presentedViewController;
    }
    [rootContent presentViewController:picker animated:YES completion:nil];
  });
}

void pickDirectoryIOS(bool requestLongTermAccess,
                      std::function<void(const PickedDirectory&)> resolve,
                      std::function<void(const std::string&)> reject) {
  dispatch_async(dispatch_get_main_queue(), ^{
    UIDocumentPickerViewController *picker;
    if (@available(iOS 14.0, *)) {
      picker = [[UIDocumentPickerViewController alloc] initForOpeningContentTypes:@[UTTypeFolder] asCopy:NO];
    } else {
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
      picker = [[UIDocumentPickerViewController alloc] initWithDocumentTypes:@[@"public.folder"] inMode:UIDocumentPickerModeOpen];
#pragma clang diagnostic pop
    }
    
    picker.allowsMultipleSelection = NO;
    
    NitroFSPickerDelegate *delegate = [[NitroFSPickerDelegate alloc] init];
    delegate.isDirPicker = YES;
    delegate.requestLongTermAccess = requestLongTermAccess;
    NSLog(@"[NitroFS] 🚀 pickDirectoryIOS requestLongTermAccess: %d", delegate.requestLongTermAccess);
    delegate.resolveDir = resolve;
    delegate.reject = reject;
    
    picker.delegate = delegate;
    objc_setAssociatedObject(picker, &kNitroFSPickerDelegateKey, delegate, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
    
    UIViewController *rootContent = nil;
    if (@available(iOS 13.0, *)) {
      for (UIScene *scene in UIApplication.sharedApplication.connectedScenes) {
        if (scene.activationState == UISceneActivationStateForegroundActive && [scene isKindOfClass:[UIWindowScene class]]) {
          rootContent = ((UIWindowScene *)scene).windows.firstObject.rootViewController;
          break;
        }
      }
    }
    if (!rootContent) {
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
      rootContent = [UIApplication sharedApplication].keyWindow.rootViewController;
#pragma clang diagnostic pop
    }
    while (rootContent.presentedViewController) {
        rootContent = rootContent.presentedViewController;
    }
    [rootContent presentViewController:picker animated:YES completion:nil];
  });
}

std::string getDirectoryPathIOS(const std::string& type) {
    @autoreleasepool {
        NSString *path = nil;
        if (type == "caches") {
            path = [NSSearchPathForDirectoriesInDomains(NSCachesDirectory, NSUserDomainMask, YES) firstObject];
        } else if (type == "documents") {
            path = [NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES) firstObject];
        } else if (type == "library") {
            path = [NSSearchPathForDirectoriesInDomains(NSLibraryDirectory, NSUserDomainMask, YES) firstObject];
        } else if (type == "pictures") {
            path = [NSSearchPathForDirectoriesInDomains(NSPicturesDirectory, NSUserDomainMask, YES) firstObject];
        } else if (type == "temp") {
            path = NSTemporaryDirectory();
        } else if (type == "mainBundle") {
            path = [[NSBundle mainBundle] bundlePath];
        }
        
        if (!path) return "";
        return std::string(path.UTF8String ?: "");
    }
}

std::unordered_map<std::string, std::string> getFileProtectionKeysIOS() {
    return {
        {"Complete", std::string(NSFileProtectionComplete.UTF8String)},
        {"CompleteUnlessOpen", std::string(NSFileProtectionCompleteUnlessOpen.UTF8String)},
        {"CompleteUntilFirstUserAuthentication", std::string(NSFileProtectionCompleteUntilFirstUserAuthentication.UTF8String)},
        {"None", std::string(NSFileProtectionNone.UTF8String)}
    };
}

} // namespace fs

} // namespace nitro
