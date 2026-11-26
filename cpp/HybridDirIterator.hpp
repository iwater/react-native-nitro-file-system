#pragma once
#include "HybridHybridDirIteratorSpec.hpp"
#include "rust_c_file_system.h"
#include <NitroModules/HybridObject.hpp>
#include <functional>
#include <optional>
#include <string>
#include <utility>
#include <vector>

namespace margelo::nitro::node_fs {

class HybridDirIterator : public HybridHybridDirIteratorSpec {
public:
  HybridDirIterator(DirIter *iter, std::function<void()> cleanup = nullptr)
      : HybridObject(HybridHybridDirIteratorSpec::TAG),
        HybridHybridDirIteratorSpec(), _iter(iter), _cleanup(cleanup) {}
  explicit HybridDirIterator(std::vector<std::string> entries)
      : HybridObject(HybridHybridDirIteratorSpec::TAG),
        HybridHybridDirIteratorSpec(), _iter(nullptr),
        _entries(std::move(entries)), _useEntries(true) {}
  virtual ~HybridDirIterator() { close(); }

  std::optional<std::string> next() override;
  void close() override;

private:
  DirIter *_iter;
  std::function<void()> _cleanup;
  std::vector<std::string> _entries;
  size_t _entryIndex = 0;
  bool _useEntries = false;
  bool _closed = false;
};

} // namespace margelo::nitro::node_fs
