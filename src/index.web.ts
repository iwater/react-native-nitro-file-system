import type { Buffer } from 'react-native-nitro-buffer';
import type { ReadableOptions, WritableOptions } from 'stream';
import type {
    StatFs,
    FilePickerOptions,
    DirectoryPickerOptions,
    PickedFile,
    PickedDirectory,
} from './specs/HybridFileSystem.nitro';
import type {
    PathLike,
    HashAlgorithm,
    DiskSpaceInfo,
    BigIntStatFs,
    NitroPaths,
    FsConstants,
    ReadOptions,
    RmOptions,
    CpOptions,
    RmdirOptions,
    StatOptions,
} from './shared';
import {
    Stats,
    BigIntStats,
    Dirent,
    POSIX_MODE_AND_ACCESS_CONSTANTS,
    getFlagsFromConstants,
    normalizePath,
    toFileUri,
} from './shared';
import { warnWebOnce, webNotSupportedError } from './native.web';

export {
    Stats,
    BigIntStats,
    Dirent,
    normalizePath,
    toFileUri,
};
export type {
    FilePickerOptions,
    DirectoryPickerOptions,
    PickedFile,
    PickedDirectory,
    StatFs,
    PathLike,
    HashAlgorithm,
    DiskSpaceInfo,
    BigIntStatFs,
    NitroPaths,
    FsConstants,
    ReadOptions,
    RmOptions,
    CpOptions,
    RmdirOptions,
    StatOptions,
};

export interface ReadStreamOptions extends ReadableOptions {
    flags?: string;
    encoding?: BufferEncoding;
    fd?: number;
    mode?: number;
    autoClose?: boolean;
    emitClose?: boolean;
    start?: number;
    end?: number;
    highWaterMark?: number;
}

export interface WriteStreamOptions extends WritableOptions {
    flags?: string;
    encoding?: BufferEncoding;
    fd?: number;
    mode?: number;
    autoClose?: boolean;
    emitClose?: boolean;
    start?: number;
    flush?: boolean;
}

export type WatchEventType = 'rename' | 'change';
export type WatchListener = (eventType: WatchEventType, filename: string | Buffer) => void;

export const constants: FsConstants = {
    O_RDONLY: 0,
    O_WRONLY: 1,
    O_RDWR: 2,
    O_CREAT: 64,
    O_EXCL: 128,
    O_NOCTTY: 256,
    O_TRUNC: 512,
    O_APPEND: 1024,
    O_DIRECTORY: 65536,
    O_NOFOLLOW: 131072,
    O_SYNC: 1052672,
    O_DSYNC: 4096,
    O_NONBLOCK: 2048,
    ...POSIX_MODE_AND_ACCESS_CONSTANTS,
};

export const FileProtectionKeys: Record<string, string> = {};
export const bundleUri: string = '';

export const Paths: NitroPaths = {
    cache: '',
    document: '',
    download: '',
    externalCache: '',
    external: '',
    externalStorage: '',
    library: '',
    mainBundle: '',
    pictures: '',
    temp: '',
    bundleUri: '',
    documentUri: '',
    cacheUri: '',
    tempUri: '',
} as NitroPaths;

Object.defineProperties(Paths, {
    availableDiskSpace: {
        enumerable: false,
        configurable: true,
        get(): number {
            return 0;
        },
    },
    totalDiskSpace: {
        enumerable: false,
        configurable: true,
        get(): number {
            return 0;
        },
    },
});

export function getFlags(flag: string | number | undefined): number {
    return getFlagsFromConstants(constants, flag);
}

function scheduleAsync(fn: () => void): void {
    if (typeof queueMicrotask === 'function') {
        queueMicrotask(fn);
    } else {
        setTimeout(fn, 0);
    }
}

function throwWebUnsupported(): never {
    warnWebOnce();
    throw webNotSupportedError();
}

function rejectWeb<T = never>(): Promise<T> {
    warnWebOnce();
    return Promise.reject(webNotSupportedError());
}

function callbackWebError(args: unknown[]): void {
    warnWebOnce();
    for (let i = args.length - 1; i >= 0; i--) {
        if (typeof args[i] === 'function') {
            const cb = args[i] as (err: Error) => void;
            scheduleAsync(() => cb(webNotSupportedError()));
            return;
        }
    }
}

