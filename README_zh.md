# react-native-nitro-file-system

一款为 React Native 打造的高性能、Node.js 兼容的文件系统（fs）模块，基于 [Nitro Modules](https://github.com/mrousavy/nitro) 构建。

## 特性

- 🚀 **极致性能**：通过 JSI 和 Nitro 实现低延迟的原生通信。
- 📦 **零拷贝二进制处理**：借助 `ArrayBuffer` 和 `NitroBuffer` 高效处理大文件，避免内存溢出。
- 🛠️ **Node.js 兼容 API**：支持 `readFile`, `writeFile`, `mkdir`, `stat` 等常用 `fs` 方法（同步与异步）。
- 🏗️ **流式支持**：内置 `ReadStream` 和 `WriteStream`，适用于大数据流处理。
- 📂 **目录与监听**：支持目录迭代查询及文件系统变更监听。

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

## 许可证

ISC
