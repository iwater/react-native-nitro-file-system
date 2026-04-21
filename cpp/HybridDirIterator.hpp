#pragma once
#include "HybridHybridDirIteratorSpec.hpp"
#include "rust_c_file_system.h"
#include <NitroModules/HybridObject.hpp>
#include <optional>
#include <string>

namespace margelo::nitro::node_fs {

class HybridDirIterator : public HybridHybridDirIteratorSpec {
public:
  HybridDirIterator(DirIter *iter, std::function<void()> cleanup = nullptr)
      : HybridObject(HybridHybridDirIteratorSpec::TAG),
        HybridHybridDirIteratorSpec(), _iter(iter), _cleanup(cleanup) {}
  virtual ~HybridDirIterator() { close(); }

  std::optional<std::string> next() override;
  void close() override;

private:
  DirIter *_iter;
  std::function<void()> _cleanup;
};

} // namespace margelo::nitro::node_fs