class WebEventEmitter {
    private _listeners = new Map<string | symbol, Array<(...args: any[]) => void>>();

    on(event: string | symbol, listener: (...args: any[]) => void): this {
        const list = this._listeners.get(event) ?? [];
        list.push(listener);
        this._listeners.set(event, list);
        return this;
    }

    addListener(event: string | symbol, listener: (...args: any[]) => void): this {
        return this.on(event, listener);
    }

    once(event: string | symbol, listener: (...args: any[]) => void): this {
        const wrapper = (...args: any[]) => {
            this.off(event, wrapper);
            listener(...args);
        };
        return this.on(event, wrapper);
    }

    off(event: string | symbol, listener: (...args: any[]) => void): this {
        const list = this._listeners.get(event);
        if (!list) return this;
        const idx = list.indexOf(listener);
        if (idx >= 0) list.splice(idx, 1);
        return this;
    }

    removeListener(event: string | symbol, listener: (...args: any[]) => void): this {
        return this.off(event, listener);
    }

    removeAllListeners(event?: string | symbol): this {
        if (event === undefined) {
            this._listeners.clear();
        } else {
            this._listeners.delete(event);
        }
        return this;
    }

    listenerCount(event: string | symbol): number {
        return this._listeners.get(event)?.length ?? 0;
    }

    emit(event: string | symbol, ...args: any[]): boolean {
        const list = this._listeners.get(event);
        if (!list || list.length === 0) return false;
        for (const fn of [...list]) {
            fn(...args);
        }
        return true;
    }
}

export class Dir {
    path: string;

    constructor(_internal: unknown, path: string) {
        this.path = path;
    }

    close(cb?: (err?: NodeJS.ErrnoException) => void): Promise<void> {
        const err = webNotSupportedError() as NodeJS.ErrnoException;
        if (cb) scheduleAsync(() => cb(err));
        return Promise.reject(err);
    }

    closeSync(): void {
        throwWebUnsupported();
    }

    read(cb?: (err: NodeJS.ErrnoException | null, dirEnt: Dirent | null) => void): Promise<Dirent | null> {
        const err = webNotSupportedError() as NodeJS.ErrnoException;
        if (cb) scheduleAsync(() => cb(err, null));
        return Promise.reject(err);
    }

    readSync(): Dirent | null {
        return throwWebUnsupported();
    }

    async *[Symbol.asyncIterator](): AsyncIterableIterator<Dirent> {
        throwWebUnsupported();
    }
}

export class ReadStream extends WebEventEmitter {
    path: string | Buffer;
    bytesRead: number = 0;
    pending: boolean = false;
    destroyed: boolean = false;

    constructor(path: PathLike | Buffer, _options?: ReadStreamOptions) {
        super();
        this.path = typeof path === 'string' || path instanceof URL ? normalizePath(path) : path;
        warnWebOnce();
        scheduleAsync(() => {
            if (!this.destroyed && this.listenerCount('error') > 0) {
                this.emit('error', webNotSupportedError());
            }
        });
    }

    pipe<T>(destination: T): T {
        return destination;
    }

    pause(): this {
        return this;
    }

    resume(): this {
        return this;
    }

    close(cb?: (err?: Error | null) => void): void {
        this.destroy(undefined, cb);
    }

    destroy(_error?: Error, cb?: (err?: Error | null) => void): this {
        if (!this.destroyed) {
            this.destroyed = true;
            this.emit('close');
        }
        if (cb) scheduleAsync(() => cb(null));
        return this;
    }
}

export class WriteStream extends WebEventEmitter {
    path: string | Buffer;
    bytesWritten: number = 0;
    pending: boolean = false;
    destroyed: boolean = false;

    constructor(path: PathLike | Buffer, _options?: WriteStreamOptions) {
        super();
        this.path = typeof path === 'string' || path instanceof URL ? normalizePath(path) : path;
        warnWebOnce();
        scheduleAsync(() => {
            if (!this.destroyed && this.listenerCount('error') > 0) {
                this.emit('error', webNotSupportedError());
            }
        });
    }

    write(_chunk: any, _encoding?: any, cb?: (err?: Error | null) => void): boolean {
        const callback = typeof _encoding === 'function' ? _encoding : cb;
        const err = webNotSupportedError();
        if (callback) scheduleAsync(() => callback(err));
        return false;
    }

