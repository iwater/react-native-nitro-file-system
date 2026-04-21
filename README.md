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
- 🌐 **URL Path Support**: Handle `file://`, `bookmark://` (iOS), and `content://` (Android) URIs.
- 🔓 **Native Picker**: Built-in cross-platform file and directory picker with persistent access support.


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
| **Native Picker**| ✅ 100% | `pickFiles`, `pickDirectory` |
| **Promises** | ✅ 100% | `fs.promises.*` (Full coverage) |

## Standard Paths

The library provides a `Paths` object containing common system directory paths for cross-platform use.

```typescript
import { Paths } from 'react-native-nitro-file-system';

console.log(Paths.cache);           // App caches directory
console.log(Paths.document);        // App documents directory
console.log(Paths.temp);            // Temporary directory
console.log(Paths.library);         // (iOS only) Library directory
console.log(Paths.mainBundle);      // (iOS only) Main bundle directory
console.log(Paths.externalCache);   // (Android only) External caches
console.log(Paths.externalStorage); // (Android only) External storage root
```

| Path Property | Platform | Description |
| :--- | :--- | :--- |
| `cache` | All | The absolute path to the app's caches directory. |
| `document` | All | The absolute path to the app's document directory. |
| `temp` | All | The absolute path to the system temporary directory. |
| `download` | All | The absolute path to the downloads directory. |
| `pictures` | All | The absolute path to the pictures directory. |
| `library` | iOS | The absolute path to the `NSLibraryDirectory`. |
| `mainBundle` | iOS | The absolute path to the main bundle directory. |
| `externalCache` | Android | The absolute path to the external caches directory. |
| `external` | Android | The absolute path to the external files directory. |
| `externalStorage`| Android | The absolute path to the external storage root directory. |

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

### URL-style Path Support

The library provides robust support for URL-style paths and standard `URL` objects across all API methods. This is particularly useful when working with Expo or React Native components that return `file://` URIs.

- **Automatic Decoding**: Percent-encoded characters (like `%20` for spaces) are automatically decoded.
- **Protocol Handling**: Both `file://` and `file:/` prefixes are supported.
- **URL Objects**: You can pass standard JavaScript `URL` objects directly to any `fs` method.

```typescript
import fs from 'react-native-nitro-file-system';

// 1. Using file:// URI strings with percent encoding
const uri = 'file:///path/to/my%20document.txt';
fs.writeFileSync(uri, 'Content with spaces');

// 2. Using standard URL objects
const url = new URL('file:///path/to/config.json');
const data = fs.readFileSync(url, 'utf8');

// 3. Works with all APIs including Streams and Promises
const promiseContent = await fs.promises.readFile(new URL('file:///path/abc.txt'));
const stream = fs.createReadStream('file:///path/to/large_file.bin');
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

### Android Asset (asset://) Support

The library provides direct, high-performance access to Android's `assets` directory via the `asset://` protocol. 

- **Read-Only**: Since APK assets are packaged as read-only, only read-related operations are supported.
- **Path format**: Use `asset://` followed by the relative path within your project's `src/main/assets` directory.
- **copyFile Support**: You can use `asset://` as the **source** path in `fs.copyFile` and `fs.copyFileSync` to extract assets to other directories.

```typescript
import fs from 'react-native-nitro-file-system';

// Copy an asset to the documents directory
fs.copyFileSync('asset://data/db.sqlite', `${Paths.document}/app.db`);

// Read a bundled configuration file
const config = fs.readFileSync('asset://config/settings.json', 'utf8');

// List files in an asset directory
const files = fs.readdirSync('asset://web-content');

// Check if an asset exists
if (fs.existsSync('asset://models/default.bin')) {
  const stats = fs.statSync('asset://models/default.bin');
  console.log(`Asset size: ${stats.size}`);
}
```

**Note**: `asset://` is supported on both **Android** and **iOS**. 
- On **Android**, it accesses binary data directly from the APK via `AssetManager`.
- On **iOS**, it maps to the `Main Bundle` directory.

### iOS Bookmark URI Support

Includes first-class support for iOS `bookmark://` URIs, allowing persistent access to security-scoped resources (like iCloud Drive files picked via Document Picker) without copying them.

```typescript
import fs, { getBookmark, resolveBookmark } from 'react-native-nitro-file-system';

// 1. Convert specific path to bookmark
const bookmark = getBookmark('/path/to/file');

// 2. Access using bookmark URI
const stat = await fs.promises.stat(bookmark);
const content = await fs.promises.readFile(bookmark);

// 3. Resolve bookmark back to physical path
const path = resolveBookmark(bookmark);
console.log(path); // "/path/to/file"
```

### Native File Picker

Nitro File System includes a high-performance native file and directory picker that integrates seamlessly with the library's path system.

