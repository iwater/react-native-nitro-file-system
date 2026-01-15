#import "NitroFileSystemUtils.h"
#import "../cpp/rust_c_file_system.h"
#import <Foundation/Foundation.h>
#include <fcntl.h>
#include <sys/stat.h>
#include <unistd.h>

namespace nitro {
namespace fs {

static NSURL *urlFromBookmarkUri(const std::string &uri) {
  if (uri.find("bookmark://") != 0) {
    return nil;
  }

  std::string base64Data = uri.substr(11); // Remove "bookmark://"
  NSString *nsBase64 = [NSString stringWithUTF8String:base64Data.c_str()];
  NSData *bookmarkData = [[NSData alloc] initWithBase64EncodedString:nsBase64
                                                             options:0];

  if (!bookmarkData) {
    return nil;
  }

  BOOL isStale = NO;
  NSError *error = nil;
  NSURL *url =
      [NSURL URLByResolvingBookmarkData:bookmarkData
                                options:NSURLBookmarkResolutionWithoutUI
                          relativeToURL:nil
                    bookmarkDataIsStale:&isStale
                                  error:&error];

  if (error) {
    NSLog(@"[NitroFS] Error resolving bookmark: %@",
          error.localizedDescription);
    return nil;
  }

  return url;
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
    NSURL *url = urlFromBookmarkUri(uri);
    if (!url)
      return -1;

    BOOL success = [url startAccessingSecurityScopedResource];
    int fd = open(url.path.UTF8String, flags, mode);
    if (success) {
      [url stopAccessingSecurityScopedResource];
    }

    return fd;
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
    NSURL *url = urlFromBookmarkUri(uri);
    if (!url)
      return -1;

    BOOL success = [url startAccessingSecurityScopedResource];
    int res = access(url.path.UTF8String, mode);
    if (success) {
      [url stopAccessingSecurityScopedResource];
    }

    return res;
  }
}

int statBookmark(const std::string &uri, void *statsPtr) {
  @autoreleasepool {
    NSURL *url = urlFromBookmarkUri(uri);
    if (!url)
      return -1;

    BOOL success = [url startAccessingSecurityScopedResource];
    int res = rn_fs_stat(url.path.UTF8String, (RNStats *)statsPtr);
    if (success) {
      [url stopAccessingSecurityScopedResource];
    }
    return res;
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
    NSData *bookmarkData = [url bookmarkDataWithOptions:0
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

    NSString *base64 = [bookmarkData base64EncodedStringWithOptions:0];
    return "bookmark://" + std::string(base64.UTF8String);
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

} // namespace fs
} // namespace nitro