    end(_chunk?: any, _encoding?: any, cb?: () => void): this {
        const callback = typeof _chunk === 'function'
            ? _chunk
            : typeof _encoding === 'function'
                ? _encoding
                : cb;
        if (callback) scheduleAsync(callback);
        this.destroy();
        return this;
    }

    close(cb?: (err?: Error | null) => void): void {
        this.destroy(undefined, cb);
    }

    destroy(_error?: Error, cb?: (err?: Error | null) => void): this {
        if (!this.destroyed) {
            this.destroyed = true;
            this.emit('close');
        }
        if (cb) scheduleAsync(() => cb(null));
        return this;
    }
}

export class FSWatcher extends WebEventEmitter {
    private _closed = false;

    constructor(_listener?: WatchListener) {
        super();
        warnWebOnce();
        scheduleAsync(() => {
            if (!this._closed && this.listenerCount('error') > 0) {
                this.emit('error', webNotSupportedError());
            }
        });
    }

    close(): void {
        this._closed = true;
        this.emit('close');
    }

    ref(): this {
        return this;
    }

    unref(): this {
        return this;
    }
}

// --- Exists ---
export function existsSync(_path: PathLike): boolean {
    return false;
}

export function exists(_path: PathLike, callback: (exists: boolean) => void): void {
    scheduleAsync(() => callback?.(false));
}

// --- Sync stubs ---
export function openSync(_path: PathLike, _flags?: string | number, _mode?: number): number { return throwWebUnsupported(); }
export function closeSync(_fd: number): void { return throwWebUnsupported(); }
export function readSync(..._args: any[]): number { return throwWebUnsupported(); }
export function writeSync(..._args: any[]): number { return throwWebUnsupported(); }
export function accessSync(_path: PathLike, _mode?: number): void { return throwWebUnsupported(); }
export function truncateSync(_path: PathLike, _len?: number): void { return throwWebUnsupported(); }
export function ftruncateSync(_fd: number, _len?: number): void { return throwWebUnsupported(); }
export function fsyncSync(_fd: number): void { return throwWebUnsupported(); }
export function fdatasyncSync(_fd: number): void { return throwWebUnsupported(); }
export function chmodSync(_path: PathLike, _mode: number): void { return throwWebUnsupported(); }
export function fchmodSync(_fd: number, _mode: number): void { return throwWebUnsupported(); }
export function chownSync(_path: PathLike, _uid: number, _gid: number): void { return throwWebUnsupported(); }
export function lchownSync(_path: PathLike, _uid: number, _gid: number): void { return throwWebUnsupported(); }
export function lchmodSync(_path: PathLike, _mode: number): void { return throwWebUnsupported(); }
export function fchownSync(_fd: number, _uid: number, _gid: number): void { return throwWebUnsupported(); }
export function utimesSync(_path: PathLike, _atime: string | number | Date, _mtime: string | number | Date): void { return throwWebUnsupported(); }
export function lutimesSync(_path: PathLike, _atime: string | number | Date, _mtime: string | number | Date): void { return throwWebUnsupported(); }
export function futimesSync(_fd: number, _atime: string | number | Date, _mtime: string | number | Date): void { return throwWebUnsupported(); }
export function linkSync(_existingPath: PathLike, _newPath: PathLike): void { return throwWebUnsupported(); }
export function symlinkSync(_target: PathLike, _path: PathLike, _type?: string): void { return throwWebUnsupported(); }
export function readlinkSync(_path: PathLike, _options?: { encoding?: string } | string): string { return throwWebUnsupported(); }
export function realpathSync(_path: PathLike, _options?: { encoding?: string } | string): string { return throwWebUnsupported(); }
export function mkdtempSync(_prefix: string, _options?: any): string { return throwWebUnsupported(); }
export function rmSync(_path: PathLike, _options?: RmOptions): void { return throwWebUnsupported(); }
export function statSync(_path: PathLike, _options?: StatOptions): Stats | BigIntStats { return throwWebUnsupported(); }
export function lstatSync(_path: PathLike, _options?: StatOptions): Stats | BigIntStats { return throwWebUnsupported(); }
export function fstatSync(_fd: number, _options?: StatOptions): Stats | BigIntStats { return throwWebUnsupported(); }
export function statfsSync(_path?: PathLike): StatFs;
export function statfsSync(_path: PathLike, _options: { bigint: true }): BigIntStatFs;
export function statfsSync(_path: PathLike, _options?: StatOptions): StatFs | BigIntStatFs;
export function statfsSync(_path?: PathLike, _options?: StatOptions): StatFs | BigIntStatFs { return throwWebUnsupported(); }
export function hashFileSync(_path: PathLike, _algorithm: HashAlgorithm = 'md5'): string { return throwWebUnsupported(); }
export function mkdirSync(_path: PathLike, _options?: { recursive?: boolean; mode?: number } | number): string | undefined { return throwWebUnsupported(); }
export function rmdirSync(_path: PathLike, _options?: RmdirOptions): void { return throwWebUnsupported(); }
export function unlinkSync(_path: PathLike): void { return throwWebUnsupported(); }
export function renameSync(_oldPath: PathLike, _newPath: PathLike): void { return throwWebUnsupported(); }
export function copyFileSync(_src: PathLike, _dest: PathLike, _flags?: number): void { return throwWebUnsupported(); }
export function cpSync(_src: PathLike, _dest: PathLike, _options?: CpOptions): void { return throwWebUnsupported(); }
export function readvSync(_fd: number, _buffers: ArrayBufferView[], _position?: number | null): number { return throwWebUnsupported(); }
export function writevSync(_fd: number, _buffers: ArrayBufferView[], _position?: number | null): number { return throwWebUnsupported(); }
export function appendFileSync(_file: PathLike | number | Buffer, _data: string | Buffer, _options?: any): void { return throwWebUnsupported(); }
export function readFileSync(_path: PathLike, _options?: { encoding?: string; flag?: string } | string): Buffer | string { return throwWebUnsupported(); }
export function writeFileSync(_path: PathLike, _data: string | Buffer | Uint8Array, _options?: any): void { return throwWebUnsupported(); }
export function opendirSync(_path: PathLike, _options?: any): Dir { return throwWebUnsupported(); }
export function readdirSync(_path: PathLike, _options?: any): string[] | Dirent[] { return throwWebUnsupported(); }
export function getBookmark(_path: PathLike): string { return throwWebUnsupported(); }
export function resolveBookmark(_bookmark: string): string { return throwWebUnsupported(); }
export function getTempPath(): string { return throwWebUnsupported(); }

