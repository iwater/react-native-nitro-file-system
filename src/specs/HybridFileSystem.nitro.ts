import { HybridObject, NitroModules } from 'react-native-nitro-modules'
import { HybridDirIterator } from './HybridDirIterator.nitro'
import { HybridFileWatcher } from './HybridFileWatcher.nitro'

export type PickerMode = 'open' | 'import'

export interface FilePickerOptions {
    multiple?: boolean;
    extensions?: string[];
    requestLongTermAccess?: boolean;
    mode?: PickerMode;
}

export interface DirectoryPickerOptions {
    requestLongTermAccess?: boolean;
}

export interface PickedFile {
    path: string;
    uri: string;
    name: string;
    size: number;
    type?: string;
    bookmark?: string;
}

export interface Stats {
    dev: number;
    ino: number;
    mode: number;
    nlink: number;
    uid: number;
    gid: number;
    rdev: number;
    size: number;
    blksize: number;
    blocks: number;
    atimeMs: number;
    mtimeMs: number;
    ctimeMs: number;
    birthtimeMs: number;
}

export interface PickedDirectory {
    path: string;
    uri: string;
    bookmark?: string;
}

export interface HybridFileSystem extends HybridObject<{ ios: 'c++', android: 'c++' }> {
    // Core FS operations
    open(path: string, flags: number, mode: number): number;
    close(fd: number): void;
    read(fd: number, buffer: ArrayBuffer, offset: number, length: number, position: number): number;
    write(fd: number, buffer: ArrayBuffer, offset: number, length: number, position: number): number;

    access(path: string, mode: number): void;
    truncate(path: string, len: number): void;
    ftruncate(fd: number, len: number): void;
    fsync(fd: number): void;

    // Permissions & Timestamps
    chmod(path: string, mode: number): void;
    fchmod(fd: number, mode: number): void;
    chown(path: string, uid: number, gid: number): void;
    lchown(path: string, uid: number, gid: number): void;
    lchmod(path: string, mode: number): void;
    fchown(fd: number, uid: number, gid: number): void;
    utimes(path: string, atime: number, mtime: number): void;
    lutimes(path: string, atime: number, mtime: number): void;
    futimes(fd: number, atime: number, mtime: number): void;

    // Links
    link(existingPath: string, newPath: string): void;
    symlink(target: string, path: string): void;
    readlink(path: string): string;
    realpath(path: string): string;

    // Modern/Advanced
    mkdtemp(prefix: string): string;
    rm(path: string, recursive: boolean): void;

    // Modern/Advanced
    opendir(path: string): HybridDirIterator;
    watch(path: string, onChange: (event: string, path: string) => void): HybridFileWatcher;

    // Advanced FS operations
    stat(path: string): Stats;
    lstat(path: string): Stats;
    fstat(fd: number): Stats;

    mkdir(path: string, mode: number, recursive: boolean): void;
    rmdir(path: string): void;
    readdir(path: string): string[];

    unlink(path: string): void;
    rename(oldPath: string, newPath: string): void;
    copyFile(src: string, dest: string, flags: number): void;
    cp(src: string, dest: string, recursive: boolean, force: boolean, dereference: boolean, errorOnExist: boolean, preserveTimestamps: boolean): void;

    readFile(path: string): ArrayBuffer;
    writeFile(path: string, buffer: ArrayBuffer): void;

    // Persistence
    getBookmark(path: string): string;
    resolveBookmark(bookmark: string): string;
    getTempPath(): string;

    // Vector I/O
    readv(fd: number, buffers: ArrayBuffer[], position: number): number;
    writev(fd: number, buffers: ArrayBuffer[], position: number): number;

    // Picker API
    pickFiles(options: FilePickerOptions): Promise<PickedFile[]>;
    pickDirectory(options?: DirectoryPickerOptions): Promise<PickedDirectory>;

    // Path constants (getters)
    readonly cachesDirectoryPath: string;
    readonly documentDirectoryPath: string;
    readonly downloadDirectoryPath: string;
    readonly externalCachesDirectoryPath: string;
    readonly externalDirectoryPath: string;
    readonly externalStorageDirectoryPath: string;
    readonly libraryDirectoryPath: string;
    readonly mainBundlePath: string;
    readonly picturesDirectoryPath: string;
    readonly temporaryDirectoryPath: string;
    readonly fileProtectionKeys: Record<string, string>;

    // errno of the most recent failed native call (0 if the last one
    // succeeded). The JS layer turns it into a Node-style error carrying
    // `code` / `errno` / `syscall` / `path`, so that `err.code === 'ENOENT'`
    // works the way it does in Node.
    readonly lastErrno: number;

    // POSIX name of `lastErrno` ("ENOENT", "EACCES", ...), or "" when the last
    // native call did not fail. Resolved against the platform's own errno
    // constants on the native side: the numbers behind these names differ
    // between Darwin and Linux (`ENOTEMPTY` is 66 vs 39, `ELOOP` 62 vs 40, ...),
    // so a JS-side table would be wrong on one of them.
    readonly lastErrorCode: string;

    // The platform's own `O_*` values, in the field order of the native
    // `RNOpenFlags` struct:
    //   O_RDONLY, O_WRONLY, O_RDWR, O_CREAT, O_EXCL, O_NOCTTY, O_TRUNC,
    //   O_APPEND, O_DIRECTORY, O_NOATIME, O_NOFOLLOW, O_SYNC, O_DSYNC,
    //   O_SYMLINK, O_DIRECT, O_NONBLOCK
    // A negative entry means the platform has no such flag; the JS layer then
    // omits that key, matching Node's `fs.constants` on that platform.
    //
    // Reported from the native side rather than hardcoded in JS so that
    // `fs.constants` can never drift from the numbers `rn_fs_open` interprets.
    readonly openFlagValues: number[];
}

