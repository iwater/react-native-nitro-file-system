# react-native-nitro-file-system

A high-performance, Node.js-compatible file system (fs) module for React Native, powered by [Nitro Modules](https://github.com/mrousavy/nitro).

[![license](https://img.shields.io/badge/license-ISC-blue.svg)](https://github.com/iwater/rn-http-server/blob/main/LICENSE)
[![platform](https://img.shields.io/badge/platform-ios%20%7C%20android%20%7C%20macos%20%7C%20web-lightgrey.svg)]()
[![compatibility](https://img.shields.io/badge/Node.js-100%25%20fs-green.svg)]()
[中文文档](./README_zh.md)

## Features

- 🚀 **Extreme Performance**: Low-overhead communication via direct JSI and Nitro.
- 📦 **Zero-copy Binary Data**: Efficiently handle large files using `ArrayBuffer` and `NitroBuffer`.
- 🛠️ **Node.js Compatible API**: Supports `readFile`, `writeFile`, `mkdir`, `stat`, and other standard `fs` methods (Sync & Async).
- 🏗️ **Streaming Support**: Built-in `ReadStream` and `WriteStream` for efficient data processing.
- 📂 **Directory & Watcher**: Support for directory iteration and file system change watching.
- 🌐 **URL Path Support**: Native handling for `file://`, `bookmark://` (iOS), `content://` (Android), and `asset://` URIs with `toFileUri` / `normalizePath` helpers.
- 💾 **Disk Space Queries**: Node.js 18.15+ compatible `statfs` / `statfsSync` with `Paths.availableDiskSpace` and `Paths.totalDiskSpace` getters.
- ⚡ **Streaming File Hashing**: Fast, memory-efficient `promises.hashFile` and `hashFileSync` (`md5`, `sha1`, `sha256`, `sha512`), computed natively in 64KB chunks on background worker threads without JS heap bloat.
- 🔄 **`react-native-fs` Compatibility Layer**: Drop-in subpath `react-native-nitro-file-system/rnfs-compat` for seamless migration and 3rd-party library compatibility.
- 🌍 **Web Platform Graceful Fallback**: Bundled `.web.ts` stubs prevent bundle crashes in Expo Web and Metro Web environments.
- 🔓 **Native Picker**: Built-in cross-platform file and directory picker with persistent access support.

## Comparison with other Libraries

| Feature | `react-native-fs` | `expo-file-system` | `react-native-blob-util` | **Nitro File System** |
| :--- | :--- | :--- | :--- | :--- |
| **Architecture** | Legacy Bridge | Turbo Modules / Expo | Legacy Bridge / C++ | **Nitro (JSI / C++)** |
| **Communication** | High (Base64/JSON) | Medium | Medium | **Ultra Low (Direct JSI)** |
| **Binary Handling** | Slow (Base64) | Fast | Fast | **Top (Zero-copy Buffers)** |
| **API Style** | Custom | Custom | Stream / Mixed | **Node.js `fs` Compatible** |
| **Sync API** | Poor | None | Limited | **Full Support** |
| **Disk Space (statfs)**| Free space only | Partial | Not supported | **Node.js `statfs` + computed helpers** |
| **Streaming Hash** | Common algos only | Limited | Not supported | **Native chunked streaming (no JS OOM)** |
| **RNFS Compat Layer** | Self | None | None | **Built-in (`/rnfs-compat`)** |
| **Web Platform** | None | Supported | None | **Built-in Safe Fallback** |

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
| **Disk Space**| ✅ 100% | `statfs`, `statfsSync`, `fs.promises.statfs` (including `bigint` support) |
| **Directories** | ✅ 100% | `mkdir`, `rmdir`, `readdir`, `rm`, `mkdtemp`, `opendir` (`Dir` class), `cp` |
| **Permissions** | ✅ 100% | `chmod`, `fchmod`, `lchmod`, `chown`, `fchown`, `lchown` |
| **Links** | ✅ 100% | `link`, `symlink`, `readlink`, `realpath` |
| **File Hashing**| ✅ 100% | `hashFileSync`, `fs.promises.hashFile` (Streaming & background execution) |
| **Watching** | ✅ 100% | `watch`, `watchFile`, `unwatchFile` |
| **Streams** | ✅ 100% | `createReadStream`, `createWriteStream` |
| **Native Picker**| ✅ 100% | `pickFiles`, `pickDirectory` (Persistent permissions & security bookmarks) |
| **Compat Layer** | ✅ 100% | `react-native-nitro-file-system/rnfs-compat` (`RNFS` full mainstream API) |
| **Promises** | ✅ 100% | `fs.promises.*` (Full coverage) |

## Standard Paths (Paths)

The library provides a `Paths` object containing common system directory physical paths and their standard URI representations.

```typescript
import { Paths } from 'react-native-nitro-file-system';

// Physical paths
console.log(Paths.cache);           // App caches directory
console.log(Paths.document);        // App documents directory
console.log(Paths.temp);            // System temporary directory
console.log(Paths.library);         // (iOS only) Library directory
console.log(Paths.mainBundle);      // (iOS only) Main bundle directory
console.log(Paths.externalCache);   // (Android only) External caches directory
console.log(Paths.externalStorage); // (Android only) External storage root directory

// Standard URIs (file:/// or asset://)
console.log(Paths.bundleUri);        // iOS: file:///.../MyApp.app/ | Android: asset://
console.log(Paths.bundleAssetUri);   // iOS: file:///.../MyApp.app/ | Android: file:///android_asset/
console.log(Paths.documentUri);      // file:///.../Documents
console.log(Paths.cacheUri);         // file:///.../Caches
console.log(Paths.tempUri);          // file:///.../tmp

// Disk space getters (non-enumerable, evaluated on access)
console.log(Paths.availableDiskSpace); // Available bytes for user storage
console.log(Paths.totalDiskSpace);     // Total filesystem capacity in bytes
```

| Path Property | Platform | Description |
| :--- | :--- | :--- |
| `cache` | All | Absolute path to the app's cache directory. |
| `document` | All | Absolute path to the app's document directory. |
| `temp` | All | Absolute path to the system temporary directory. |
| `download` | All | Absolute path to the downloads directory. |
| `pictures` | All | Absolute path to the pictures directory. |
| `library` | iOS | Absolute path to the `NSLibraryDirectory`. |
| `mainBundle` | iOS | Absolute path to the main bundle directory. |
| `externalCache` | Android | Absolute path to the external caches directory. |
| `external` | Android | Absolute path to the external files directory. |
| `externalStorage`| Android | Absolute path to the external storage root directory. |
| `bundleUri` | All | URI representation of app resources (`file://...` on iOS, `asset://` on Android). |
| `bundleAssetUri` | All | Platform UI/media-ready bundle URI (`file://...` on iOS, `file:///android_asset/` on Android). |
| `documentUri` | All | Standard `file://` URI for the document directory. |
| `cacheUri` | All | Standard `file://` URI for the cache directory. |
| `tempUri` | All | Standard `file://` URI for the temp directory. |
| `availableDiskSpace` | All | Available space in bytes on the mounted volume (read-only getter). |
| `totalDiskSpace` | All | Total storage capacity in bytes on the mounted volume (read-only getter). |

## Basic Usage

### Read and Write Files

```typescript
import fs from 'react-native-nitro-file-system';

// Write a file (Sync)
fs.writeFileSync('/path/to/file.txt', 'Hello Nitro!');

// Read a file (Async callback)
fs.readFile('/path/to/file.txt', 'utf8', (err, data) => {
  if (err) throw err;
  console.log(data); // "Hello Nitro!"
});

// Using Promises
const content = await fs.promises.readFile('/path/to/file.txt', 'utf8');
```

### Disk Space Queries (statfs / statfsSync)

The library fully implements Node.js 18.15+ `fs.statfs` standard and provides convenient space calculation attributes.

```typescript
import fs from 'react-native-nitro-file-system';

// 1. Sync statfs query
const info = fs.statfsSync(fs.Paths.document);
console.log(`Total: ${info.totalBytes} bytes`);
console.log(`Available: ${info.availableBytes} bytes`);
console.log(`Free: ${info.freeBytes} bytes`);
console.log(`Block Size: ${info.bsize}`);

// 2. BigInt support for large storage volumes
const bigInfo = fs.statfsSync('/', { bigint: true });
console.log(bigInfo.totalBytes); // 1000204886016n

// 3. Promise async query
const asyncInfo = await fs.promises.statfs(fs.Paths.cache);
```

#### `StatFs` Return Structure

| Field | Type | Description |
| :--- | :--- | :--- |
| `totalBytes` | `number` / `bigint` | Total capacity of the filesystem volume in bytes. |
| `availableBytes` | `number` / `bigint` | Free bytes available to unprivileged processes. |
| `freeBytes` | `number` / `bigint` | Free bytes in the filesystem including root reserved blocks. |
| `bsize` | `number` / `bigint` | Filesystem block size in bytes. |
| `blocks` | `number` / `bigint` | Total data blocks in the filesystem. |
| `bfree` | `number` / `bigint` | Free blocks in the filesystem. |
| `bavail` | `number` / `bigint` | Free blocks available to unprivileged processes. |
| `files` | `number` / `bigint` | Total file nodes (inodes) in the filesystem. |
| `ffree` | `number` / `bigint` | Free file nodes in the filesystem. |

### Streaming File Hashing (hashFile / hashFileSync)

Calculating checksums for large files (such as weights, APKs, videos, or OTA packages) by loading entire contents into JavaScript memory can cause huge memory spikes and Out-Of-Memory (OOM) crashes. Nitro File System streams files in 64KB chunks natively on a background worker thread.

```typescript
import fs from 'react-native-nitro-file-system';

// 1. Async streaming hash (executed on background worker, no UI freeze)
const sha256 = await fs.promises.hashFile('/path/to/update.apk', 'sha256');
console.log(`SHA-256: ${sha256}`);

// 2. Sync file hash
const md5 = fs.hashFileSync('/path/to/data.bin', 'md5');

// 3. Natively supports all URI protocols (file://, content://, bookmark://, asset://)
const assetHash = await fs.promises.hashFile('asset://weights.bin', 'sha512');
```

- **Supported Algorithms**: `'md5'` | `'sha1'` | `'sha224'` | `'sha256'` | `'sha384'` | `'sha512'`.

### Recursive Copying (cp / cpSync)

The library supports high-performance recursive directory copying, matching the behavior of Node.js `fs.cp`.

```typescript
import fs from 'react-native-nitro-file-system';

// Sync recursive copy
fs.cpSync('/path/to/src', '/path/to/dest', { recursive: true, force: true });

// Async recursive copy
await fs.promises.cp('/path/to/src', '/path/to/dest', { recursive: true });
```

#### `CpOptions`

| Option | Type | Default | Description | Supported |
| :--- | :--- | :--- | :--- | :--- |
| `recursive` | `boolean` | `false` | Copy directories recursively. | ✅ |
| `force` | `boolean` | `true` | Overwrite existing files. | ✅ |
| `dereference`| `boolean` | `false` | Dereference symlinks. | ✅ |
| `errorOnExist`| `boolean` | `false` | Throw error if destination exists and `force` is false. | ✅ |
| `preserveTimestamps` | `boolean` | `false` | Preserve mtime and atime from source. | ✅ |
| `filter` | `Function`| `undefined` | Filter function for files/directories. | ❌ |
| `mode` | `number` | `0` | Modifiers for copy operation. | ❌ |

### URL-style Path Support & URI Helpers

The library provides robust support for URL-style paths and standard `URL` objects across all API methods, along with two handy conversion utilities:

- `toFileUri(path)`: Formats physical paths as valid `file://` URIs (with percent encoding for spaces/special characters) while preserving existing `file://`, `content://`, `bookmark://`, and `asset://` protocols.
- `normalizePath(uriOrPath)`: Normalizes and decodes percent-encoded URIs back into physical filesystem or protocol paths.

```typescript
import fs, { toFileUri, normalizePath } from 'react-native-nitro-file-system';

// 1. Convert path to properly encoded file:// URI
const uri = toFileUri('/tmp/my document#1.txt');
// "file:///tmp/my%20document%231.txt"

// 2. Decode URI back to physical path
const localPath = normalizePath(uri);
// "/tmp/my document#1.txt"

// 3. Directly pass URIs into all fs methods
fs.writeFileSync(uri, 'Hello world');
const text = fs.readFileSync(uri, 'utf8');
```

### Android Content URIs

The library supports Android `content://` URIs for the following operations:
- **Read/Write**: `fs.open`, `fs.read`, `fs.write`, `fs.readFile`, `fs.writeFile`.
- **Metadata**: `fs.stat`, `fs.lstat`, `fs.access` (existence check).
- **Streaming Hash**: `fs.promises.hashFile`, `fs.hashFileSync`.
- **Cleanup**: `fs.unlink`, `fs.rm`.
- **Utility**: `fs.copyFile`.

**Note**: Directory operations (`mkdir`, `readdir`, `rename`, `chmod`) are **not supported** for `content://` URIs as they represent virtual content provider resources.

```typescript
// Read directly from a content:// URI
const contentUri = 'content://com.android.providers.media.documents/document/image%3A1234';
const data = fs.readFileSync(contentUri, 'base64');

// Get file stats
const stats = fs.statSync(contentUri);
console.log(stats.size);
```

### Android & iOS Asset (asset://) Support

The library provides direct access to bundled assets via the `asset://` protocol:

- **Read-Only**: Since bundled assets are packaged as read-only, only read-related operations are supported.
- **Path format**: Use `asset://` followed by the relative path within assets or main bundle.
- **Directory Support**: You can list files in an asset directory using `fs.readdir` or **recursively copy** an entire asset directory using `fs.cp`.
- **copyFile Support**: You can use `asset://` as the **source** path in `fs.cp` and `fs.copyFile` to extract assets to other writable directories.

```typescript
import fs from 'react-native-nitro-file-system';

// Recursive copy a bundled asset directory to documents
fs.cpSync('asset://web-bundle/ruffle', `${fs.Paths.document}/ruffle`, { recursive: true });

// Copy an asset file to the documents directory
fs.copyFileSync('asset://data/db.sqlite', `${fs.Paths.document}/app.db`);

// Read a bundled configuration file
const config = fs.readFileSync('asset://config/settings.json', 'utf8');

// Check if an asset exists
if (fs.existsSync('asset://models/default.bin')) {
  const stats = fs.statSync('asset://models/default.bin');
  console.log(`Asset size: ${stats.size}`);
}
```

**Note**: `asset://` is supported on both **Android** and **iOS**:
- On **Android**, it accesses binary data directly from the APK via `AssetManager` (including `readFile`, `stat`, `access`, `readdir`, `opendir`, `open`/`read`/`readv`/`fstat`/`close`, `createReadStream`, `copyFile`, `cp`, `hashFile`, and `realpath`).
- Android `file:///android_asset/...` (and `/android_asset/...`) inputs are automatically normalized to `asset://...` by `normalizePath` and the C++ native layer, so UI/media URIs can be passed straight back into `fs` / `fs/promises` / `rnfs-compat`.
- Use `getBundleAssetUri(relPath)` or `toPlatformAssetUri(uri)` (or `Paths.bundleAssetUri`) when passing bundled asset URIs to UI/media components (`<Image>`, `expo-image`, `WebView`, video players) — on Android they produce `file:///android_asset/...`, while `Paths.bundleUri` keeps `asset://`.
- On **iOS**, `asset://` automatically maps to the app's `Main Bundle` directory.

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

---

## Native File Picker & Persistent Access

On iOS and Android, accessing files outside of the application's sandbox (like external storage, iCloud Drive, download directories, or specific folders) requires explicit user permission. Nitro File System includes a high-performance native file and directory picker with persistent access through security-scoped bookmarks (iOS) or persistable URI permissions (Android).

### Picking Files and Directories

You can import `pickFiles` / `pickDirectory` directly or access them via `fs.pickFiles` / `fs.pickDirectory`:

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

// 3. Pick a directory (returns PickedDirectory)
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

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `multiple` | `boolean` | `false` | Allow multiple file selection. |
| `mode` | `'open' \| 'import'` | `'open'` | **`'open'`**: Access file in-place (Original URI). <br> **`'import'`**: Copy file to app cache and return local cache path. |
| `extensions` | `string[]` | `undefined` | Specific file extensions to filter (e.g., `['.pdf', '.docx']`). |
| `requestLongTermAccess` | `boolean` | `false` | If `true`, Android will take persistable URI permission and iOS will return a `bookmark://` URI. Recommended for `'open'` mode. |

#### Directory Pick Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `requestLongTermAccess` | `boolean` | `false` | If `true`, Android will take persistable URI permission and iOS will return a `bookmark://` URI. |

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

- **Android**: Returns `content://` URIs in both `path` and `bookmark`. If `requestLongTermAccess` is enabled, the library automatically calls `takePersistableUriPermission` for you so access survives app reboot.
- **iOS**: Returns standard file paths in `path`. If `requestLongTermAccess` is enabled, it returns `bookmark://` URIs in `bookmark` which provide security-scoped access. These URIs are natively supported by all other `fs` methods in this library.

### iOS Security Scoped Bookmarks

When `requestLongTermAccess: true` is passed to `pickFiles` or when using `pickDirectory`, the library returns a special `bookmark://` URI on iOS. This URI embeds a security-scoped bookmark.

- **Seamless Access**: The library automatically manages security-scoped resource access (`startAccessingSecurityScopedResource`) for every `fs` call using a `bookmark://` URI without manual developer intervention.
- **Path Joining**: You can join paths with a bookmark URI (e.g., `${uri}/subdir/file.txt`), and the library will correctly resolve the path while maintaining security scoping.
- **Long-term Storage**: These URIs can be safely stored (e.g., in MMKV or AsyncStorage) and reused across app restarts.
- **Manual Bookmarks**: Use `fs.getBookmark(path)` to generate a bookmark for an existing file or directory, and `fs.resolveBookmark(bookmarkUri)` to resolve back to a physical path.

### Android Persistable URIs

On Android, `pickFiles` and `pickDirectory` return `content://` URIs. The library automatically requests persistable URI permissions when possible, ensuring the app maintains access after reboot.

- **Compatibility**: The Node.js-compatible API handles `content://` URIs for reading, writing, and directory listing.
- **SAF Tree Support**: `readdir` and `stat` are supported for directory tree URIs returned by `pickDirectory`.

---

## `react-native-fs` Compatibility Layer (`/rnfs-compat`)

To ease migration from existing `react-native-fs` codebases and third-party libraries (e.g. `react-native-ota-hot-update`, `rn-update-apk`), Nitro File System provides a drop-in compatibility subpath.

### Usage

Simply replace the import of `react-native-fs` with `react-native-nitro-file-system/rnfs-compat`:

```typescript
import RNFS from 'react-native-nitro-file-system/rnfs-compat';

// 1. Path constants
console.log(RNFS.DocumentDirectoryPath);
console.log(RNFS.CachesDirectoryPath);
console.log(RNFS.TemporaryDirectoryPath);
console.log(RNFS.MainBundlePath);

// 2. Common file & directory operations
await RNFS.mkdir(`${RNFS.DocumentDirectoryPath}/my-folder`);
await RNFS.writeFile(`${RNFS.DocumentDirectoryPath}/test.txt`, 'Hello RNFS', 'utf8');
const text = await RNFS.readFile(`${RNFS.DocumentDirectoryPath}/test.txt`, 'utf8');
const exists = await RNFS.exists(`${RNFS.DocumentDirectoryPath}/test.txt`);
const names = await RNFS.readdir(RNFS.DocumentDirectoryPath); // string[]
const items = await RNFS.readDir(RNFS.DocumentDirectoryPath); // ReadDirItem[]

// 3. Copy and Move (automatically handles EXDEV cross-device renames)
await RNFS.copyFile(`${RNFS.DocumentDirectoryPath}/test.txt`, `${RNFS.CachesDirectoryPath}/copy.txt`);
await RNFS.moveFile(`${RNFS.CachesDirectoryPath}/copy.txt`, `${RNFS.CachesDirectoryPath}/moved.txt`);

// 4. Asset copying & checking (copyFileAssets / existsAssets)
if (await RNFS.existsAssets('fonts/custom.ttf')) {
  await RNFS.copyFileAssets('fonts/custom.ttf', `${RNFS.DocumentDirectoryPath}/custom.ttf`);
}

// 5. Storage information (getFSInfo)
const { totalSpace, freeSpace } = await RNFS.getFSInfo();
console.log(`Disk space: ${freeSpace} / ${totalSpace}`);

// 6. File hashing
const md5Hash = await RNFS.hash(`${RNFS.DocumentDirectoryPath}/test.txt`, 'md5');

// 7. Remove
await RNFS.unlink(`${RNFS.DocumentDirectoryPath}/test.txt`);
```

---

## Web Platform Graceful Fallback

In Expo Web or Webpack / Metro browser bundles, `react-native-nitro-file-system` resolves to `.web.ts` fallback modules:
- Prevents runtime crashes caused by missing JSI or `NitroModules` during module initialization.
- `Paths` constants provide safe default Web fallback paths (e.g., `/web/...`).
- File I/O operations reject promises or throw clean `[NitroFS] Not supported on web platform` errors for predictable error handling.

## License

ISC
