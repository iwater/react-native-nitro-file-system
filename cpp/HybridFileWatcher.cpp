#include "HybridFileWatcher.hpp"
#include <iostream>

namespace margelo::nitro::node_fs {

static void onFileChange(void *context, const char *path, int event) {
  auto watcher = static_cast<HybridFileWatcher *>(context);
  if (watcher) {
    watcher->onChange(std::string(path), event);
  }
}

HybridFileWatcher::HybridFileWatcher(
    const std::string &path,
    std::function<void(const std::string &, const std::string &)> onChange)
    : HybridObject(HybridHybridFileWatcherSpec::TAG),
      HybridHybridFileWatcherSpec(), _jsCallback(onChange) {

  _watcher = rn_fs_watch(path.c_str(), this, onFileChange);
}

HybridFileWatcher::~HybridFileWatcher() { close(); }

void HybridFileWatcher::close() {
  if (_watcher != nullptr) {
    rn_fs_unwatch(_watcher);
    _watcher = nullptr;
  }
}

void HybridFileWatcher::onChange(const std::string &path, int event) {
  // Event: 1=Rename, 2=Change
  std::string eventName = (event == 2) ? "change" : "rename";
  // Call JS callback.
  // Note: This is called from a Rust thread. Nitro *should* handle thread
  // safety for the std::function wrapper if it's properly marshaled. If not, we
  // might fail here. However, modern HybridObjects often allow calling back
  // from any thread.
  try {
    _jsCallback(eventName, path);
  } catch (const std::exception &e) {
    std::cerr << "HybridFileWatcher: Error calling JS callback: " << e.what()
              << std::endl;
  }
}

} // namespace margelo::nitro::node_fs
