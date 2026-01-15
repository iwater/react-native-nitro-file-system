# react-native-nitro-file-system

A high-performance, Node.js-compatible file system (fs) module for React Native, powered by [Nitro Modules](https://github.com/mrousavy/nitro).

[![license](https://img.shields.io/badge/license-ISC-blue.svg)](https://github.com/iwater/rn-http-server/blob/main/LICENSE)
[![platform](https://img.shields.io/badge/platform-ios%20%7C%20android-lightgrey.svg)]()
[![compatibility](https://img.shields.io/badge/Node.js-100%25%20fs-green.svg)]()
[中文文档](./README_zh.md)

## Features

- 🚀 **Extreme Performance**: Low-overhead communication via JSI and Nitro.
- 📦 **Zero-copy Binary Data**: Efficiently handle large files using `ArrayBuffer` and `NitroBuffer`.
- 🛠️ **Node.js Compatible API**: Supports `fs` methods like `readFile`, `writeFile`, `mkdir`, `stat`, and more (Sync & Async).
- 🏗️ **Streaming Support**: Built-in `ReadStream` and `WriteStream` for efficient data processing.
- 📂 **Directory & Watcher**: Support for directory iteration and file system watching.

## Comparison with other Libraries

| Feature | `react-native-fs` | `expo-file-system` | `react-native-blob-util` | **Nitro File System** |
| :--- | :--- | :--- | :--- | :--- |
| **Architecture** | Legacy Bridge | Turbo Modules / Expo | Legacy Bridge / C++ | **Nitro (JSI / C++)** |
| **Communication** | High (Base64/JSON) | Medium | Medium | **Ultra Low (Direct JSI)** |
| **Binary Handling** | Slow (Base64) | Fast | Fast | **Top (Zero-copy Buffers)** |
| **API Style** | Custom | Custom | Stream / Mixed | **Node.js `fs` Compatible** |
| **Sync API** | Poor | None | Limited | **Full Support** |

## Installation

```sh
npm install react-native-nitro-file-system react-native-nitro-modules react-native-nitro-buffer
# or
yarn add react-native-nitro-file-system react-native-nitro-modules react-native-nitro-buffer
```

## API Compatibility

| Category | Status | Supported Methods |
| :--- | :--- | :--- |
| **File I/O** | ✅ 100% | `open`, `read`, `write`, `close`, `readFile`, `writeFile`, `appendFile`, `truncate`, `fsync`, `readv`, `writev` |
| **Metadata** | ✅ 100% | `stat`, `lstat`, `fstat`, `access`, `utimes`, `futimes`, `lutimes` (including `bigint` support) |
| **Directories** | ✅ 100% | `mkdir`, `rmdir`, `readdir`, `rm`, `mkdtemp`, `opendir` (`Dir` class) |
| **Permissions** | ✅ 100% | `chmod`, `fchmod`, `lchmod`, `chown`, `fchown`, `lchown` |
| **Links** | ✅ 100% | `link`, `symlink`, `readlink`, `realpath` |
| **Watching** | ✅ 100% | `watch`, `watchFile`, `unwatchFile` |
| **Streams** | ✅ 100% | `createReadStream`, `createWriteStream` |
| **Promises** | ✅ 100% | `fs.promises.*` (Full coverage) |

## Basic Usage

### Read and Write Files

```typescript
import fs from 'react-native-nitro-file-system';

// Write a file (Sync)
fs.writeFileSync('/path/to/file.txt', 'Hello Nitro!');

// Read a file (Async)
fs.readFile('/path/to/file.txt', 'utf8', (err, data) => {
  if (err) throw err;
  console.log(data); // "Hello Nitro!"
});

// Using Promises
const content = await fs.promises.readFile('/path/to/file.txt', 'utf8');
```


### Android Content URIs

The library supports Android `content://` URIs for the following operations:
- **Read/Write**: `fs.open`, `fs.read`, `fs.write`, `fs.readFile`, `fs.writeFile`.
- **Metadata**: `fs.stat`, `fs.lstat`, `fs.access` (existence check).
- **Cleanup**: `fs.unlink`, `fs.rm`.
- **Utility**: `fs.copyFile`.

**Note**: Directory operations (`mkdir`, `readdir`, `rename`, `chmod`) are **not supported** for `content://` URIs as they are virtual resources.

```typescript
// Read directly from a content:// URI
const contentUri = 'content://com.android.providers.media.documents/document/image%3A1234';
const data = fs.readFileSync(contentUri, 'base64');

// Get file stats
const stats = fs.statSync(contentUri);
console.log(stats.size);
```

## License

ISC
