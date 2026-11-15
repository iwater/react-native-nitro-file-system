#pragma once
#include "HybridHybridFileSystemSpec.hpp"
#include "rust_c_file_system.h"
#include <NitroModules/ArrayBuffer.hpp>
#include <NitroModules/HybridObject.hpp>
#include <string>
#include <vector>
#include <unordered_map>

namespace margelo::nitro::node_fs {

class HybridFileSystem : public HybridHybridFileSystemSpec {
public:
  // 注：此处曾有一行 `std::cout << "[HybridFileSystem] Constructor ..."`。
  // 它是作者遗留的 debug 输出，却打在 **stdout** 上——Node 的 require('fs')
  // 不打任何东西，于是任何用到 fs 的程序在 stdout 比对上必然不等。
  // 已按 qjs-node 的 parity 判据（stdout 必须与 Node 逐字节一致）移除；
  // 诊断输出本就该走 stderr，且这条在构造期无条件打印，没有保留价值。
  HybridFileSystem()
      : HybridObject("NitroNodeFileSystem"), HybridHybridFileSystemSpec() {}

  // Properties
  std::string getBundleUri() override;
  std::string getCachesDirectoryPath() override;
  std::string getDocumentDirectoryPath() override;
  std::string getDownloadDirectoryPath() override;
  std::string getExternalCachesDirectoryPath() override;
  std::string getExternalDirectoryPath() override;
  std::string getExternalStorageDirectoryPath() override;
  std::string getLibraryDirectoryPath() override;
  std::string getMainBundlePath() override;
  std::string getPicturesDirectoryPath() override;
  std::string getTemporaryDirectoryPath() override;
  std::unordered_map<std::string, std::string> getFileProtectionKeys() override;

  // errno of the most recent failed native call (0 if the last one succeeded).
  double getLastErrno() override;

  // POSIX name of that errno ("ENOENT", ...), or "" when there is none.
  std::string getLastErrorCode() override;

  // The platform's own O_* values - see `openFlagValues` in
  // HybridFileSystem.nitro.ts for the field order and the meaning of a negative
  // entry.
  std::vector<double> getOpenFlagValues() override;

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
  void cp(const std::string &src, const std::string &dest, bool recursive,
          bool force, bool dereference, bool errorOnExist,
          bool preserveTimestamps) override;

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

  // Disk space & streaming file hash
  StatFs statfs(const std::string &path) override;
  std::shared_ptr<Promise<std::string>> hashFile(const std::string &path,
                                                 const std::string &algorithm) override;
  std::string hashFileSync(const std::string &path,
                           const std::string &algorithm) override;

  std::string getBookmark(const std::string &path) override;
  std::string resolveBookmark(const std::string &bookmark) override;
  std::string getTempPath() override;

  // Picker API
  std::shared_ptr<Promise<std::vector<PickedFile>>> pickFiles(const FilePickerOptions& options) override;
  std::shared_ptr<Promise<PickedDirectory>> pickDirectory(const std::optional<DirectoryPickerOptions>& options) override;

private:
  std::string normalizePath(const std::string &path);
#ifdef __ANDROID__
  void copyAssetRecursive(const std::string& assetPath, const std::string& destPath, bool recursive, bool force, bool errorOnExist);
#endif
};

} // namespace margelo::nitro::node_fs
