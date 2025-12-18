#pragma once
#include "HybridHybridFileWatcherSpec.hpp"
#include "rust_c_file_system.h"
#include <NitroModules/HybridObject.hpp>
#include <functional>
#include <string>

namespace margelo::nitro::node_fs {

class HybridFileWatcher : public HybridHybridFileWatcherSpec {
public:
  HybridFileWatcher(
      const std::string &path,
      std::function<void(const std::string &, const std::string &)> onChange);
  virtual ~HybridFileWatcher();

  void close() override;

  // Internal callback called from Rust thread
  void onChange(const std::string &path, int event);

private:
  WatcherHandle *_watcher;
  std::function<void(const std::string &, const std::string &)> _jsCallback;
};

} // namespace margelo::nitro::node_fs
