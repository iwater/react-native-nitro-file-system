# Node.js FS Compatibility Audit

This document tracks the compatibility of `react-native-nitro-file-system` with the standard Node.js `fs` API.

## Summary

*   **Overall Status**: Mostly Implemented (~85%)
*   **Core I/O**: Implemented (`open`, `read`, `write`, `close`, `fsync`, `truncate`, `readv`, `writev`)
*   **Metadata**: Implemented (`stat`, `lstat`, `fstat`, `access`, `utimes`) - includes `bigint` option
*   **Basic Manipulation**: Implemented (`mkdir`, `rmdir`, `readdir`, `unlink`, `rename`, `copyFile`, `chmod`, `chown`)
*   **Links**: Implemented (`link`, `symlink`, `readlink`, `realpath`)
*   **Streams**: Implemented (`createReadStream`, `createWriteStream`)
*   **Watching**: Implemented (`watch`).

## API Compatibility Matrix

| API | Status | Notes |
| :--- | :--- | :--- |
| **Constants** | | |
| `fs.constants` | ✅ Implemented | Most common constants (O_*, S_*) are present. |
| **File Handling** | | |
| `fs.open(path[, flags[, mode]], callback)` | ✅ Implemented | Supports flags/mode. Async simulated via `setImmediate`. |
| `fs.openSync(...)` | ✅ Implemented | |
| `fs.close(fd, callback)` | ✅ Implemented | |
| `fs.closeSync(fd)` | ✅ Implemented | |
| `fs.read(fd, buffer, offset, length, position, callback)` | ✅ Implemented | All Node.js overloads supported: `read(fd, cb)`, `read(fd, options, cb)`. |
| `fs.readSync(...)` | ✅ Implemented | Supports options object. |
| `fs.write(fd, buffer[, offset[, length[, position]]], callback)` | ✅ Implemented | String overloads supported: `write(fd, string, position, encoding, cb)`. |
| `fs.writeSync(...)` | ✅ Implemented | Supports string with encoding. |
| `fs.readFile(path[, options], callback)` | ✅ Implemented | Supports encoding. |
| `fs.readFileSync(...)` | ✅ Implemented | |
| `fs.writeFile(file, data[, options], callback)` | ✅ Implemented | Supports encoding. |
| `fs.writeFileSync(...)` | ✅ Implemented | |
| `fs.appendFile` | ✅ Implemented | |
| `fs.appendFileSync` | ✅ Implemented | |
| `fs.truncate` | ✅ Implemented | |
| `fs.truncateSync` | ✅ Implemented | |
| `fs.ftruncate` | ✅ Implemented | |
| `fs.ftruncateSync` | ✅ Implemented | |
| `fs.fsync` | ✅ Implemented | |
| `fs.fsyncSync` | ✅ Implemented | |
| `fs.fdatasync` | ✅ Implemented | Mapped to `fsync`. |
| `fs.fdatasyncSync` | ✅ Implemented | Mapped to `fsync`. |
| `fs.exists` | ✅ Implemented | |
| `fs.existsSync` | ✅ Implemented | |
| `fs.readv` | ✅ Implemented | TypeScript-level vectored read. |
| `fs.readvSync` | ✅ Implemented | |
| `fs.writev` | ✅ Implemented | TypeScript-level vectored write. |
| `fs.writevSync` | ✅ Implemented | |
| **Directories** | | |
| `fs.mkdir(path[, options], callback)` | ✅ Implemented | `recursive` option supported. |
| `fs.mkdirSync(...)` | ✅ Implemented | `recursive` option supported. |
| `fs.rmdir(path[, options], callback)` | ✅ Implemented | `{recursive, maxRetries, retryDelay}` options supported. |
| `fs.rmdirSync(...)` | ✅ Implemented | Options supported. |
| `fs.readdir(path[, options], callback)` | ✅ Implemented | Returns `string[]` or `Dirent[]`. |
| `fs.readdirSync(...)` | ✅ Implemented | |
| `fs.rm(path[, options], callback)` | ✅ Implemented | Supports `{recursive: true}`. force/maxRetries ignored. |
| `fs.rmSync(...)` | ✅ Implemented | Supports `{recursive: true}`. |
| `fs.mkdtemp` | ✅ Implemented | |
| `fs.mkdtempSync` | ✅ Implemented | |
| `fs.opendir` | ✅ Implemented | Returns `Dir` class. |
| `fs.opendirSync` | ✅ Implemented | Returns `Dir` class. |
| **Metadata** | | |
| `fs.stat(path[, options], callback)` | ✅ Implemented | Returns `Stats` or `BigIntStats`. `{bigint: true}` option supported. |
| `fs.statSync(...)` | ✅ Implemented | `bigint` option supported. |
| `fs.lstat` | ✅ Implemented | `bigint` option supported. |
| `fs.lstatSync` | ✅ Implemented | |
| `fs.fstat` | ✅ Implemented | `bigint` option supported. |
| `fs.fstatSync` | ✅ Implemented | |
| `fs.access` | ✅ Implemented | |
| `fs.accessSync` | ✅ Implemented | |
| `fs.utimes` | ✅ Implemented | |
| `fs.utimesSync` | ✅ Implemented | |
| `fs.futimes` | ✅ Implemented | |
| `fs.futimesSync` | ✅ Implemented | |
| `fs.lutimes` | ✅ Implemented | |
| `fs.lutimesSync` | ✅ Implemented | |
| **Permissions** | | |
| `fs.chmod` | ✅ Implemented | |
| `fs.chmodSync` | ✅ Implemented | |
| `fs.fchmod` | ✅ Implemented | |
| `fs.fchmodSync` | ✅ Implemented | |
| `fs.lchmod` | ✅ Implemented | Native `lchmod` (macOS specific). |
| `fs.lchmodSync` | ✅ Implemented | |
| `fs.chown` | ✅ Implemented | |
| `fs.chownSync` | ✅ Implemented | |
| `fs.fchown` | ✅ Implemented | |
| `fs.fchownSync` | ✅ Implemented | |
| `fs.lchown` | ✅ Implemented | Native `lchown` (macOS/Linux). |
| `fs.lchownSync` | ✅ Implemented | |
| **Links** | | |
| `fs.link` | ✅ Implemented | |
| `fs.linkSync` | ✅ Implemented | |
| `fs.symlink` | ✅ Implemented | |
| `fs.symlinkSync` | ✅ Implemented | |
| `fs.readlink` | ✅ Implemented | |
| `fs.readlinkSync` | ✅ Implemented | |
| `fs.realpath` | ✅ Implemented | |
| `fs.realpathSync` | ✅ Implemented | |
| **Files** | | |
| `fs.unlink` | ✅ Implemented | |
| `fs.unlinkSync` | ✅ Implemented | |
| `fs.rename` | ✅ Implemented | |
| `fs.renameSync` | ✅ Implemented | |
| `fs.copyFile` | ✅ Implemented | |
| `fs.copyFileSync` | ✅ Implemented | |
| `fs.watch` | ✅ Implemented | Returns `FSWatcher`. |
| `fs.watchFile` | ✅ Implemented | Polling based. |
| `fs.unwatchFile` | ✅ Implemented | |
| **Streams** | | |
| `fs.createReadStream` | ✅ Implemented | |
| `fs.createWriteStream` | ✅ Implemented | |
| **Promises API** | | |
| `fs.promises` | ✅ Implemented | Complete coverage including `lstat`, `lchmod`, `lchown`, `lutimes`, `opendir`. |