// --- Callback async stubs ---
export function open(...args: any[]): void { callbackWebError(args); }
export function close(...args: any[]): void { callbackWebError(args); }
export function read(...args: any[]): void { callbackWebError(args); }
export function write(...args: any[]): void { callbackWebError(args); }
export function access(...args: any[]): void { callbackWebError(args); }
export function truncate(...args: any[]): void { callbackWebError(args); }
export function ftruncate(...args: any[]): void { callbackWebError(args); }
export function fsync(...args: any[]): void { callbackWebError(args); }
export function fdatasync(...args: any[]): void { callbackWebError(args); }
export function chmod(...args: any[]): void { callbackWebError(args); }
export function fchmod(...args: any[]): void { callbackWebError(args); }
export function chown(...args: any[]): void { callbackWebError(args); }
export function lchown(...args: any[]): void { callbackWebError(args); }
export function lchmod(...args: any[]): void { callbackWebError(args); }
export function fchown(...args: any[]): void { callbackWebError(args); }
export function utimes(...args: any[]): void { callbackWebError(args); }
export function lutimes(...args: any[]): void { callbackWebError(args); }
export function futimes(...args: any[]): void { callbackWebError(args); }
export function link(...args: any[]): void { callbackWebError(args); }
export function symlink(...args: any[]): void { callbackWebError(args); }
export function readlink(...args: any[]): void { callbackWebError(args); }
export function realpath(...args: any[]): void { callbackWebError(args); }
export function mkdtemp(...args: any[]): void { callbackWebError(args); }
export function rm(...args: any[]): void { callbackWebError(args); }
export function stat(...args: any[]): void { callbackWebError(args); }
export function lstat(...args: any[]): void { callbackWebError(args); }
export function fstat(...args: any[]): void { callbackWebError(args); }
export function statfs(...args: any[]): void { callbackWebError(args); }
export function mkdir(...args: any[]): void { callbackWebError(args); }
export function rmdir(...args: any[]): void { callbackWebError(args); }
export function unlink(...args: any[]): void { callbackWebError(args); }
export function rename(...args: any[]): void { callbackWebError(args); }
export function copyFile(...args: any[]): void { callbackWebError(args); }
export function cp(...args: any[]): void { callbackWebError(args); }
export function readv(...args: any[]): void { callbackWebError(args); }
export function writev(...args: any[]): void { callbackWebError(args); }
export function appendFile(...args: any[]): void { callbackWebError(args); }
export function readFile(...args: any[]): void { callbackWebError(args); }
export function writeFile(...args: any[]): void { callbackWebError(args); }
export function opendir(...args: any[]): void { callbackWebError(args); }
export function readdir(...args: any[]): void { callbackWebError(args); }

