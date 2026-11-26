#include "HybridDirIterator.hpp"

namespace margelo::nitro::node_fs {

std::optional<std::string> HybridDirIterator::next() {
  if (_useEntries) {
    if (_closed || _entryIndex >= _entries.size()) {
      return std::nullopt;
    }
    return _entries[_entryIndex++];
  }
  if (_iter == nullptr) {
    return std::nullopt;
  }
  char *name = rn_fs_readdir_next(_iter);
  if (name == nullptr) {
    return std::nullopt;
  }
  std::string result(name);
  rn_fs_free_string(name);
  return result;
}

void HybridDirIterator::close() {
  _closed = true;
  _entries.clear();
  if (_iter != nullptr) {
    rn_fs_readdir_close(_iter);
    _iter = nullptr;
  }
  if (_cleanup) {
    _cleanup();
    _cleanup = nullptr;
  }
}

} // namespace margelo::nitro::node_fs
