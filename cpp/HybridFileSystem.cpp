#include "HybridFileSystem.hpp"
#include "HybridDirIterator.hpp"
#include "HybridFileWatcher.hpp"
#include "rust_c_file_system.h"
#include <iostream>
#include <string>
#include <sys/stat.h>

namespace margelo::nitro::node_fs {

Stats toStats(const RNStats &s) {
  return Stats(static_cast<double>(s.dev), static_cast<double>(s.ino),
               static_cast<double>(s.mode), static_cast<double>(s.nlink),
               static_cast<double>(s.uid), static_cast<double>(s.gid),
               static_cast<double>(s.rdev), static_cast<double>(s.size),
               static_cast<double>(s.blksize), static_cast<double>(s.blocks),
               s.atime_ms, s.mtime_ms, s.ctime_ms, s.birthtime_ms);
}

double HybridFileSystem::open(const std::string &path, double flags,
                              double mode) {
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
                    static_cast<int>(position));
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
                     static_cast<int>(position));
}

void HybridFileSystem::access(const std::string &path, double mode) {
  if (rn_fs_access(path.c_str(), static_cast<int>(mode)) != 0) {
    throw std::runtime_error("access failed: " + path);
  }
}

void HybridFileSystem::truncate(const std::string &path, double len) {
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

void HybridFileSystem::chmod(const std::string &path, double mode) {
  if (rn_fs_chmod(path.c_str(), static_cast<int>(mode)) != 0) {
    throw std::runtime_error("chmod failed: " + path);
  }
}

void HybridFileSystem::lchmod(const std::string &path, double mode) {
  if (rn_fs_lchmod(path.c_str(), static_cast<uint32_t>(mode)) != 0) {
    throw std::runtime_error("lchmod failed: " + path);
  }
}

void HybridFileSystem::fchmod(double fd, double mode) {
  if (rn_fs_fchmod(static_cast<int>(fd), static_cast<int>(mode)) != 0) {
    throw std::runtime_error("fchmod failed");
  }
}

void HybridFileSystem::chown(const std::string &path, double uid, double gid) {
  if (rn_fs_chown(path.c_str(), static_cast<int>(uid), static_cast<int>(gid)) !=
      0) {
    throw std::runtime_error("chown failed: " + path);
  }
}

void HybridFileSystem::lchown(const std::string &path, double uid, double gid) {
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

void HybridFileSystem::utimes(const std::string &path, double atime,
                              double mtime) {
  if (rn_fs_utimes(path.c_str(), atime, mtime) != 0) {
    throw std::runtime_error("utimes failed: " + path);
  }
}

void HybridFileSystem::lutimes(const std::string &path, double atime,
                               double mtime) {
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

void HybridFileSystem::link(const std::string &existingPath,
                            const std::string &newPath) {
  if (rn_fs_link(existingPath.c_str(), newPath.c_str()) != 0) {
    throw std::runtime_error("link failed: " + existingPath + " -> " + newPath);
  }
}

void HybridFileSystem::symlink(const std::string &target,
                               const std::string &path) {
  if (rn_fs_symlink(target.c_str(), path.c_str()) != 0) {
    throw std::runtime_error("symlink failed: " + target + " -> " + path);
  }
}

std::string HybridFileSystem::readlink(const std::string &path) {
  char *res = rn_fs_readlink(path.c_str());
  if (res == nullptr) {
    throw std::runtime_error("readlink failed: " + path);
  }
  std::string result(res);
  rn_fs_free_string(res);
  return result;
}

std::string HybridFileSystem::realpath(const std::string &path) {
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

void HybridFileSystem::rm(const std::string &path, bool recursive) {
  int res = rn_fs_rm(path.c_str(), recursive);
  if (res != 0) {
    // TODO: better error message based on errno?
    throw std::runtime_error("rm failed");
  }
}

Stats HybridFileSystem::stat(const std::string &path) {
  RNStats s;
  if (rn_fs_stat(path.c_str(), &s) == 0) {
    return toStats(s);
  }
  // Throw error or return empty? Nitro methods can throw exceptions.
  throw std::runtime_error("stat failed: " + path);
}

Stats HybridFileSystem::lstat(const std::string &path) {
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

void HybridFileSystem::mkdir(const std::string &path, double mode,
                             bool recursive) {
  if (!rn_fs_mkdir(path.c_str(), static_cast<uint32_t>(mode), recursive)) {
    throw std::runtime_error("mkdir failed: " + path);
  }
}

void HybridFileSystem::rmdir(const std::string &path) {
  if (rn_fs_rmdir(path.c_str()) != 0) {
    throw std::runtime_error("rmdir failed: " + path);
  }
}

std::vector<std::string> HybridFileSystem::readdir(const std::string &path) {
  std::vector<std::string> results;
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

void HybridFileSystem::unlink(const std::string &path) {
  if (rn_fs_unlink(path.c_str()) != 0) {
    throw std::runtime_error("unlink failed: " + path);
  }
}

void HybridFileSystem::rename(const std::string &oldPath,
                              const std::string &newPath) {
  if (rn_fs_rename(oldPath.c_str(), newPath.c_str()) != 0) {
    throw std::runtime_error("rename failed");
  }
}

void HybridFileSystem::copyFile(const std::string &src, const std::string &dest,
                                double flags) {
  if (rn_fs_copy_file(src.c_str(), dest.c_str(), static_cast<int>(flags)) !=
      0) {
    throw std::runtime_error("copyFile failed");
  }
}

std::shared_ptr<ArrayBuffer>
HybridFileSystem::readFile(const std::string &path) {
  size_t len = 0;
  uint8_t *data = rn_fs_read_file(path.c_str(), &len);
  if (!data) {
    throw std::runtime_error("readFile failed: " + path);
  }

  auto buffer = ArrayBuffer::copy(data, len);
  rn_fs_read_file_free(data, len);
  return buffer;
}

void HybridFileSystem::writeFile(const std::string &path,
                                 const std::shared_ptr<ArrayBuffer> &buffer) {
  if (!buffer) {
    throw std::runtime_error("buffer is null");
  }
  if (rn_fs_write_file(path.c_str(), buffer->data(), buffer->size()) != 0) {
    throw std::runtime_error("writeFile failed: " + path);
  }
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

std::shared_ptr<HybridHybridDirIteratorSpec>
HybridFileSystem::opendir(const std::string &path) {
  DirIter *iter = rn_fs_readdir_open(path.c_str());
  if (iter == nullptr) {
    throw std::runtime_error("opendir failed: " + path);
  }
  return std::make_shared<HybridDirIterator>(iter);
}

std::shared_ptr<HybridHybridFileWatcherSpec> HybridFileSystem::watch(
    const std::string &path,
    const std::function<void(const std::string &, const std::string &)>
        &onChange) {
  return std::make_shared<HybridFileWatcher>(path, onChange);
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

} // namespace margelo::nitro::node_fs