// --- Streams & Watchers ---
export function createReadStream(path: PathLike | Buffer, options?: string | ReadStreamOptions): ReadStream {
    const opts = typeof options === 'string' ? { encoding: options as BufferEncoding } : options;
    return new ReadStream(path, opts);
}

export function createWriteStream(path: PathLike | Buffer, options?: string | WriteStreamOptions): WriteStream {
    const opts = typeof options === 'string' ? { encoding: options as BufferEncoding } : options;
    return new WriteStream(path, opts);
}

export function watch(
    _filename: PathLike,
    options?: { persistent?: boolean; recursive?: boolean; encoding?: BufferEncoding } | WatchListener,
    listener?: WatchListener
): FSWatcher {
    const cb = typeof options === 'function' ? options : listener;
    return new FSWatcher(cb);
}

export function watchFile(_filename: PathLike, _options: any, _listener?: any): void {
    warnWebOnce();
}

export function unwatchFile(_filename: PathLike, _listener?: any): void {
}

// --- Picker API ---
export async function pickFiles(_options: FilePickerOptions = {}): Promise<PickedFile[]> {
    return rejectWeb();
}

export async function pickDirectory(_options: DirectoryPickerOptions = {}): Promise<PickedDirectory> {
    return rejectWeb();
}

// --- Promises API ---
const promisesStatfs = ((_path?: PathLike, _options?: StatOptions): Promise<StatFs | BigIntStatFs> => rejectWeb()) as {
    (path?: PathLike): Promise<StatFs>;
    (path: PathLike, options: { bigint: true }): Promise<BigIntStatFs>;
    (path: PathLike, options?: StatOptions): Promise<StatFs | BigIntStatFs>;
};

