# react-native-nitro-file-system

一款为 React Native 打造的高性能、Node.js 兼容的文件系统（fs）模块，基于 [Nitro Modules](https://github.com/mrousavy/nitro) 构建。

## 特性

- 🚀 **极致性能**：通过 JSI 和 Nitro 实现低延迟的原生通信。
- 📦 **零拷贝二进制处理**：借助 `ArrayBuffer` 和 `NitroBuffer` 高效处理大文件，避免内存溢出。
- 🛠️ **Node.js 兼容 API**：支持 `readFile`, `writeFile`, `mkdir`, `stat` 等常用 `fs` 方法（同步与异步）。
- 🏗️ **流式支持**：内置 `ReadStream` 和 `WriteStream`，适用于大数据流处理。
- 📂 **目录与监听**：支持目录迭代查询及文件系统变更监听。
- 🌐 **URL 路径协议支持**：支持 `file://`、`bookmark://` (iOS) 和 `content://` (Android) URI。
- 🔓 **原生选择器**：内置跨平台文件与目录选择器，支持持久化访问权限。


## 与其他库的对比

| 特性 | `react-native-fs` | `expo-file-system` | `react-native-blob-util` | **Nitro File System** |
| :--- | :--- | :--- | :--- | :--- |
| **底层架构** | 传统 Bridge | Turbo Modules / Expo | Legacy Bridge / C++ | **Nitro (JSI / C++)** |
| **通信开销** | 高 (Base64/JSON) | 中 | 中 | **极低 (直接 JSI)** |
| **二进制处理** | 慢 (Base64) | 快 | 快 | **顶级 (零拷贝 Buffer)** |
| **API 风格** | 自定义 | 自定义 | 流 / 混合 | **兼容 Node.js `fs`** |
| **同步 API** | 支持较差 | 不支持 | 受限支持 | **全面支持** |

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
| **目录操作** | ✅ 100% | `mkdir`, `rmdir`, `readdir`, `rm`, `mkdtemp`, `opendir` (`Dir` 类) |
| **权限管理** | ✅ 100% | `chmod`, `fchmod`, `lchmod`, `chown`, `fchown`, `lchown` |
| **链接** | ✅ 100% | `link`, `symlink`, `readlink`, `realpath` |
| **文件监听** | ✅ 100% | `watch`, `watchFile`, `unwatchFile` |
| **流式处理** | ✅ 100% | `createReadStream`, `createWriteStream` |
| **原生选择器**| ✅ 100% | `pickFiles`, `pickDirectory` |
| **Promises** | ✅ 100% | `fs.promises.*` (全功能覆盖) |

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

### URL 路径协议支持

本库在所有 API 方法中均支持 URL 风格的路径字符串及标准 `URL` 对象。这在处理 Expo 或 React Native 组件返回的 `file://` URI 时非常有用。

- **自动解码**：路径中的百分号编码（如用 `%20` 表示空格）会被自动解码。
- **协议透明**：支持 `file://` 和 `file:/` 前缀。
- **URL 对象支持**：你可以将标准 JavaScript `URL` 对象直接传递给任何 `fs` 方法。

```typescript
import fs from 'react-native-nitro-file-system';

// 1. 使用带百分号编码的 file:// 字符串
const uri = 'file:///path/to/my%20document.txt';
fs.writeFileSync(uri, '包含空格的内容');

// 2. 直接使用标准 URL 对象
const url = new URL('file:///path/to/config.json');
const data = fs.readFileSync(url, 'utf8');

// 3. 兼容所有 API，包括流和 Promise
const promiseContent = await fs.promises.readFile(new URL('file:///path/abc.txt'));
const stream = fs.createReadStream('file:///path/to/large_file.bin');
```



### Android Content URI 支持

本库支持对 Android `content://` URI 进行以下操作：
- **读写**: `fs.open`, `fs.read`, `fs.write`, `fs.readFile`, `fs.writeFile`。
- **元数据**: `fs.stat`, `fs.lstat`, `fs.access` (检查是否存在)。
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

### 原生文件选择器 (Native Picker)

Nitro File System 内置了高性能的原生文件和目录选择器，与库的路径系统完美集成。

```typescript
import fs, { pickFiles, pickDirectory } from 'react-native-nitro-file-system';

// 1. 选择多个图片文件
const files = await pickFiles({
  multiple: true,
  extensions: ['.jpg', '.png'],
  requestLongTermAccess: true // 获取持久访问权限
});

for (const file of files) {
  console.log(`选择了: ${file.name}，路径为: ${file.path}`);
  if (file.bookmark) {
    console.log(`持久化书签: ${file.bookmark}`);
  }
  // 使用返回的路径直接读取文件
  const data = await fs.promises.readFile(file.path);
}

// 2. 选择一个目录
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

#### 选择器选项 (Pick Options)
| 选项 | 类型 | 描述 |
| :--- | :--- | :--- |
| `multiple` | `boolean` | 是否允许选择多个文件 (默认为 `false`)。仅适用于 `pickFiles`。 |
| `extensions` | `string[]` | 过滤特定的文件后缀 (例如 `['.pdf', '.docx']`)。仅适用于 `pickFiles`。 |
| `requestLongTermAccess` | `boolean` | 若为 `true`，Android 会自动获取持久化 URI 权限，iOS 则会返回 `bookmark://` URI。 |

#### 返回结果说明 (Picked Result)
- `pickFiles` 返回 `Promise<PickedFile[]>`
- `pickDirectory` 返回 `Promise<PickedDirectory>`

| 属性 | 类型 | 描述 |
| :--- | :--- | :--- |
| `path` | `string` | 文件或目录的物理路径。 |
| `bookmark` | `string` | (可选) 用于持久访问的 `bookmark://` (iOS) 或 `content://` (Android) URI。 |
| `name` | `string` | 文件显示名称 (仅限 `PickedFile`)。 |
| `size` | `number` | 文件大小，单位字节 (仅限 `PickedFile`)。 |

#### 平台差异说明
- **Android**: 在 `path` 和 `bookmark` 中均返回 `content://` URI。如果开启了 `requestLongTermAccess`，库会自动为你调用 `takePersistableUriPermission` 以确保重启后仍可访问。
- **iOS**: 在 `path` 中返回标准文件路径。如果开启了 `requestLongTermAccess`，则在 `bookmark` 中返回 `bookmark://` URI，提供安全作用域（Security-scoped）访问权限。本库的所有 `fs` 方法都原生支持这种 URI。



## 原生选择器与持久化访问

在 iOS 和 Android 上，访问应用程序沙盒之外的文件（如外部存储或特定文件夹）需要用户的显式授权。本库提供了原生选择器，并支持通过安全范围书签（iOS Security Scoped Bookmarks）或持久化 URI 权限（Android Persistable URI Permissions）来维持对这些文件的持久访问能力。

### 选取文件与目录

```typescript
import fs from 'react-native-nitro-file-system';

// 选取文件（返回 PickedFile 数组）
const files = await fs.pickFiles({
  multiple: true,
  extensions: ['.txt', '.pdf'],
  requestLongTermAccess: true    // 推荐开启，用于获取持久访问权限
});

// 选取目录（返回 PickedDirectory）
const picked = await fs.pickDirectory({
  requestLongTermAccess: true
});
console.log(picked.path);     // 物理路径
console.log(picked.bookmark); // iOS: bookmark://... | Android: content://...

// 你可以直接将返回的 bookmark 用于任何 fs 方法
const items = fs.readdirSync(picked.bookmark ?? picked.path);
```

### iOS 安全范围书签 (Security Scoped Bookmarks)

当在 `pickFiles` 中设置 `requestLongTermAccess: true` 或使用 `pickDirectory` 时，本库在 iOS 上会返回特殊的 `bookmark://` 协议 URI。该 URI 内部嵌入了安全范围书签数据。

- **无感访问**：本库会自动为每一个使用 `bookmark://` 协议的 `fs` 调用处理 `startAccessingSecurityScopedResource`，无需开发者手动管理。
- **路径拼接支持**：你可以将子路径直接拼接到书签 URI 后（例如：`${uri}/subdir/file.txt`），本库会自动解析并维持安全范围访问。
- **持久存储**：这些 URI 可以被安全地保存（如存入 MMKV）并在应用程序重启后继续使用。
- **手动生成**：可使用 `fs.getBookmark(path)` 为现有文件或目录生成书签。

### Android 持久化 URI

在 Android 上，`pickFiles` 和 `pickDirectory` 返回 `content://` URI。本库会自动尝试获取持久化 URI 权限（takePersistableUriPermission），确保应用在系统重启后仍可访问该路径。

- **全面兼容**：Node.js 兼容 API 支持直接使用 `content://` URI 进行读、写及目录列举。
- **SAF 目录树支持**：对于 `pickDirectory` 返回的目录树 URI，支持使用 `readdir` 和 `stat` 进行深度遍历。

## 许可证

ISC
