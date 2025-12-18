#include "HybridDirIterator.hpp"

namespace margelo::nitro::node_fs {

std::optional<std::string> HybridDirIterator::next() {
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
  if (_iter != nullptr) {
    rn_fs_readdir_close(_iter);
    _iter = nullptr;
  }
}

} // namespace margelo::nitro::node_fs