export const promises = {
    open: (_path: PathLike, _flags?: string | number, _mode?: number): Promise<number> => rejectWeb(),
    read: (_fd: number, _buffer: Buffer | Uint8Array, _offset: number, _length: number, _position: number | null): Promise<number> => rejectWeb(),
    close: (_fd: number): Promise<void> => rejectWeb(),
    readFile: (_path: PathLike, _options?: { encoding?: string; flag?: string } | string): Promise<string | Buffer> => rejectWeb(),
    getBookmark: (_path: PathLike): Promise<string> => rejectWeb(),
    resolveBookmark: (_bookmark: string): Promise<string> => rejectWeb(),
    writeFile: (_path: PathLike, _data: string | Buffer | Uint8Array, _options?: { encoding?: string; mode?: number; flag?: string } | string): Promise<void> => rejectWeb(),
    unlink: (_path: PathLike): Promise<void> => rejectWeb(),
    mkdir: (_path: PathLike, _mode?: number): Promise<void> => rejectWeb(),
    rmdir: (_path: PathLike): Promise<void> => rejectWeb(),
    readdir: (_path: PathLike): Promise<string[]> => rejectWeb(),
    rename: (_oldPath: PathLike, _newPath: PathLike): Promise<void> => rejectWeb(),
    copyFile: (_src: PathLike, _dest: PathLike, _flags?: number): Promise<void> => rejectWeb(),
    cp: (_src: PathLike, _dest: PathLike, _options?: CpOptions): Promise<void> => rejectWeb(),
    link: (_existingPath: PathLike, _newPath: PathLike): Promise<void> => rejectWeb(),
    symlink: (_target: PathLike, _path: PathLike, _type?: string): Promise<void> => rejectWeb(),
    readlink: (_path: PathLike, _options?: { encoding?: string } | string): Promise<string> => rejectWeb(),
    realpath: (_path: PathLike, _options?: { encoding?: string } | string): Promise<string> => rejectWeb(),
    mkdtemp: (_prefix: string, _options?: any): Promise<string> => rejectWeb(),
    rm: (_path: PathLike, _options?: RmOptions): Promise<void> => rejectWeb(),
    stat: (_path: PathLike): Promise<Stats> => rejectWeb(),
    statfs: promisesStatfs,
    hashFile: (_path: PathLike, _algorithm: HashAlgorithm = 'md5'): Promise<string> => rejectWeb(),
    access: (_path: PathLike, _mode?: number): Promise<void> => rejectWeb(),
    truncate: (_path: PathLike, _len?: number): Promise<void> => rejectWeb(),
    ftruncate: (_fd: number, _len?: number): Promise<void> => rejectWeb(),
    fsync: (_fd: number): Promise<void> => rejectWeb(),
    chmod: (_path: PathLike, _mode: number): Promise<void> => rejectWeb(),
    fchmod: (_fd: number, _mode: number): Promise<void> => rejectWeb(),
    chown: (_path: PathLike, _uid: number, _gid: number): Promise<void> => rejectWeb(),
    fchown: (_fd: number, _uid: number, _gid: number): Promise<void> => rejectWeb(),
    utimes: (_path: PathLike, _atime: string | number | Date, _mtime: string | number | Date): Promise<void> => rejectWeb(),
    futimes: (_fd: number, _atime: string | number | Date, _mtime: string | number | Date): Promise<void> => rejectWeb(),
    appendFile: (_file: PathLike | number | Buffer, _data: string | Buffer, _options?: any): Promise<void> => rejectWeb(),
    lstat: (_path: PathLike): Promise<Stats> => rejectWeb(),
    lchmod: (_path: PathLike, _mode: number): Promise<void> => rejectWeb(),
    lchown: (_path: PathLike, _uid: number, _gid: number): Promise<void> => rejectWeb(),
    lutimes: (_path: PathLike, _atime: string | number | Date, _mtime: string | number | Date): Promise<void> => rejectWeb(),
    opendir: (_path: PathLike, _options?: any): Promise<Dir> => rejectWeb(),
};

export default {
    constants,
    access,
    accessSync,
    appendFile,
    appendFileSync,
    chmod,
    chmodSync,
    chown,
    chownSync,
    close,
    closeSync,
    copyFile,
    copyFileSync,
    cp,
    cpSync,
    exists,
    existsSync,
    fchmod,
    fchmodSync,
    fchown,
    fchownSync,
    fstat,
    fstatSync,
    fsync,
    fsyncSync,
    ftruncate,
    ftruncateSync,
    futimes,
    futimesSync,
    lchmod,
    lchmodSync,
    lchown,
    lchownSync,
    link,
    linkSync,
    lstat,
    lstatSync,
    lutimes,
    lutimesSync,
    mkdir,
    mkdirSync,
    mkdtemp,
    mkdtempSync,
    createReadStream,
    createWriteStream,
    open,
    openSync,
    opendir,
    opendirSync,
    read,
    readFile,
    readFileSync,
    readlink,
    readlinkSync,
    readSync,
    readdir,
    readdirSync,
    realpath,
    realpathSync,
    rename,
    renameSync,
    rm,
    rmSync,
    rmdir,
    rmdirSync,
    stat,
    statSync,
    statfs,
    statfsSync,
    hashFileSync,
    symlink,
    symlinkSync,
    truncate,
    truncateSync,
    unlink,
    unlinkSync,
    utimes,
    utimesSync,
    watch,
    watchFile,
    unwatchFile,
    write,
    writeFile,
    writeFileSync,
    writeSync,
    readv,
    readvSync,
    writev,
    writevSync,
    fdatasync,
    fdatasyncSync,
    Stats,
    BigIntStats,
    Dirent,
    Dir,
    ReadStream,
    WriteStream,
    FSWatcher,
    promises,
    getBookmark,
    resolveBookmark,
    getTempPath,
    pickFiles,
    pickDirectory,
    Paths,
    FileProtectionKeys,
    bundleUri,
    toFileUri,
    normalizePath,
    getFlags,
};

