#pragma once
#include <string>

namespace nitro {
namespace fs {

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

} // namespace fs
} // namespace nitro
