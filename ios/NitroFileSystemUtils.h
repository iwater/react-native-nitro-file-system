#pragma once
#include <string>
#include <vector>
#include <functional>

#include "../nitrogen/generated/shared/c++/PickedFile.hpp"
#include "../nitrogen/generated/shared/c++/PickedDirectory.hpp"
#include "../nitrogen/generated/shared/c++/PickerMode.hpp"

namespace nitro {
namespace fs {

void pickFilesIOS(bool multiple, bool requestLongTermAccess, margelo::nitro::node_fs::PickerMode mode, const std::vector<std::string>& extensions,
                  std::function<void(const std::vector<margelo::nitro::node_fs::PickedFile>&)> resolve,
                  std::function<void(const std::string&)> reject);

void pickDirectoryIOS(bool requestLongTermAccess,
                      std::function<void(const margelo::nitro::node_fs::PickedDirectory&)> resolve,
                      std::function<void(const std::string&)> reject);

/**
 * Resolves a bookmark:// URI (base64 encoded bookmark data) and opens it.
 * Returns a file descriptor or -1 on failure.
 */
int openBookmark(const std::string &uri, int flags, int mode);

/**
 * Resolves a bookmark:// URI and unlinks (deletes) it.
 * Returns 0 on success, or -1 on failure.
 */
int unlinkBookmark(const std::string &uri);

/**
 * Resolves a bookmark:// URI and checks access.
 * Returns 0 on success, or -1 on failure.
 */
int accessBookmark(const std::string &uri, int mode);

/**
 * Resolves a bookmark:// URI and gets its stats.
 * Returns 0 on success, or -1 on failure.
 */
int statBookmark(const std::string &uri, void *statsPtr);

/**
 * Efficiently copies from/to bookmark:// URIs.
 */
int copyBookmark(const std::string &src, const std::string &dest);

/**
 * Creates a bookmark:// URI (base64 encoded bookmark data) from a physical
 * path.
 */
std::string getBookmark(const std::string &path);

/**
 * Resolves a bookmark:// URI to its current physical path.
 * Returns the path string, or empty string on failure.
 */
std::string resolveBookmarkPath(const std::string &uri);

// 获取书签原始路径（导出给 JS）
std::string resolveBookmark(const std::string &bookmark);

/**
 * Resolves a bookmark:// URI and runs an action with the physical path.
 * Handles security scoped resource access automatically.
 */
void withBookmarkPath(const std::string &uri, std::function<void(const std::string &path)> action);

/**
 * Starts accessing a bookmark and returns a token and the physical path.
 * Call stopAccessingBookmark with the token when done.
 */
void* startAccessingBookmark(const std::string &uri, std::string &outPath);
void stopAccessingBookmark(void *token);

} // namespace fs
} // namespace nitro
