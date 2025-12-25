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

## 许可证

ISC