```typescript
import fs, { pickFiles, pickDirectory } from 'react-native-nitro-file-system';

// 1. Pick and Import multiple images (copies to app cache)
const importedFiles = await pickFiles({
  multiple: true,
  mode: 'import',
  extensions: ['.jpg', '.png']
});

for (const file of importedFiles) {
  console.log(`Imported to cache: ${file.path}`);
  // No need for long-term access request for imported files
}

// 2. Pick and Open files in-place (persistent access)
const openedFiles = await pickFiles({
  multiple: true,
  mode: 'open',
  requestLongTermAccess: true 
});

for (const file of openedFiles) {
  console.log(`Resource path: ${file.path}`);
  if (file.bookmark) {
    console.log(`Persistent bookmark: ${file.bookmark}`);
  }
}

// 3. Pick a directory
const picked = await pickDirectory({
  requestLongTermAccess: true
});
console.log(`Selected directory: ${picked.path}`);
if (picked.bookmark) {
  console.log(`Persistent bookmark: ${picked.bookmark}`);
}

// List files in the picked directory (works with path or bookmark)
const entries = await fs.promises.readdir(picked.bookmark ?? picked.path);
console.log(entries);
```

#### File Pick Options
| Option | Type | Description |
| :--- | :--- | :--- |
| `multiple` | `boolean` | Allow multiple file selection (Default: `false`). |
| `mode` | `'open' \| 'import'` | **`'open'`**: Access file in-place (Original URI). <br> **`'import'`**: Copy file to app cache and return local path. (Default: `'open'`) |
| `extensions` | `string[]` | Specific file extensions to filter (e.g., `['.pdf', '.docx']`). |
| `requestLongTermAccess` | `boolean` | If `true`, Android will take persistable URI permission and iOS will return a `bookmark://` URI. Recommended for `'open'` mode. |

#### Directory Pick Options
| Option | Type | Description |
| :--- | :--- | :--- |
| `requestLongTermAccess` | `boolean` | If `true`, Android will take persistable URI permission and iOS will return a `bookmark://` URI. |

#### Picked Result
- `pickFiles` returns `Promise<PickedFile[]>`
- `pickDirectory` returns `Promise<PickedDirectory>`

| Property | Type | Description |
| :--- | :--- | :--- |
| `path` | `string` | The physical path to the file or directory. |
| `uri` | `string` | The standard URI (e.g. `file:///...` or `content://...`) for interoperability. |
| `bookmark` | `string` | (Optional) The `bookmark://` (iOS) or `content://` (Android) URI for persistent access. |
| `name` | `string` | The display name of the file (Only for `PickedFile`). |
| `size` | `number` | The size of the file in bytes (Only for `PickedFile`). |

#### Platform Specifics
- **Android**: Returns `content://` URIs in both `path` and `bookmark`. If `requestLongTermAccess` is enabled, the library automatically calls `takePersistableUriPermission` for you.
- **iOS**: Returns standard file paths in `path`. If `requestLongTermAccess` is enabled, it returns `bookmark://` URIs in `bookmark` which provide security-scoped access. These URIs are natively supported by all other `fs` methods in this library.



## Native Picker & Persistent Access

On iOS and Android, accessing files outside of the application's sandbox (like external storage or specific folders) requires explicit user permission. The library provides a native picker and a way to maintain persistent access through security-scoped bookmarks (iOS) or persistable URI permissions (Android).

### Picking Files and Directories

```typescript
import fs from 'react-native-nitro-file-system';

// Pick files (returns PickedFile[])
const files = await fs.pickFiles({
  multiple: true,
  extensions: ['.txt', '.pdf'],
  requestLongTermAccess: true    // Recommended for persistent access
});

// Pick a directory (returns PickedDirectory)
const picked = await fs.pickDirectory({
  requestLongTermAccess: true
});
console.log(picked.path);     // Physical path
console.log(picked.bookmark); // bookmark://... on iOS, content://... on Android

// You can use the returned bookmark directly with any fs method
const items = fs.readdirSync(picked.bookmark ?? picked.path);
```

### iOS Security Scoped Bookmarks

When `requestLongTermAccess: true` is passed to `pickFiles` or when using `pickDirectory`, the library returns a special `bookmark://` URI on iOS. This URI embeds a security-scoped bookmark.

- **Seamless Access**: The library automatically manages security-scoped resource access for every `fs` call using a `bookmark://` URI.
- **Path Joining**: You can join paths with a bookmark URI (e.g., using `${uri}/file.txt`), and the library will correctly resolve the path while maintaining security scoping.
- **Long-term Storage**: These URIs can be saved (e.g., in MMKV) and reused across app restarts.
- **Manual Bookmarks**: Use `fs.getBookmark(path)` to generate a bookmark for an existing file or directory.

### Android Persistable URIs

On Android, `pickFiles` and `pickDirectory` return `content://` URIs. The library automatically requests persistable URI permissions when possible, ensuring the app maintains access after reboot.

- **Compatibility**: The Node.js-compatible API handles `content://` URIs for reading, writing, and directory listing.
- **SAF Tree Support**: `readdir` and `stat` are supported for directory tree URIs returned by `pickDirectory`.

## License

ISC
