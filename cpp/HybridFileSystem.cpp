#include "HybridFileSystem.hpp"
#include "HybridDirIterator.hpp"
#include "HybridFileWatcher.hpp"
#include "rust_c_file_system.h"
#include <cstdio>
#include <fcntl.h>
#include <iostream>
#include <string>
#include <sys/stat.h>
#include <stdexcept>
#include <exception>

#ifdef __ANDROID__
#include <jni.h>
#include <android/asset_manager.h>
#include <android/asset_manager_jni.h>
namespace margelo::nitro::node_fs {
JNIEnv *getJNIEnv();
}
#endif
#ifdef __APPLE__
#include "../ios/NitroFileSystemUtils.h"
#endif

namespace margelo::nitro::node_fs {

#ifdef __ANDROID__
static AAssetManager* gAssetManager = nullptr;

extern "C" JNIEXPORT void JNICALL
Java_com_margelo_nitro_node_1fs_NitroFileSystemUtils_nSetAssetManager(JNIEnv* env, jclass, jobject assetManager) {
    if (assetManager != nullptr) {
        gAssetManager = AAssetManager_fromJava(env, assetManager);
    }
}

std::string getAndroidDirectoryPath(const std::string& type) {
    // ...
    JNIEnv *env = getJNIEnv();
    if (env) {
        jclass cls = env->FindClass("com/margelo/nitro/node_fs/NitroFileSystemUtils");
        if (cls) {
            jmethodID mid = env->GetStaticMethodID(cls, "getDirectoryPath", "(Ljava/lang/String;)Ljava/lang/String;");
            if (mid) {
                jstring jType = env->NewStringUTF(type.c_str());
                jstring res = (jstring)env->CallStaticObjectMethod(cls, mid, jType);
                env->DeleteLocalRef(jType);
                if (res) {
                    const char *str = env->GetStringUTFChars(res, nullptr);
                    std::string result(str);
                    env->ReleaseStringUTFChars(res, str);
                    env->DeleteLocalRef(res);
                    env->DeleteLocalRef(cls);
                    return result;
                }
            }
            env->DeleteLocalRef(cls);
        }
    }
    return "";
}
#endif

#ifdef __ANDROID__
bool isAssetPath(const std::string& path) {
    return path.compare(0, 8, "asset://") == 0;
}

std::string getAssetPath(const std::string& path) {
    return path.substr(8);
}

std::shared_ptr<ArrayBuffer> readAssetBuffer(const std::string& assetPath) {
    if (gAssetManager == nullptr) {
        throw std::runtime_error("AssetManager not initialized. Did you forget to call NitroFileSystemUtils.initialize()?");
    }
    
    AAsset* asset = AAssetManager_open(gAssetManager, assetPath.c_str(), AASSET_MODE_BUFFER);
    if (!asset) {
        throw std::runtime_error("Could not open asset: " + assetPath);
    }
    
    off_t size = AAsset_getLength(asset);
    if (size <= 0) {
        AAsset_close(asset);
        return ArrayBuffer::allocate(0);
    }

    uint8_t* rawData = new uint8_t[size];
    int readCount = AAsset_read(asset, rawData, size);
    AAsset_close(asset);

    if (readCount < 0) {
        delete[] rawData;
        throw std::runtime_error("Failed to read asset: " + assetPath);
    }
    
    auto buffer = ArrayBuffer::copy(rawData, readCount);
    delete[] rawData;
    return buffer;
}

Stats statAsset(const std::string& assetPath) {
    if (gAssetManager == nullptr) {
         throw std::runtime_error("AssetManager not initialized.");
    }
    AAsset* asset = AAssetManager_open(gAssetManager, assetPath.c_str(), AASSET_MODE_BUFFER);
    if (!asset) {
        // Fallback: check if it's a directory by opening it as a dir
        AAssetDir* dir = AAssetManager_openDir(gAssetManager, assetPath.c_str());
        if (dir) {
            bool hasEntries = AAssetDir_getNextFileName(dir) != nullptr;
            AAssetDir_close(dir);
            if (hasEntries || assetPath.empty() || assetPath == ".") {
                // Return a directory stat
                return Stats(0, 0, S_IFDIR | 0555, 1, 0, 0, 0, 0, 4096, 0, 0, 0, 0, 0);
            }
        }
        throw std::runtime_error("Asset not found: " + assetPath);
    }
    
    off_t size = AAsset_getLength(asset);
    AAsset_close(asset);
    
    // mode: S_IFREG (regular file) | S_IRUSR (read access)
    return Stats(0, 0, S_IFREG | 0444, 1, 0, 0, 0, static_cast<double>(size), 4096, 0, 0, 0, 0, 0);
}

std::vector<std::string> readdirAsset(const std::string& assetPath) {
    if (gAssetManager == nullptr) {
        throw std::runtime_error("AssetManager not initialized.");
    }
    AAssetDir* dir = AAssetManager_openDir(gAssetManager, assetPath.c_str());
    if (!dir) {
        throw std::runtime_error("Could not open asset directory: " + assetPath);
    }
    
    std::vector<std::string> entries;
    while (const char* entryName = AAssetDir_getNextFileName(dir)) {
        entries.push_back(entryName);
    }
    AAssetDir_close(dir);
    return entries;
}
#endif

Stats toStats(const RNStats &s) {
  return Stats(static_cast<double>(s.dev), static_cast<double>(s.ino),
               static_cast<double>(s.mode), static_cast<double>(s.nlink),
               static_cast<double>(s.uid), static_cast<double>(s.gid),
               static_cast<double>(s.rdev), static_cast<double>(s.size),
               static_cast<double>(s.blksize), static_cast<double>(s.blocks),
               s.atime_ms, s.mtime_ms, s.ctime_ms, s.birthtime_ms);
}

double HybridFileSystem::open(const std::string &rawPath, double flags,
                              double mode) {
  std::string path = normalizePath(rawPath);

#ifdef __ANDROID__
  if (path.find("content://") == 0) {
    JNIEnv *env = getJNIEnv();
    if (env) {
      jclass cls =
          env->FindClass("com/margelo/nitro/node_fs/NitroFileSystemUtils");
      if (cls) {
        jmethodID mid = env->GetStaticMethodID(
            cls, "openContentUri", "(Ljava/lang/String;Ljava/lang/String;)I");
        if (mid) {
          jstring jUri = env->NewStringUTF(path.c_str());

          // Map O_ flags to string mode "r", "w", "rw"
          std::string modeStr = "r";
          int flagsInt = static_cast<int>(flags);
          if ((flagsInt & O_RDWR) == O_RDWR) {
            modeStr = "rw";
          } else if ((flagsInt & O_WRONLY) == O_WRONLY) {
            modeStr = "w";
          }
          // Truncate logic is implicit in "w" usually for file streams but for
          // FD/ParcelFileDescriptor "w" or "rw" might not truncate
          // automatically unless specified. Android PFD modes: "r", "w", "wt",
          // "wa", "rw", "rwt". Simplification:
          if ((flagsInt & O_TRUNC) == O_TRUNC &&
              (flagsInt & (O_RDWR | O_WRONLY))) {
            modeStr += "t";
          }

          jstring jMode = env->NewStringUTF(modeStr.c_str());
          int fd = env->CallStaticIntMethod(cls, mid, jUri, jMode);
          if (fd >= 0) {
            rn_fs_import_fd(fd);
          }

          env->DeleteLocalRef(jUri);
          env->DeleteLocalRef(jMode);
          env->DeleteLocalRef(cls);

          if (fd >= 0)
            return static_cast<double>(fd);
        }
      }
    }
    throw std::runtime_error("Failed to open content URI: " + path);
  }
#endif
#ifdef __APPLE__
  if (path.find("bookmark://") == 0) {
    int fd = ::nitro::fs::openBookmark(path, static_cast<int>(flags),
                                       static_cast<int>(mode));
    if (fd >= 0) {
      rn_fs_import_fd(fd);
      return static_cast<double>(fd);
    }
    throw std::runtime_error("Failed to open bookmark URI: " + path);
  }
#endif
  return rn_fs_open(path.c_str(), static_cast<int>(flags),
                    static_cast<int>(mode));
}

void HybridFileSystem::close(double fd) { rn_fs_close(static_cast<int>(fd)); }

double HybridFileSystem::read(double fd,
                              const std::shared_ptr<ArrayBuffer> &buffer,
                              double offset, double length, double position) {
  if (!buffer)
    return -1;

  if (buffer->size() < offset + length) {
    return -1;
  }

  uint8_t *data = buffer->data() + static_cast<size_t>(offset);
  return rn_fs_read(static_cast<int>(fd), data, static_cast<size_t>(length),
                    static_cast<int64_t>(position));
}

double HybridFileSystem::write(double fd,
                               const std::shared_ptr<ArrayBuffer> &buffer,
                               double offset, double length, double position) {
  if (!buffer)
    return -1;

  if (buffer->size() < offset + length) {
    return -1;
  }

  uint8_t *data = buffer->data() + static_cast<size_t>(offset);

  return rn_fs_write(static_cast<int>(fd), data, static_cast<size_t>(length),
                     static_cast<int64_t>(position));
}

void HybridFileSystem::access(const std::string &rawPath, double mode) {
  std::string path = normalizePath(rawPath);

#ifdef __ANDROID__
  if (path.find("content://") == 0) {
    JNIEnv *env = getJNIEnv();
    if (env) {
      jclass cls =
          env->FindClass("com/margelo/nitro/node_fs/NitroFileSystemUtils");
      jmethodID mid = env->GetStaticMethodID(cls, "existsContentUri",
                                             "(Ljava/lang/String;)Z");
      if (mid) {
        jstring jUri = env->NewStringUTF(path.c_str());
        bool exists = env->CallStaticBooleanMethod(cls, mid, jUri);
        env->DeleteLocalRef(jUri);
        env->DeleteLocalRef(cls);
        if (exists)
          return;
      }
    }
    throw std::runtime_error("access failed: " + path);
  }
#endif
#ifdef __APPLE__
  if (path.find("bookmark://") == 0) {
    if (::nitro::fs::accessBookmark(path, static_cast<int>(mode)) == 0) {
      return;
    }
    throw std::runtime_error("access failed: " + path);
  }
#endif
  if (rn_fs_access(path.c_str(), static_cast<int>(mode)) != 0) {
    throw std::runtime_error("access failed: " + path);
  }
}

void HybridFileSystem::truncate(const std::string &rawPath, double len) {
  std::string path = normalizePath(rawPath);
  if (rn_fs_truncate(path.c_str(), static_cast<size_t>(len)) != 0) {
    throw std::runtime_error("truncate failed: " + path);
  }
}

void HybridFileSystem::ftruncate(double fd, double len) {
  if (rn_fs_ftruncate(static_cast<int>(fd), static_cast<size_t>(len)) != 0) {
    throw std::runtime_error("ftruncate failed");
  }
}

void HybridFileSystem::fsync(double fd) {
  if (rn_fs_fsync(static_cast<int>(fd)) != 0) {
    throw std::runtime_error("fsync failed");
  }
}

void HybridFileSystem::chmod(const std::string &rawPath, double mode) {
  std::string path = normalizePath(rawPath);
  if (rn_fs_chmod(path.c_str(), static_cast<int>(mode)) != 0) {
    throw std::runtime_error("chmod failed: " + path);
  }
}

void HybridFileSystem::lchmod(const std::string &rawPath, double mode) {
  std::string path = normalizePath(rawPath);
  if (rn_fs_lchmod(path.c_str(), static_cast<uint32_t>(mode)) != 0) {
    throw std::runtime_error("lchmod failed: " + path);
  }
}

void HybridFileSystem::fchmod(double fd, double mode) {
  if (rn_fs_fchmod(static_cast<int>(fd), static_cast<int>(mode)) != 0) {
    throw std::runtime_error("fchmod failed");
  }
}

void HybridFileSystem::chown(const std::string &rawPath, double uid, double gid) {
  std::string path = normalizePath(rawPath);
  if (rn_fs_chown(path.c_str(), static_cast<int>(uid), static_cast<int>(gid)) !=
      0) {
    throw std::runtime_error("chown failed: " + path);
  }
}

void HybridFileSystem::lchown(const std::string &rawPath, double uid, double gid) {
  std::string path = normalizePath(rawPath);
  if (rn_fs_lchown(path.c_str(), static_cast<uint32_t>(uid),
                   static_cast<uint32_t>(gid)) != 0) {
    throw std::runtime_error("lchown failed: " + path);
  }
}

void HybridFileSystem::fchown(double fd, double uid, double gid) {
  if (rn_fs_fchown(static_cast<int>(fd), static_cast<int>(uid),
                   static_cast<int>(gid)) != 0) {
    throw std::runtime_error("fchown failed");
  }
}

void HybridFileSystem::utimes(const std::string &rawPath, double atime,
                              double mtime) {
  std::string path = normalizePath(rawPath);
  if (rn_fs_utimes(path.c_str(), atime, mtime) != 0) {

    throw std::runtime_error("utimes failed: " + path);
  }
}

void HybridFileSystem::lutimes(const std::string &rawPath, double atime,
                               double mtime) {
  std::string path = normalizePath(rawPath);
  if (rn_fs_lutimes(path.c_str(), static_cast<int64_t>(atime),
                    static_cast<int64_t>(mtime)) != 0) {
    throw std::runtime_error("lutimes failed: " + path);
  }
}

void HybridFileSystem::futimes(double fd, double atime, double mtime) {
  if (rn_fs_futimes(static_cast<int>(fd), atime, mtime) != 0) {
    throw std::runtime_error("futimes failed");
  }
}

void HybridFileSystem::link(const std::string &rawExistingPath,
                            const std::string &rawNewPath) {
  std::string existingPath = normalizePath(rawExistingPath);
  std::string newPath = normalizePath(rawNewPath);
  if (rn_fs_link(existingPath.c_str(), newPath.c_str()) != 0) {

    throw std::runtime_error("link failed: " + existingPath + " -> " + newPath);
  }
}

void HybridFileSystem::symlink(const std::string &rawTarget,
                               const std::string &rawPath) {
  std::string target = normalizePath(rawTarget);
  std::string path = normalizePath(rawPath);
  if (rn_fs_symlink(target.c_str(), path.c_str()) != 0) {
    throw std::runtime_error("symlink failed: " + target + " -> " + path);
  }
}

std::string HybridFileSystem::readlink(const std::string &rawPath) {
  std::string path = normalizePath(rawPath);
  char *res = rn_fs_readlink(path.c_str());

  if (res == nullptr) {
    throw std::runtime_error("readlink failed: " + path);
  }
  std::string result(res);
  rn_fs_free_string(res);
  return result;
}

std::string HybridFileSystem::realpath(const std::string &rawPath) {
  std::string path = normalizePath(rawPath);

#ifdef __ANDROID__
  if (path.find("content://") == 0) {
    return path;
  }
#endif
#ifdef __APPLE__
  if (path.find("bookmark://") == 0) {
    std::string resolved = ::nitro::fs::resolveBookmarkPath(path);
    return resolved.empty() ? path : resolved;
  }
#endif
  char *res = rn_fs_realpath(path.c_str());
  if (res == nullptr) {
    throw std::runtime_error("realpath failed: " + path);
  }
  std::string result(res);
  rn_fs_free_string(res);
  return result;
}

std::string HybridFileSystem::mkdtemp(const std::string &prefix) {
  char *res = rn_fs_mkdtemp(prefix.c_str());
  if (res == nullptr) {
    throw std::runtime_error("mkdtemp failed");
  }
  std::string result(res);
  rn_fs_free_string(res);
  return result;
}

void HybridFileSystem::rm(const std::string &rawPath, bool recursive) {
  std::string path = normalizePath(rawPath);

#ifdef __ANDROID__
  if (path.find("content://") == 0) {
    this->unlink(path);
    return;
  }
#endif
#ifdef __APPLE__
  if (path.find("bookmark://") == 0) {
    this->unlink(path);
    return;
  }
#endif
  int res = rn_fs_rm(path.c_str(), recursive);
  if (res != 0) {
    // TODO: better error message based on errno?
    throw std::runtime_error("rm failed");
  }
}

Stats HybridFileSystem::stat(const std::string &rawPath) {
  std::string path = normalizePath(rawPath);

#ifdef __ANDROID__
  if (isAssetPath(path)) {
    return statAsset(getAssetPath(path));
  }

  if (path.find("content://") == 0) {
    JNIEnv *env = getJNIEnv();
    if (env) {
      jclass cls =
          env->FindClass("com/margelo/nitro/node_fs/NitroFileSystemUtils");
      if (cls) {
        jmethodID mid = env->GetStaticMethodID(cls, "getStatContentUri",
                                               "(Ljava/lang/String;)[D");
        if (mid) {
          jstring jUri = env->NewStringUTF(path.c_str());
          jdoubleArray res =
              (jdoubleArray)env->CallStaticObjectMethod(cls, mid, jUri);

          env->DeleteLocalRef(jUri);
          env->DeleteLocalRef(cls);

          if (res) {
            jdouble *statsData = env->GetDoubleArrayElements(res, nullptr);
            double size = statsData[0];
            double mtime = statsData[1];
            env->ReleaseDoubleArrayElements(res, statsData, JNI_ABORT);
            env->DeleteLocalRef(res);

            RNStats s = {0};
            s.size = static_cast<uint64_t>(size);
            s.mtime_ms = mtime;
            // Dummy values for others
            s.mode = S_IFREG | 0444; // file, read-only assumption as fallback
            return toStats(s);
          }
        }
      }
    }
    throw std::runtime_error("Failed to stat content URI: " + path);
  }
#endif
#ifdef __APPLE__
  if (path.find("bookmark://") == 0) {
    RNStats s = {0};
    if (::nitro::fs::statBookmark(path, &s) == 0) {
      return toStats(s);
    }
    throw std::runtime_error("Failed to stat bookmark URI: " + path);
  }
#endif
  RNStats s;
  if (rn_fs_stat(path.c_str(), &s) == 0) {
    return toStats(s);
  }
  // Throw error or return empty? Nitro methods can throw exceptions.
  throw std::runtime_error("stat failed: " + path);
}

Stats HybridFileSystem::lstat(const std::string &rawPath) {
  std::string path = normalizePath(rawPath);

#ifdef __ANDROID__
  if (path.find("content://") == 0) {
    // For content URIs, lstat is equivalent to stat
    return stat(path);
  }
#endif
#ifdef __APPLE__
  if (path.find("bookmark://") == 0) {
    // For bookmarks, lstat is equivalent to stat (resolves automatically)
    return stat(path);
  }
#endif
  RNStats s;
  if (rn_fs_lstat(path.c_str(), &s) == 0) {
    return toStats(s);
  }
  throw std::runtime_error("lstat failed: " + path);
}

Stats HybridFileSystem::fstat(double fd) {
  RNStats s;
  if (rn_fs_fstat(static_cast<int>(fd), &s) == 0) {
    return toStats(s);
  }
  throw std::runtime_error("fstat failed");
}

void HybridFileSystem::mkdir(const std::string &rawPath, double mode,
                             bool recursive) {
  std::string path = normalizePath(rawPath);
  if (!rn_fs_mkdir(path.c_str(), static_cast<uint32_t>(mode), recursive)) {
    throw std::runtime_error("mkdir failed: " + path);
  }
}

void HybridFileSystem::rmdir(const std::string &rawPath) {
  std::string path = normalizePath(rawPath);
  if (rn_fs_rmdir(path.c_str()) != 0) {
    throw std::runtime_error("rmdir failed: " + path);
  }
}

std::vector<std::string> HybridFileSystem::readdir(const std::string &rawPath) {
  std::string path = normalizePath(rawPath);
  std::vector<std::string> results;

#ifdef __APPLE__
  if (path.find("bookmark://") == 0) {
    bool success = false;
    ::nitro::fs::withBookmarkPath(path, [&](const std::string &resolvedPath) {
      DirIter *iter = rn_fs_readdir_open(resolvedPath.c_str());
      if (iter) {
        success = true;
        char *name;
        while ((name = rn_fs_readdir_next(iter)) != nullptr) {
          results.push_back(std::string(name));
          rn_fs_free_string(name);
        }
        rn_fs_readdir_close(iter);
      }
    });
    if (success) {
      return results;
    }
    throw std::runtime_error("readdir failed (open): " + path);
  }
#endif
#ifdef __ANDROID__
  if (isAssetPath(path)) {
    return readdirAsset(getAssetPath(path));
  }
  if (path.find("content://") == 0) {
    JNIEnv *env = getJNIEnv();
    if (env) {
      jclass cls = env->FindClass("com/margelo/nitro/node_fs/NitroFileSystemUtils");
      jmethodID mid = env->GetStaticMethodID(cls, "listContentUri", "(Ljava/lang/String;)[Ljava/lang/String;");
      if (mid) {
        jstring jUri = env->NewStringUTF(path.c_str());
        jobjectArray jArr = (jobjectArray)env->CallStaticObjectMethod(cls, mid, jUri);
        env->DeleteLocalRef(jUri);
        if (jArr) {
          int len = env->GetArrayLength(jArr);
          for (int i = 0; i < len; i++) {
            jstring js = (jstring)env->GetObjectArrayElement(jArr, i);
            const char *str = env->GetStringUTFChars(js, nullptr);
            results.push_back(std::string(str));
            env->ReleaseStringUTFChars(js, str);
            env->DeleteLocalRef(js);
          }
          env->DeleteLocalRef(jArr);
          return results;
        }
      }
    }
  }
#endif

  DirIter *iter = rn_fs_readdir_open(path.c_str());
  if (!iter) {
    throw std::runtime_error("readdir failed (open): " + path);
  }

  char *name;
  while ((name = rn_fs_readdir_next(iter)) != nullptr) {
    results.push_back(std::string(name));
    rn_fs_free_string(name);
  }

  rn_fs_readdir_close(iter);
  return results;
}

void HybridFileSystem::unlink(const std::string &rawPath) {
  std::string path = normalizePath(rawPath);

#ifdef __ANDROID__
  if (path.find("content://") == 0) {
    JNIEnv *env = getJNIEnv();
    if (env) {
      jclass cls =
          env->FindClass("com/margelo/nitro/node_fs/NitroFileSystemUtils");
      jmethodID mid = env->GetStaticMethodID(cls, "deleteContentUri",
                                             "(Ljava/lang/String;)Z");
      if (mid) {
        jstring jUri = env->NewStringUTF(path.c_str());
        bool deleted = env->CallStaticBooleanMethod(cls, mid, jUri);
        env->DeleteLocalRef(jUri);
        env->DeleteLocalRef(cls);
        if (deleted)
          return;
      }
    }
    throw std::runtime_error("unlink failed: " + path);
  }
#endif
#ifdef __APPLE__
  if (path.find("bookmark://") == 0) {
    if (::nitro::fs::unlinkBookmark(path) == 0) {
      return;
    }
    throw std::runtime_error("unlink failed: " + path);
  }
#endif
  if (rn_fs_unlink(path.c_str()) != 0) {
    throw std::runtime_error("unlink failed: " + path);
  }
}

void HybridFileSystem::rename(const std::string &rawOldPath,
                               const std::string &rawNewPath) {
  std::string oldPath = normalizePath(rawOldPath);
  std::string newPath = normalizePath(rawNewPath);
  if (rn_fs_rename(oldPath.c_str(), newPath.c_str()) != 0) {
    throw std::runtime_error("rename failed");
  }
}

void HybridFileSystem::copyFile(const std::string &rawSrc, const std::string &rawDest,
                                double flags) {
  std::string src = normalizePath(rawSrc);
  std::string dest = normalizePath(rawDest);

#ifdef __ANDROID__
  if (isAssetPath(src)) {
    auto buffer = readAssetBuffer(getAssetPath(src));
    this->writeFile(rawDest, buffer);
    return;
  }
  if (src.find("content://") == 0 || dest.find("content://") == 0) {
    JNIEnv *env = getJNIEnv();
    if (env == nullptr) {
      throw std::runtime_error("Failed to get JNIEnv for copyFile");
    }

    jclass utilsClass =
        env->FindClass("com/margelo/nitro/node_fs/NitroFileSystemUtils");
    jmethodID copyMethod =
        env->GetStaticMethodID(utilsClass, "copyContentUri",
                               "(Ljava/lang/String;Ljava/lang/String;)Z");

    jstring jSrc = env->NewStringUTF(src.c_str());
    jstring jDest = env->NewStringUTF(dest.c_str());

    jboolean success =
        env->CallStaticBooleanMethod(utilsClass, copyMethod, jSrc, jDest);

    env->DeleteLocalRef(jSrc);
    env->DeleteLocalRef(jDest);
    env->DeleteLocalRef(utilsClass);

    if (!success) {
      throw std::runtime_error("copyFile (content://) failed via JNI helper");
    }
    return;
  }
#endif
#ifdef __APPLE__
  if (src.find("bookmark://") == 0 || dest.find("bookmark://") == 0) {
    if (::nitro::fs::copyBookmark(src, dest) == 0) {
      return;
    }
    throw std::runtime_error("copyFile (bookmark://) failed");
  }
#endif
  if (rn_fs_copy_file(src.c_str(), dest.c_str(), static_cast<int>(flags)) !=
      0) {
    throw std::runtime_error("copyFile failed");
  }
}

std::shared_ptr<ArrayBuffer>
HybridFileSystem::readFile(const std::string &rawPath) {
  std::string path = normalizePath(rawPath);

#ifdef __ANDROID__
  if (isAssetPath(path)) {
    return readAssetBuffer(getAssetPath(path));
  }

  if (path.find("content://") == 0) {
    // 1. Open
    double fd = this->open(path, O_RDONLY, 0);
    // 2. Stat size
    RNStats stats;
    if (rn_fs_fstat(static_cast<int>(fd), &stats) != 0) {
      this->close(fd);
      throw std::runtime_error("readFile(content://) fstat failed");
    }
    size_t len = static_cast<size_t>(stats.size);

    // 3. Allocate buffer
    // We can't use ArrayBuffer::copy directly from nullptr.
    // We need to alloc temp buffer then copy?
    // Or ArrayBuffer::wrap if we have a way to alloc via it?
    // Nitro's ArrayBuffer likely copies data.
    // Let's allocate raw, read, then wrap.
    uint8_t *rawData = new uint8_t[len];

    // 4. Read
    // Loop to ensure full read? ContentResolver streams usually support atomic
    // read but loop is safer.
    size_t totalRead = 0;
    while (totalRead < len) {
      int64_t r = rn_fs_read(static_cast<int>(fd), rawData + totalRead,
                         len - totalRead, -1); // -1 for current pos
      if (r < 0) {
        delete[] rawData;
        this->close(fd);
        throw std::runtime_error("readFile(content://) read failed");
      }
      if (r == 0)
        break; // EOF
      totalRead += r;
    }

    // 5. Close
    this->close(fd);

    // 6. Wrap/Copy
    // Nitro ArrayBuffer might take ownership or copy.
    // ArrayBuffer::copy takes (data, len) and makes a copy.
    auto buffer = ArrayBuffer::copy(rawData, totalRead);
    delete[] rawData;
    return buffer;
  }
#endif
#ifdef __APPLE__
  if (path.find("bookmark://") == 0) {
    auto fd = this->open(path, O_RDONLY, 0);
    RNStats stats;
    if (rn_fs_fstat(static_cast<int>(fd), &stats) != 0) {
      this->close(fd);
      throw std::runtime_error("readFile(bookmark://) fstat failed");
    }
    size_t len = static_cast<size_t>(stats.size);
    uint8_t *rawData = new uint8_t[len];
    size_t totalRead = 0;
    while (totalRead < len) {
      int64_t r = rn_fs_read(static_cast<int>(fd), rawData + totalRead,
                         len - totalRead, -1);
      if (r < 0) {
        delete[] rawData;
        this->close(fd);
        throw std::runtime_error("readFile(bookmark://) read failed");
      }
      if (r == 0)
        break;
      totalRead += r;
    }
    this->close(fd);
    auto buffer = ArrayBuffer::copy(rawData, totalRead);
    delete[] rawData;
    return buffer;
  }
#endif

  size_t len = 0;
  uint8_t *data = rn_fs_read_file(path.c_str(), &len);
  if (!data) {
    throw std::runtime_error("readFile failed: " + path);
  }

  auto buffer = ArrayBuffer::copy(data, len);
  rn_fs_read_file_free(data, len);
  return buffer;
}

void HybridFileSystem::writeFile(const std::string &rawPath,
                                 const std::shared_ptr<ArrayBuffer> &buffer) {
  std::string path = normalizePath(rawPath);
  if (!buffer) {
    throw std::runtime_error("buffer is null");
  }
#ifdef __ANDROID__
  if (path.find("content://") == 0) {
    // 1. Open (write mode)
    double fd = this->open(path, O_WRONLY | O_CREAT | O_TRUNC, 0666);
    // 2. Write
    int64_t r =
        rn_fs_write(static_cast<int>(fd), buffer->data(), buffer->size(), -1);
    // 3. Close
    this->close(fd);

    if (r < 0) {
      throw std::runtime_error("writeFile(content://) failed");
    }
    return;
  }
#endif
#ifdef __APPLE__
  if (path.find("bookmark://") == 0) {
    auto fd = this->open(path, O_WRONLY | O_CREAT | O_TRUNC, 0666);
    int64_t r =
        rn_fs_write(static_cast<int>(fd), buffer->data(), buffer->size(), -1);
    this->close(fd);
    if (r < 0) {
      throw std::runtime_error("writeFile(bookmark://) failed");
    }
    return;
  }
#endif
  if (rn_fs_write_file(path.c_str(), buffer->data(), buffer->size()) != 0) {
    throw std::runtime_error("writeFile failed: " + path);
  }
}

std::string HybridFileSystem::getBookmark(const std::string &rawPath) {
  std::string path = normalizePath(rawPath);
#ifdef __APPLE__
  return ::nitro::fs::getBookmark(path);
#endif
  throw std::runtime_error("getBookmark is only supported on iOS");
}

std::string HybridFileSystem::resolveBookmark(const std::string &bookmark) {
#ifdef __APPLE__
  return ::nitro::fs::resolveBookmark(bookmark);
#endif
  throw std::runtime_error("resolveBookmark is only supported on iOS");
}

std::string HybridFileSystem::getTempPath() {
  char *path = rn_fs_get_temp_dir();
  if (path == nullptr) {
    throw std::runtime_error("getTempPath failed");
  }
  std::string result(path);
  rn_fs_free_string(path);
  return result;
}

std::string HybridFileSystem::getCachesDirectoryPath() {
#ifdef __ANDROID__
  return getAndroidDirectoryPath("caches");
#elif defined(__APPLE__)
  return ::nitro::fs::getDirectoryPathIOS("caches");
#else
  return "";
#endif
}

std::string HybridFileSystem::getDocumentDirectoryPath() {
#ifdef __ANDROID__
  return getAndroidDirectoryPath("documents");
#elif defined(__APPLE__)
  return ::nitro::fs::getDirectoryPathIOS("documents");
#else
  return "";
#endif
}

std::string HybridFileSystem::getDownloadDirectoryPath() {
#ifdef __ANDROID__
  return getAndroidDirectoryPath("downloads");
#elif defined(__APPLE__)
  return ::nitro::fs::getDirectoryPathIOS("documents");
#else
  return "";
#endif
}

std::string HybridFileSystem::getExternalCachesDirectoryPath() {
#ifdef __ANDROID__
  return getAndroidDirectoryPath("externalCaches");
#else
  return "";
#endif
}

std::string HybridFileSystem::getExternalDirectoryPath() {
#ifdef __ANDROID__
  return getAndroidDirectoryPath("externalDocuments");
#else
  return "";
#endif
}

std::string HybridFileSystem::getExternalStorageDirectoryPath() {
#ifdef __ANDROID__
  return getAndroidDirectoryPath("externalStorage");
#else
  return "";
#endif
}

std::string HybridFileSystem::getLibraryDirectoryPath() {
#ifdef __APPLE__
  return ::nitro::fs::getDirectoryPathIOS("library");
#else
  return "";
#endif
}

std::string HybridFileSystem::getMainBundlePath() {
#ifdef __ANDROID__
  return getAndroidDirectoryPath("mainBundle");
#elif defined(__APPLE__)
  return ::nitro::fs::getDirectoryPathIOS("mainBundle");
#else
  return "";
#endif
}

std::string HybridFileSystem::getPicturesDirectoryPath() {
#ifdef __ANDROID__
  return getAndroidDirectoryPath("pictures");
#elif defined(__APPLE__)
  return ::nitro::fs::getDirectoryPathIOS("pictures");
#else
  return "";
#endif
}

std::string HybridFileSystem::getTemporaryDirectoryPath() {
#ifdef __ANDROID__
  return getAndroidDirectoryPath("temp");
#elif defined(__APPLE__)
  return ::nitro::fs::getDirectoryPathIOS("temp");
#else
  return "";
#endif
}

std::unordered_map<std::string, std::string> HybridFileSystem::getFileProtectionKeys() {
#ifdef __APPLE__
  return ::nitro::fs::getFileProtectionKeysIOS();
#else
  return {};
#endif
}

std::shared_ptr<HybridHybridDirIteratorSpec>
HybridFileSystem::opendir(const std::string &rawPath) {
  std::string path = normalizePath(rawPath);

#ifdef __APPLE__
  if (path.find("bookmark://") == 0) {
    std::string resolvedPath;
    void* token = ::nitro::fs::startAccessingBookmark(path, resolvedPath);
    if (token) {
        DirIter *iter = rn_fs_readdir_open(resolvedPath.c_str());
        if (iter) {
            return std::make_shared<HybridDirIterator>(iter, [token]() {
                ::nitro::fs::stopAccessingBookmark(token);
            });
        }
        ::nitro::fs::stopAccessingBookmark(token);
    }
    throw std::runtime_error("opendir failed (bookmark): " + path);
  }
#endif

  DirIter *iter = rn_fs_readdir_open(path.c_str());
  if (!iter) {
    throw std::runtime_error("opendir failed: " + path);
  }
  return std::make_shared<HybridDirIterator>(iter);
}

std::shared_ptr<HybridHybridFileWatcherSpec> HybridFileSystem::watch(
    const std::string &rawPath,
    const std::function<void(const std::string &, const std::string &)>
        &onChange) {
  std::string path = normalizePath(rawPath);
  return std::make_shared<HybridFileWatcher>(path, onChange);
}

std::string HybridFileSystem::normalizePath(const std::string &path) {
  if (path.find("file://") == 0) {
    return path.substr(7);
  } else if (path.find("file:/") == 0) {
    return path.substr(5);
  } else if (path.find("asset://") == 0) {
#ifdef __APPLE__
    std::string relPath = path.substr(8);
    std::string bundlePath = this->getMainBundlePath();
    if (relPath.empty() || relPath == "/")
      return bundlePath;
    if (relPath[0] == '/')
      return bundlePath + relPath;
    return bundlePath + "/" + relPath;
#endif
  }
  return path;
}


double HybridFileSystem::readv(
    double fd, const std::vector<std::shared_ptr<ArrayBuffer>> &buffers,
    double position) {
  if (buffers.empty()) {
    return 0;
  }

  // Build iovec array
  std::vector<RNIovec> iovecs;
  iovecs.reserve(buffers.size());

  for (const auto &buf : buffers) {
    if (buf) {
      RNIovec iov;
      iov.base = buf->data();
      iov.len = buf->size();
      iovecs.push_back(iov);
    }
  }

  if (iovecs.empty()) {
    return 0;
  }

  intptr_t result = rn_fs_readv(static_cast<int>(fd), iovecs.data(),
                                static_cast<int>(iovecs.size()),
                                static_cast<int64_t>(position));

  if (result < 0) {
    throw std::runtime_error("readv failed");
  }

  return static_cast<double>(result);
}

double HybridFileSystem::writev(
    double fd, const std::vector<std::shared_ptr<ArrayBuffer>> &buffers,
    double position) {
  if (buffers.empty()) {
    return 0;
  }

  // Build iovec array
  std::vector<RNIovec> iovecs;
  iovecs.reserve(buffers.size());

  for (const auto &buf : buffers) {
    if (buf) {
      RNIovec iov;
      iov.base = buf->data();
      iov.len = buf->size();
      iovecs.push_back(iov);
    }
  }

  if (iovecs.empty()) {
    return 0;
  }

  intptr_t result = rn_fs_writev(static_cast<int>(fd), iovecs.data(),
                                 static_cast<int>(iovecs.size()),
                                 static_cast<int64_t>(position));

  if (result < 0) {
    throw std::runtime_error("writev failed");
  }

  return static_cast<double>(result);
}

std::shared_ptr<Promise<std::vector<PickedFile>>> HybridFileSystem::pickFiles(const FilePickerOptions& options) {
  auto promise = Promise<std::vector<PickedFile>>::create();
#ifdef __APPLE__
  bool multiple = options.multiple.value_or(false);
  bool requestLongTermAccess = options.requestLongTermAccess.value_or(false);
  std::vector<std::string> extensions = options.extensions.value_or(std::vector<std::string>());
  margelo::nitro::node_fs::PickerMode mode = options.mode.value_or(margelo::nitro::node_fs::PickerMode::OPEN);

  ::nitro::fs::pickFilesIOS(multiple, requestLongTermAccess, mode, extensions, 
    [promise](const std::vector<margelo::nitro::node_fs::PickedFile>& files) {
      promise->resolve(files);
    },
    [promise](const std::string& error) {
      promise->reject(std::make_exception_ptr(std::runtime_error(error)));
    }
  );
#elif defined(__ANDROID__)
  JNIEnv *env = getJNIEnv();
  if (env) {
    jclass cls = env->FindClass("com/margelo/nitro/node_fs/NitroFileSystemUtils");
    if (cls) {
      jmethodID mid = env->GetStaticMethodID(cls, "pickFiles", "(Z[Ljava/lang/String;ZLjava/lang/String;J)V");
      if (mid) {
        bool multiple = options.multiple.value_or(false);
        bool requestLongTermAccess = options.requestLongTermAccess.value_or(false);
        margelo::nitro::node_fs::PickerMode mode = options.mode.value_or(margelo::nitro::node_fs::PickerMode::OPEN);
        std::string modeStr = (mode == margelo::nitro::node_fs::PickerMode::IMPORT) ? "import" : "open";
        
        jobjectArray extensionsArray = nullptr;
        if (options.extensions.has_value()) {
          auto extVec = options.extensions.value();
          jclass stringCls = env->FindClass("java/lang/String");
          extensionsArray = env->NewObjectArray(extVec.size(), stringCls, nullptr);
          for (size_t i = 0; i < extVec.size(); i++) {
            jstring extStr = env->NewStringUTF(extVec[i].c_str());
            env->SetObjectArrayElement(extensionsArray, i, extStr);
            env->DeleteLocalRef(extStr);
          }
          env->DeleteLocalRef(stringCls);
        }

        auto* ptr = new std::shared_ptr<Promise<std::vector<PickedFile>>>(promise);
        jlong promisePtr = reinterpret_cast<jlong>(ptr);
        jstring jMode = env->NewStringUTF(modeStr.c_str());

        env->CallStaticVoidMethod(cls, mid, multiple, extensionsArray, requestLongTermAccess, jMode, promisePtr);

        if (extensionsArray) {
          env->DeleteLocalRef(extensionsArray);
        }
        env->DeleteLocalRef(jMode);
        env->DeleteLocalRef(cls);
        return promise;
      }
    }
  }
  promise->reject(std::make_exception_ptr(std::runtime_error("Failed to call JNI pickFiles")));
#else
  promise->reject(std::make_exception_ptr(std::runtime_error("Not implemented on this platform")));
#endif
  return promise;
}

std::shared_ptr<Promise<PickedDirectory>> HybridFileSystem::pickDirectory(const std::optional<DirectoryPickerOptions>& options) {
  auto promise = Promise<PickedDirectory>::create();
#ifdef __APPLE__
  bool requestLongTermAccess = options.has_value() && options->requestLongTermAccess.has_value() ? options->requestLongTermAccess.value() : false;
  ::nitro::fs::pickDirectoryIOS(requestLongTermAccess, 
    [promise](const PickedDirectory& dir) {
      promise->resolve(dir);
    },
    [promise](const std::string& error) {
      promise->reject(std::make_exception_ptr(std::runtime_error(error)));
    }
  );
#elif defined(__ANDROID__)
  JNIEnv *env = getJNIEnv();
  if (env) {
    jclass cls = env->FindClass("com/margelo/nitro/node_fs/NitroFileSystemUtils");
    if (cls) {
      jmethodID mid = env->GetStaticMethodID(cls, "pickDirectory", "(ZJ)V");
      if (mid) {
        bool requestLongTermAccess = options.has_value() && options->requestLongTermAccess.has_value() && options->requestLongTermAccess.value();
        auto* ptr = new std::shared_ptr<Promise<PickedDirectory>>(promise);
        jlong promisePtr = reinterpret_cast<jlong>(ptr);

        env->CallStaticVoidMethod(cls, mid, requestLongTermAccess, promisePtr);
        env->DeleteLocalRef(cls);
        return promise;
      }
    }
  }
  promise->reject(std::make_exception_ptr(std::runtime_error("Failed to call JNI pickDirectory")));
#else
  promise->reject(std::make_exception_ptr(std::runtime_error("Not implemented on this platform")));
#endif
  return promise;
}

#ifdef __ANDROID__
extern "C" JNIEXPORT void JNICALL Java_com_margelo_nitro_node_1fs_NitroFileSystemUtils_nativeOnFilesPicked(
    JNIEnv *env, jclass clazz, jlong promisePtr, jobjectArray results) {
  auto ptr = reinterpret_cast<std::shared_ptr<Promise<std::vector<PickedFile>>>*>(promisePtr);
  if (!ptr) return;
  auto promise = *ptr;
  delete ptr;

  std::vector<PickedFile> files;
  if (results != nullptr) {
    jclass resultCls = env->FindClass("com/margelo/nitro/node_fs/NitroFileSystemUtils$PickerResult");
    jfieldID pathField = env->GetFieldID(resultCls, "path", "Ljava/lang/String;");
    jfieldID uriField = env->GetFieldID(resultCls, "uri", "Ljava/lang/String;");
    jfieldID nameField = env->GetFieldID(resultCls, "name", "Ljava/lang/String;");
    jfieldID sizeField = env->GetFieldID(resultCls, "size", "D");
    jfieldID typeField = env->GetFieldID(resultCls, "type", "Ljava/lang/String;");
    jfieldID bookmarkField = env->GetFieldID(resultCls, "bookmark", "Ljava/lang/String;");

    jsize length = env->GetArrayLength(results);
    for (jsize i = 0; i < length; i++) {
      jobject resObj = env->GetObjectArrayElement(results, i);
      if (resObj) {
        PickedFile file;
        jstring jPath = (jstring)env->GetObjectField(resObj, pathField);
        if (jPath) {
          const char* str = env->GetStringUTFChars(jPath, nullptr);
          file.path = std::string(str);
          env->ReleaseStringUTFChars(jPath, str);
        }

        jstring jUri = (jstring)env->GetObjectField(resObj, uriField);
        if (jUri) {
          const char* str = env->GetStringUTFChars(jUri, nullptr);
          file.uri = std::string(str);
          env->ReleaseStringUTFChars(jUri, str);
        }

        jstring jName = (jstring)env->GetObjectField(resObj, nameField);
        if (jName) {
          const char* str = env->GetStringUTFChars(jName, nullptr);
          file.name = std::string(str);
          env->ReleaseStringUTFChars(jName, str);
        }

        file.size = env->GetDoubleField(resObj, sizeField);

        jstring jType = (jstring)env->GetObjectField(resObj, typeField);
        if (jType) {
          const char* typeCStr = env->GetStringUTFChars(jType, nullptr);
          file.type = std::string(typeCStr);
          env->ReleaseStringUTFChars(jType, typeCStr);
        }

        jstring jBookmark = (jstring)env->GetObjectField(resObj, bookmarkField);
        if (jBookmark) {
          const char* bookmarkCStr = env->GetStringUTFChars(jBookmark, nullptr);
          file.bookmark = std::string(bookmarkCStr);
          env->ReleaseStringUTFChars(jBookmark, bookmarkCStr);
        }

        files.push_back(file);
        env->DeleteLocalRef(resObj);
      }
    }
    env->DeleteLocalRef(resultCls);
  }

  promise->resolve(files);
}

extern "C" JNIEXPORT void JNICALL Java_com_margelo_nitro_node_1fs_NitroFileSystemUtils_nativeOnFilesPickError(
    JNIEnv *env, jclass clazz, jlong promisePtr, jstring errorStr) {
  auto ptr = reinterpret_cast<std::shared_ptr<Promise<std::vector<PickedFile>>>*>(promisePtr);
  if (!ptr) return;
  auto promise = *ptr;
  delete ptr;

  std::string error = errorStr ? env->GetStringUTFChars(errorStr, nullptr) : "Unknown error";
  promise->reject(std::make_exception_ptr(std::runtime_error(error)));
}

extern "C" JNIEXPORT void JNICALL Java_com_margelo_nitro_node_1fs_NitroFileSystemUtils_nativeOnDirPicked(
    JNIEnv *env, jclass clazz, jlong promisePtr, jobject result) {
  auto ptr = reinterpret_cast<std::shared_ptr<Promise<PickedDirectory>>*>(promisePtr);
  if (!ptr) return;
  auto promise = *ptr;
  delete ptr;

  PickedDirectory dir;
  if (result) {
    jclass cls = env->GetObjectClass(result);
    jfieldID pathField = env->GetFieldID(cls, "path", "Ljava/lang/String;");
    jfieldID uriField = env->GetFieldID(cls, "uri", "Ljava/lang/String;");
    jfieldID bookmarkField = env->GetFieldID(cls, "bookmark", "Ljava/lang/String;");

    jstring jPath = (jstring)env->GetObjectField(result, pathField);
    if (jPath) {
      const char* str = env->GetStringUTFChars(jPath, nullptr);
      dir.path = std::string(str);
      env->ReleaseStringUTFChars(jPath, str);
    }

    jstring jUri = (jstring)env->GetObjectField(result, uriField);
    if (jUri) {
      const char* str = env->GetStringUTFChars(jUri, nullptr);
      dir.uri = std::string(str);
      env->ReleaseStringUTFChars(jUri, str);
    }

    jstring jBookmark = (jstring)env->GetObjectField(result, bookmarkField);
    if (jBookmark) {
      const char* bookmarkCStr = env->GetStringUTFChars(jBookmark, nullptr);
      dir.bookmark = std::string(bookmarkCStr);
      env->ReleaseStringUTFChars(jBookmark, bookmarkCStr);
    }
  }

  promise->resolve(dir);
}

extern "C" JNIEXPORT void JNICALL Java_com_margelo_nitro_node_1fs_NitroFileSystemUtils_nativeOnDirPickError(
    JNIEnv *env, jclass clazz, jlong promisePtr, jstring errorStr) {
  auto ptr = reinterpret_cast<std::shared_ptr<Promise<PickedDirectory>>*>(promisePtr);
  if (!ptr) return;
  auto promise = *ptr;
  delete ptr;

  std::string error = errorStr ? env->GetStringUTFChars(errorStr, nullptr) : "Unknown error";
  promise->reject(std::make_exception_ptr(std::runtime_error(error)));
}
#endif

} // namespace margelo::nitro::node_fs
