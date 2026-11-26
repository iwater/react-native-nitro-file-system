# react-native-nitro-file-system

一款为 React Native 打造的高性能、Node.js 兼容的文件系统（fs）模块，基于 [Nitro Modules](https://github.com/mrousavy/nitro) 构建。

[![license](https://img.shields.io/badge/license-ISC-blue.svg)](https://github.com/iwater/rn-http-server/blob/main/LICENSE)
[![platform](https://img.shields.io/badge/platform-ios%20%7C%20android%20%7C%20macos%20%7C%20web-lightgrey.svg)]()
[![compatibility](https://img.shields.io/badge/Node.js-100%25%20fs-green.svg)]()
[English Documentation](./README.md)

## 特性

- 🚀 **极致性能**：通过 JSI 和 Nitro 实现低延迟的原生通信。
- 📦 **零拷贝二进制处理**：借助 `ArrayBuffer` 和 `NitroBuffer` 高效处理大文件，避免内存溢出。
- 🛠️ **Node.js 兼容 API**：支持 `readFile`, `writeFile`, `mkdir`, `stat` 等常用 `fs` 方法（同步与异步）。
- 🏗️ **流式支持**：内置 `ReadStream` 和 `WriteStream`，适用于大数据流处理。
- 📂 **目录与监听**：支持目录迭代查询及文件系统变更监听。
- 🌐 **URL 路径协议支持**：支持 `file://`、`bookmark://` (iOS)、`content://` (Android) 和 `asset://` URI，并提供 `toFileUri` / `normalizePath` 辅助。
- 💾 **磁盘空间查询**：提供与 Node.js 18.15+ 一致的 `statfs` / `statfsSync`，以及 `Paths.availableDiskSpace` / `Paths.totalDiskSpace` 属性。
- ⚡ **流式文件哈希**：支持 `promises.hashFile` 与 `hashFileSync`（`md5`, `sha1`, `sha256`, `sha512` 等），底层后台流式分块计算，不占用 JS 堆内存。
- 🔄 **`react-native-fs` 兼容层**：提供 `react-native-nitro-file-system/rnfs-compat` 子路径，支持平滑迁移老旧项目及依赖库。
- 🌍 **Web 优雅降级**：内置 Web 平台桩实现，确保 Expo Web / Metro Web 打包不崩溃。
- 🔓 **原生选择器**：内置跨平台文件与目录选择器，支持持久化访问权限。

## 与其他库的对比

| 特性 | `react-native-fs` | `expo-file-system` | `react-native-blob-util` | **Nitro File System** |
| :--- | :--- | :--- | :--- | :--- |
| **底层架构** | 传统 Bridge | Turbo Modules / Expo | Legacy Bridge / C++ | **Nitro (JSI / C++)** |
| **通信开销** | 高 (Base64/JSON) | 中 | 中 | **极低 (直接 JSI)** |
| **二进制处理** | 慢 (Base64) | 快 | 快 | **顶级 (零拷贝 Buffer)** |
| **API 风格** | 自定义 | 自定义 | 流 / 混合 | **兼容 Node.js `fs`** |
| **同步 API** | 支持较差 | 不支持 | 受限支持 | **全面支持** |
| **磁盘空间 (statfs)**| 仅可用空间 | 部分支持 | 不支持 | **Node.js `statfs` + 扩展属性** |
| **流式哈希** | 仅常用算法 | 有限支持 | 不支持 | **底层分块流式哈希 (不占 JS 内存)** |
| **RNFS 兼容层** | 原生本身 | 无 | 无 | **内置兼容子路径 (`/rnfs-compat`)** |
| **Web 平台** | 不支持 | 支持 | 不支持 | **内置安全降级桩** |

## 安装

```sh
npm install react-native-nitro-file-system react-native-nitro-modules react-native-nitro-buffer
# 或
yarn add react-native-nitro-file-system react-native-nitro-modules react-native-nitro-buffer
```

## API 兼容性表

| 类别 | 状态 | 支持的方法 |
| :--- | :--- | :--- |
| **文件 I/O** | ✅ 100% | `open`, `read`, `write`, `close`, `readFile`, `writeFile`, `appendFile`, `truncate`, `fsync`, `readv`, `writev` |
| **元数据** | ✅ 100% | `stat`, `lstat`, `fstat`, `access`, `utimes`, `futimes`, `lutimes` (支持 `bigint`) |
| **磁盘与空间** | ✅ 100% | `statfs`, `statfsSync`, `fs.promises.statfs` (支持 `bigint`) |
| **目录操作** | ✅ 100% | `mkdir`, `rmdir`, `readdir`, `rm`, `mkdtemp`, `opendir` (`Dir` 类), `cp` |
| **权限管理** | ✅ 100% | `chmod`, `fchmod`, `lchmod`, `chown`, `fchown`, `lchown` |
| **链接** | ✅ 100% | `link`, `symlink`, `readlink`, `realpath` |
| **文件哈希** | ✅ 100% | `hashFileSync`, `fs.promises.hashFile` (流式无阻塞) |
| **文件监听** | ✅ 100% | `watch`, `watchFile`, `unwatchFile` |
| **流式处理** | ✅ 100% | `createReadStream`, `createWriteStream` |
| **原生选择器**| ✅ 100% | `pickFiles`, `pickDirectory` (支持持久化权限与安全书签) |
| **兼容层** | ✅ 100% | `react-native-nitro-file-system/rnfs-compat` (`RNFS` 全套主流 API) |
| **Promises** | ✅ 100% | `fs.promises.*` (全功能覆盖) |

## 标准路径 (Paths)

本库提供了一个 `Paths` 对象，包含了一系列常用的跨平台系统目录路径以及对应的标准 URI。

```typescript
import { Paths } from 'react-native-nitro-file-system';

// 物理路径
console.log(Paths.cache);           // 应用缓存目录 (Caches)
console.log(Paths.document);        // 应用文档目录 (Documents)
console.log(Paths.temp);            // 系统临时目录 (Temporary)
console.log(Paths.library);         // (iOS) 库目录 (Library)
console.log(Paths.mainBundle);      // (iOS) App Bundle 目录
console.log(Paths.externalCache);   // (Android) 外部缓存目录
console.log(Paths.externalStorage); // (Android) 外部存储根目录

// 标准 URI 格式 (以 file:/// 开头，或 Android asset://)
console.log(Paths.bundleUri);        // iOS: file:///.../MyApp.app/ | Android: asset://
console.log(Paths.bundleAssetUri);   // iOS: file:///.../MyApp.app/ | Android: file:///android_asset/
console.log(Paths.documentUri);      // file:///.../Documents
console.log(Paths.cacheUri);         // file:///.../Caches
console.log(Paths.tempUri);          // file:///.../tmp

// 快捷磁盘空间查询（非枚举 Getter 属性，按需触发）
console.log(Paths.availableDiskSpace); // 可用磁盘空间（字节）
console.log(Paths.totalDiskSpace);     // 总磁盘空间（字节）
```

| 属性名 | 支持平台 | 描述 |
| :--- | :--- | :--- |
| `cache` | 全平台 | 应用程序专用缓存目录的绝对物理路径。 |
| `document` | 全平台 | 应用程序专用文档目录的绝对物理路径。 |
| `temp` | 全平台 | 系统临时目录的绝对物理路径。 |
| `download` | 全平台 | 下载目录的绝对物理路径。 |
| `pictures` | 全平台 | 图片目录的绝对物理路径。 |
| `library` | iOS | `NSLibraryDirectory` 的绝对物理路径。 |
| `mainBundle` | iOS | 应用程序主资源包 (Main Bundle) 的绝对物理路径。 |
| `externalCache` | Android | 外部缓存目录的绝对物理路径。 |
| `external` | Android | 外部文件目录的绝对物理路径。 |
| `externalStorage`| Android | 外部存储根目录的绝对物理路径。 |
| `bundleUri` | 全平台 | Bundle 资源的 URI 格式（iOS 为 `file://...`，Android 为 `asset://`）。 |
| `bundleAssetUri` | 全平台 | 供 UI/媒体组件直接消费的 Bundle URI（iOS 为 `file://...`，Android 为 `file:///android_asset/`）。 |
| `documentUri` | 全平台 | 文档目录的标准 `file://` URI。 |
| `cacheUri` | 全平台 | 缓存目录的标准 `file://` URI。 |
| `tempUri` | 全平台 | 临时目录的标准 `file://` URI。 |
| `availableDiskSpace` | 全平台 | 当前设备挂载分区的剩余可用字节数（只读 Getter）。 |
| `totalDiskSpace` | 全平台 | 当前设备挂载分区的总容量字节数（只读 Getter）。 |

## 基础用法

### 读写文件

```typescript
import fs from 'react-native-nitro-file-system';

// 同步写入文件
fs.writeFileSync('/path/to/file.txt', '你好 Nitro!');

// 异步读取文件
fs.readFile('/path/to/file.txt', 'utf8', (err, data) => {
  if (err) throw err;
  console.log(data); // "你好 Nitro!"
});

// 使用 Promise
const content = await fs.promises.readFile('/path/to/file.txt', 'utf8');
```

### 磁盘空间查询 (statfs / statfsSync)

本库完全实现了 Node.js 18.15+ 的 `fs.statfs` 标准，并扩充了便捷的容量计算字段。

```typescript
import fs from 'react-native-nitro-file-system';

// 1. 同步获取指定路径所在文件系统空间
const info = fs.statfsSync(fs.Paths.document);
console.log(`总空间: ${info.totalBytes} 字节`);
console.log(`可用空间: ${info.availableBytes} 字节`);
console.log(`空闲空间: ${info.freeBytes} 字节`);
console.log(`文件系统块大小: ${info.bsize}`);

// 2. 支持 bigint: true 避免大容量设备整数溢出
const bigInfo = fs.statfsSync('/', { bigint: true });
console.log(bigInfo.totalBytes); // 1000204886016n

// 3. Promise 异步调用
const asyncInfo = await fs.promises.statfs(fs.Paths.cache);
```

#### `StatFs` 返回结构说明

| 字段 | 类型 | 说明 |
| :--- | :--- | :--- |
| `totalBytes` | `number` / `bigint` | 分区总容量（字节）。 |
| `availableBytes` | `number` / `bigint` | 普通非特权用户可写入的剩余空间（字节）。 |
| `freeBytes` | `number` / `bigint` | 系统全部空闲空间（包含管理员预留空间，字节）。 |
| `bsize` | `number` / `bigint` | 文件系统块大小（Block size）。 |
| `blocks` | `number` / `bigint` | 文件系统的总块数。 |
| `bfree` | `number` / `bigint` | 空闲块数。 |
| `bavail` | `number` / `bigint` | 非特权用户可用的空闲块数。 |
| `files` | `number` / `bigint` | 文件节点（Inode）总数。 |
| `ffree` | `number` / `bigint` | 空闲文件节点数。 |

### 高性能流式文件哈希 (hashFile / hashFileSync)

计算大文件（如模型、视频、OTA 升级包）的 MD5 或 SHA256 摘要时，若先读入 JavaScript 内存再计算会导致内存峰值甚至 OOM。Nitro File System 在 C++ 原生层通过 64KB 分块流式读取直接计算摘要，性能极高。

```typescript
import fs from 'react-native-nitro-file-system';

// 1. 异步计算（在原生后台工作线程流式执行，零主线程卡顿）
const sha256 = await fs.promises.hashFile('/path/to/update.apk', 'sha256');
console.log(`SHA-256: ${sha256}`);

// 2. 同步计算
const md5 = fs.hashFileSync('/path/to/data.bin', 'md5');

// 3. 原生支持所有 URI 协议 (file://, content://, bookmark://, asset://)
const assetHash = await fs.promises.hashFile('asset://weights.bin', 'sha512');
```

- **支持算法**：`'md5'` | `'sha1'` | `'sha224'` | `'sha256'` | `'sha384'` | `'sha512'`。

### 递归复制 (cp / cpSync)

本库支持高性能的递归目录复制，行为与 Node.js 的 `fs.cp` 一致。

```typescript
import fs from 'react-native-nitro-file-system';

// 同步递归复制
fs.cpSync('/path/to/src', '/path/to/dest', { recursive: true, force: true });

// 异步递归复制 (Promise)
await fs.promises.cp('/path/to/src', '/path/to/dest', { recursive: true });
```

#### `CpOptions` 参数说明

| 选项 | 类型 | 默认值 | 描述 | 支持状态 |
| :--- | :--- | :--- | :--- | :--- |
| `recursive` | `boolean` | `false` | 是否递归复制目录。 | ✅ |
| `force` | `boolean` | `true` | 是否覆盖已存在的文件。 | ✅ |
| `dereference`| `boolean` | `false` | 是否解引用符号链接（复制实际文件）。 | ✅ |
| `errorOnExist`| `boolean` | `false` | 当 `force` 为 false 且目标已存在时抛出错误。 | ✅ |
| `preserveTimestamps` | `boolean` | `false` | 是否保留源文件的修改时间与访问时间。 | ✅ |
| `filter` | `Function`| `undefined` | 过滤函数（因性能考虑暂不支持）。 | ❌ |
| `mode` | `number` | `0` | 复制操作的修饰符。 | ❌ |

### URL 路径协议与 URI 辅助函数

本库在所有 API 方法中均支持 URL 风格的路径字符串及标准 `URL` 对象，并导出便捷的转换工具：

- `toFileUri(path)`：将普通路径转为标准 `file://` URI（若已是 `file://`、`content://`、`bookmark://`、`asset://` 则安全保持），并对空格及中文执行标准百分号编码。
- `normalizePath(uriOrPath)`：将任意协议 URI 或带有编码的 URI 还原为底层可操作路径。

```typescript
import fs, { toFileUri, normalizePath } from 'react-native-nitro-file-system';

// 1. 编码 URI 转换
const uri = toFileUri('/tmp/我的 文档#1.txt');
// "file:///tmp/%E6%88%91%E7%9A%84%20%E6%96%87%E6%A1%A3%231.txt"

// 2. 将编码 URI 还原回文件路径
const localPath = normalizePath(uri);
// "/tmp/我的 文档#1.txt"

// 3. 所有 fs 读写方法均原生支持直接传入上述 URI
fs.writeFileSync(uri, '你好世界');
const text = fs.readFileSync(uri, 'utf8');
```

### Android Content URI 支持

本库支持对 Android `content://` URI 进行以下操作：
- **读写**: `fs.open`, `fs.read`, `fs.write`, `fs.readFile`, `fs.writeFile`。
- **元数据**: `fs.stat`, `fs.lstat`, `fs.access` (检查是否存在)。
- **哈希摘要**: `fs.promises.hashFile`, `fs.hashFileSync`。
- **清理**: `fs.unlink`, `fs.rm`。
- **实用工具**: `fs.copyFile`。

**注意**: 目录类操作 (`mkdir`, `readdir`, `rename`, `chmod`) **不支持** `content://` URI，因为它们代表虚拟资源而非物理文件系统路径。

```typescript
// 直接读取 content:// URI
const contentUri = 'content://com.android.providers.media.documents/document/image%3A1234';
const data = fs.readFileSync(contentUri, 'base64');

// 获取文件信息
const stats = fs.statSync(contentUri);
console.log(stats.size);
```

### Android / iOS Assets (asset://) 支持

本库支持通过 `asset://` 协议直接访问 Android 的 `assets` 目录或 iOS 的应用资源包（Main Bundle）：

- **仅限读取**：由于应用内置包是只读打包的，因此仅支持读取类操作。
- **路径格式**：使用 `asset://` 后接相对于 assets 或 bundle 根目录的路径。
- **目录支持**：支持通过 `fs.readdir` 列出资产目录，或使用 `fs.cp` **递归复制**整个资产目录。
- **copyFile 支持**：支持在 `fs.cp` 和 `fs.copyFile` 中将 `asset://` 作为**源路径**（source），方便将内置资源释放到可写目录。
- **全链路兼容**：Android 侧同时支持 `asset://...` 与 `file:///android_asset/...`（含 `/android_asset/...`）入参（覆盖 `readFile`、`stat`、`access`、`readdir`、`opendir`、`open`/`read`/`readv`/`fstat`/`close`、`createReadStream`、`copyFile`、`cp`、`hashFile`、`realpath`）。
- **UI/媒体 URI 导出**：`Paths.bundleUri` 在 Android 上保持 `asset://` 契约不变；传给 `<Image>` / `expo-image` / `WebView` / 音视频组件时，可使用 `Paths.bundleAssetUri`、`getBundleAssetUri(relPath)` 或 `toPlatformAssetUri(uri)` 获取 Android `file:///android_asset/...` / iOS `file:///.../MyApp.app/...` 形式，且该返回值可直接回传 `fs` 读取。

```typescript
import fs from 'react-native-nitro-file-system';

// 递归复制内置资产目录到文档目录
fs.cpSync('asset://web-bundle/ruffle', `${fs.Paths.document}/ruffle`, { recursive: true });

// 将内置数据库拷贝到文档目录
fs.copyFileSync('asset://data/db.sqlite', `${fs.Paths.document}/app.db`);

// 读取打包在 assets 里的配置文件
const config = fs.readFileSync('asset://config/settings.json', 'utf8');

// 检查某个 asset 是否存在并获取信息
if (fs.existsSync('asset://models/default.bin')) {
  const stats = fs.statSync('asset://models/default.bin');
  console.log(`资源大小: ${stats.size}`);
}
```

### iOS 书签 (Bookmark) 支持

内置对 iOS `bookmark://` URI 的原生支持，允许持久化访问安全范围内的资源（如通过文档选择器选择的 iCloud Drive 文件），无需进行文件拷贝。

```typescript
import fs, { getBookmark, resolveBookmark } from 'react-native-nitro-file-system';

// 1. 将物理路径转换为书签
const bookmark = getBookmark('/path/to/file');

// 2. 使用书签 URI 直接访问
const stat = await fs.promises.stat(bookmark);
const content = await fs.promises.readFile(bookmark);

// 3. 将书签解析回物理路径
const path = resolveBookmark(bookmark);
console.log(path); // "/path/to/file"
```

---

## 原生文件选择器与持久化访问 (Native Picker & Persistent Access)

在 iOS 和 Android 上，访问应用程序沙盒之外的文件（如外部存储、iCloud Drive、下载目录或特定文件夹）需要用户的显式授权。Nitro File System 内置了高性能的跨平台原生文件和目录选择器，支持通过安全范围书签（iOS Security Scoped Bookmarks）或持久化 URI 权限（Android Persistable URI Permissions）维持长久访问能力，与库内部路径体系无缝打通。

### 选取文件与目录

你可以直接从包中导入 `pickFiles` / `pickDirectory`，或通过 `fs.pickFiles` / `fs.pickDirectory` 调用：

```typescript
import fs, { pickFiles, pickDirectory } from 'react-native-nitro-file-system';

// 1. 选取并导入多个图片 (复制到应用缓存)
const importedFiles = await pickFiles({
  multiple: true,
  mode: 'import',
  extensions: ['.jpg', '.png']
});

for (const file of importedFiles) {
  console.log(`已导入到缓存: ${file.path}`);
  // 导入模式会自动将文件拷入应用缓存目录，无需请求持久访问权限
}

// 2. 原位打开文件 (获取持久访问权限)
const openedFiles = await pickFiles({
  multiple: true,
  mode: 'open',
  requestLongTermAccess: true 
});

for (const file of openedFiles) {
  console.log(`资源物理路径: ${file.path}`);
  if (file.bookmark) {
    console.log(`持久化书签: ${file.bookmark}`);
  }
}

// 3. 选择一个外部目录
const picked = await pickDirectory({
  requestLongTermAccess: true
});
console.log(`选中的目录物理路径: ${picked.path}`);
if (picked.bookmark) {
  console.log(`持久化书签: ${picked.bookmark}`);
}

// 列出选中目录下的文件 (可以使用 path 或 bookmark)
const entries = await fs.promises.readdir(picked.bookmark ?? picked.path);
console.log(entries);
```

#### 文件选择器选项 (File Pick Options)

| 选项 | 类型 | 默认值 | 描述 |
| :--- | :--- | :--- | :--- |
| `multiple` | `boolean` | `false` | 是否允许选择多个文件。 |
| `mode` | `'open' \| 'import'` | `'open'` | **`'open'`**：原位访问 (原始 URI)。<br> **`'import'`**：将文件复制到应用缓存并返回本地缓存物理路径。 |
| `extensions` | `string[]` | `undefined` | 过滤特定的文件扩展名 (例如 `['.pdf', '.docx']`)。 |
| `requestLongTermAccess` | `boolean` | `false` | 若为 `true`，Android 会自动获取持久化 URI 权限，iOS 则会在 `bookmark` 中返回 `bookmark://` URI。推荐在 `'open'` 模式下开启。 |

#### 目录选择器选项 (Directory Pick Options)

| 选项 | 类型 | 默认值 | 描述 |
| :--- | :--- | :--- | :--- |
| `requestLongTermAccess` | `boolean` | `false` | 若为 `true`，Android 会自动获取持久化 URI 权限，iOS 则会在 `bookmark` 中返回 `bookmark://` URI。 |

#### 返回结果说明 (Picked Result)

- `pickFiles` 返回 `Promise<PickedFile[]>`
- `pickDirectory` 返回 `Promise<PickedDirectory>`

| 属性 | 类型 | 描述 |
| :--- | :--- | :--- |
| `path` | `string` | 文件或目录的物理路径。 |
| `uri` | `string` | 标准 URI (如 `file:///...` 或 `content://...`)，方便与其他库互操作。 |
| `bookmark` | `string` | (可选) 用于持久访问的 `bookmark://` (iOS) 或 `content://` (Android) URI。 |
| `name` | `string` | 文件显示名称 (仅限 `PickedFile`)。 |
| `size` | `number` | 文件大小，单位字节 (仅限 `PickedFile`)。 |

#### 平台差异说明

- **Android**: 在 `path` 和 `bookmark` 中均返回 `content://` URI。如果开启了 `requestLongTermAccess`，库会自动调用 `takePersistableUriPermission` 以确保应用重启后仍可访问。
- **iOS**: 在 `path` 中返回标准文件路径。如果开启了 `requestLongTermAccess`，则在 `bookmark` 中返回 `bookmark://` URI，提供安全作用域（Security-scoped）访问权限。本库的所有 `fs` 方法都原生支持这种 URI。

### iOS 安全范围书签 (Security Scoped Bookmarks)

当在 `pickFiles` 中设置 `requestLongTermAccess: true` 或使用 `pickDirectory` 时，本库在 iOS 上会返回特殊的 `bookmark://` 协议 URI。该 URI 内部嵌入了安全范围书签数据。

- **无感访问**：本库会自动为每一个使用 `bookmark://` 协议的 `fs` 调用处理 `startAccessingSecurityScopedResource`，无需开发者手动管理。
- **路径拼接支持**：你可以将子路径直接拼接到书签 URI 后（例如：`${uri}/subdir/file.txt`），本库会自动解析并维持安全范围访问。
- **持久存储**：这些 URI 可以被安全地保存（如存入 MMKV）并在应用程序重启后继续使用。
- **手动生成与解析**：可使用 `getBookmark(path)` 为现有文件或目录生成书签，或使用 `resolveBookmark(bookmarkUri)` 将书签解析回物理路径。

### Android 持久化 URI (Persistable URIs)

在 Android 上，`pickFiles` 和 `pickDirectory` 返回 `content://` URI。本库会自动尝试获取持久化 URI 权限（`takePersistableUriPermission`），确保应用在系统重启后仍可访问该路径。

- **全面兼容**：Node.js 兼容 API 支持直接使用 `content://` URI 进行读、写及目录列举。
- **SAF 目录树支持**：对于 `pickDirectory` 返回的目录树 URI，支持使用 `readdir` 和 `stat` 进行深度遍历。

---

## `react-native-fs` 兼容层 (`/rnfs-compat`)

为便于现有工程快速平滑迁移，或在项目中适配依赖 `react-native-fs` 的三方组件（例如 `react-native-ota-hot-update`、`rn-update-apk` 等），本库提供了完全兼容 `react-native-fs` 常用接口的子路径。

### 使用方法

将原项目中的 `react-native-fs` 替换为 `react-native-nitro-file-system/rnfs-compat` 即可：

```typescript
import RNFS from 'react-native-nitro-file-system/rnfs-compat';

// 1. 目录常量
console.log(RNFS.DocumentDirectoryPath);
console.log(RNFS.CachesDirectoryPath);
console.log(RNFS.TemporaryDirectoryPath);
console.log(RNFS.MainBundlePath);

// 2. 常用文件与目录操作
await RNFS.mkdir(`${RNFS.DocumentDirectoryPath}/my-folder`);
await RNFS.writeFile(`${RNFS.DocumentDirectoryPath}/test.txt`, 'Hello RNFS', 'utf8');
const text = await RNFS.readFile(`${RNFS.DocumentDirectoryPath}/test.txt`, 'utf8');
const exists = await RNFS.exists(`${RNFS.DocumentDirectoryPath}/test.txt`);
const names = await RNFS.readdir(RNFS.DocumentDirectoryPath); // string[]
const items = await RNFS.readDir(RNFS.DocumentDirectoryPath); // ReadDirItem[]

// 3. 复制与移动 (跨文件系统自动处理)
await RNFS.copyFile(`${RNFS.DocumentDirectoryPath}/test.txt`, `${RNFS.CachesDirectoryPath}/copy.txt`);
await RNFS.moveFile(`${RNFS.CachesDirectoryPath}/copy.txt`, `${RNFS.CachesDirectoryPath}/moved.txt`);

// 4. Asset 资源复制与探测 (copyFileAssets / existsAssets)
if (await RNFS.existsAssets('fonts/custom.ttf')) {
  await RNFS.copyFileAssets('fonts/custom.ttf', `${RNFS.DocumentDirectoryPath}/custom.ttf`);
}

// 5. 存储空间查询 (getFSInfo)
const { totalSpace, freeSpace } = await RNFS.getFSInfo();
console.log(`设备空间: ${freeSpace} / ${totalSpace}`);

// 6. 文件哈希
const md5Hash = await RNFS.hash(`${RNFS.DocumentDirectoryPath}/test.txt`, 'md5');

// 7. 删除
await RNFS.unlink(`${RNFS.DocumentDirectoryPath}/test.txt`);
```

---

## Web 平台优雅降级

在 Expo Web 或基于 Webpack / Metro 构建的 Web 环境中，`react-native-nitro-file-system` 会自动命中 `.web.ts` 降级实现：
- 模块引入期不会因为缺失 JSI 或 `NitroModules` 而抛错崩溃；
- `Paths` 提供合法的 Web 安全路径常量（以 `/web/...` 为桩）；
- 涉及具体物理文件读写的方法在被调用时会以 `[NitroFS] Not supported on web platform` 错误拒绝 Promise 或抛出异常，便于业务代码通过 `try/catch` 或平台判断进行统一处理。

## 许可证

ISC
