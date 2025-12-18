import { HybridObject, NitroModules } from 'react-native-nitro-modules'
import { HybridDirIterator } from './HybridDirIterator.nitro'
import { HybridFileWatcher } from './HybridFileWatcher.nitro'

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

export interface HybridFileSystem extends HybridObject<{ ios: 'c++', android: 'c++' }> {
    // Core FS operations (Phase 1)
    open(path: string, flags: number, mode: number): number;
    close(fd: number): void;
    read(fd: number, buffer: ArrayBuffer, offset: number, length: number, position: number): number;
    write(fd: number, buffer: ArrayBuffer, offset: number, length: number, position: number): number;

    access(path: string, mode: number): void;
    truncate(path: string, len: number): void;
    ftruncate(fd: number, len: number): void;
    fsync(fd: number): void;

    // Permissions & Timestamps (Phase 2)
    chmod(path: string, mode: number): void;
    fchmod(fd: number, mode: number): void;
    chown(path: string, uid: number, gid: number): void;
    lchown(path: string, uid: number, gid: number): void;
    lchmod(path: string, mode: number): void;
    fchown(fd: number, uid: number, gid: number): void;
    utimes(path: string, atime: number, mtime: number): void;
    lutimes(path: string, atime: number, mtime: number): void;
    futimes(fd: number, atime: number, mtime: number): void;

    // Links (Phase 3)
    link(existingPath: string, newPath: string): void;
    symlink(target: string, path: string): void;
    readlink(path: string): string;
    realpath(path: string): string;

    // Modern/Advanced (Phase 4)
    mkdtemp(prefix: string): string;
    rm(path: string, recursive: boolean): void;

    // Modern/Advanced (Phase 5)
    opendir(path: string): HybridDirIterator;
    watch(path: string, onChange: (event: string, path: string) => void): HybridFileWatcher;

    // Advanced FS operations (Phase 2)

    // Advanced FS operations (Phase 2)
    stat(path: string): Stats;
    lstat(path: string): Stats;
    fstat(fd: number): Stats;

    mkdir(path: string, mode: number, recursive: boolean): void;
    rmdir(path: string): void;
    readdir(path: string): string[];

    unlink(path: string): void;
    rename(oldPath: string, newPath: string): void;
    copyFile(src: string, dest: string, flags: number): void;

    readFile(path: string): ArrayBuffer;
    writeFile(path: string, buffer: ArrayBuffer): void;

    getTempPath(): string;

    // Vector I/O (Phase 7)
    readv(fd: number, buffers: ArrayBuffer[], position: number): number;
    writev(fd: number, buffers: ArrayBuffer[], position: number): number;

    // Future methods will be added here
}
