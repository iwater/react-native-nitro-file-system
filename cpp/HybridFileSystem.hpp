#pragma once
#include "HybridHybridFileSystemSpec.hpp"
#include "rust_c_file_system.h"
#include <NitroModules/ArrayBuffer.hpp>
#include <NitroModules/HybridObject.hpp>
#include <iostream>
#include <string>
#include <vector>

namespace margelo::nitro::node_fs {

class HybridFileSystem : public HybridHybridFileSystemSpec {
public:
  HybridFileSystem()
      : HybridObject("NitroNodeFileSystem"), HybridHybridFileSystemSpec() {
    // Debug: constructor called successfully
    std::cout << "[HybridFileSystem] Constructor called successfully"
              << std::endl;
  }

  double open(const std::string &path, double flags, double mode) override;
  void close(double fd) override;
  double read(double fd, const std::shared_ptr<ArrayBuffer> &buffer,
              double offset, double length, double position) override;
  double write(double fd, const std::shared_ptr<ArrayBuffer> &buffer,
               double offset, double length, double position) override;

  void access(const std::string &path, double mode) override;
  void truncate(const std::string &path, double len) override;
  void ftruncate(double fd, double len) override;
  void fsync(double fd) override;

  void chmod(const std::string &path, double mode) override;
  void lchmod(const std::string &path, double mode) override;
  void fchmod(double fd, double mode) override;
  void chown(const std::string &path, double uid, double gid) override;
  void lchown(const std::string &path, double uid, double gid) override;
  void fchown(double fd, double uid, double gid) override;
  void utimes(const std::string &path, double atime, double mtime) override;
  void lutimes(const std::string &path, double atime, double mtime) override;
  void futimes(double fd, double atime, double mtime) override;

  // Links (Phase 3)
  void link(const std::string &existingPath,
            const std::string &newPath) override;
  void symlink(const std::string &target, const std::string &path) override;
  std::string readlink(const std::string &path) override;
  std::string realpath(const std::string &path) override;

  // Modern/Advanced (Phase 4)
  std::string mkdtemp(const std::string &prefix) override;
  void rm(const std::string &path, bool recursive) override;

  Stats stat(const std::string &path) override;
  Stats lstat(const std::string &path) override;
  Stats fstat(double fd) override;

  void mkdir(const std::string &path, double mode, bool recursive) override;
  void rmdir(const std::string &path) override;
  std::vector<std::string> readdir(const std::string &path) override;

  void unlink(const std::string &path) override;
  void rename(const std::string &oldPath, const std::string &newPath) override;
  void copyFile(const std::string &src, const std::string &dest,
                double flags) override;

  std::shared_ptr<HybridHybridDirIteratorSpec>
  opendir(const std::string &path) override;
  std::shared_ptr<HybridHybridFileWatcherSpec>
  watch(const std::string &path,
        const std::function<void(const std::string &, const std::string &)>
            &onChange) override;

  std::shared_ptr<ArrayBuffer> readFile(const std::string &path) override;
  void writeFile(const std::string &path,
                 const std::shared_ptr<ArrayBuffer> &buffer) override;

  // Vector I/O
  double readv(double fd,
               const std::vector<std::shared_ptr<ArrayBuffer>> &buffers,
               double position) override;
  double writev(double fd,
                const std::vector<std::shared_ptr<ArrayBuffer>> &buffers,
                double position) override;

  std::string getTempPath() override;
};

} // namespace margelo::nitro::node_fs
