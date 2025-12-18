# react-native-nitro-file-system

A high-performance, Node.js-compatible file system (fs) module for React Native, powered by [Nitro Modules](https://github.com/mrousavy/nitro).

## Features

- 🚀 **Extreme Performance**: Low-overhead communication via JSI and Nitro.
- 📦 **Zero-copy Binary Data**: Efficiently handle large files using `ArrayBuffer` and `NitroBuffer`.
- 🛠️ **Node.js Compatible API**: Supports `fs` methods like `readFile`, `writeFile`, `mkdir`, `stat`, and more (Sync & Async).
- 🏗️ **Streaming Support**: Built-in `ReadStream` and `WriteStream` for efficient data processing.
- 📂 **Directory & Watcher**: Support for directory iteration and file system watching.

## Installation

```sh
npm install react-native-nitro-file-system react-native-nitro-modules react-native-nitro-buffer
# or
yarn add react-native-nitro-file-system react-native-nitro-modules react-native-nitro-buffer
```

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

## License

ISC
