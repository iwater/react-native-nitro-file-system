import { NitroFileSystem } from './native'
import type { Stats as NitroStats } from './specs/HybridFileSystem.nitro'
import { Buffer } from 'react-native-nitro-buffer'

// --- Constants ---
export const constants = {
    O_RDONLY: 0,
    O_WRONLY: 1,
    O_RDWR: 2,
    O_CREAT: 64,
    O_EXCL: 128,
    O_NOCTTY: 256,
    O_TRUNC: 512,
    O_APPEND: 1024,
    O_DIRECTORY: 65536,
    O_NOATIME: 262144,
    O_NOFOLLOW: 131072,
    O_SYNC: 1052672,
    O_DSYNC: 4096,
    O_SYMLINK: 2097152,
    O_DIRECT: 16384,
    O_NONBLOCK: 2048,
    S_IRWXU: 448,
    S_IRUSR: 256,
    S_IWUSR: 128,
    S_IXUSR: 64,
    S_IRWXG: 56,
    S_IRGRP: 32,
    S_IWGRP: 16,
    S_IXGRP: 8,
    S_IRWXO: 7,
    S_IROTH: 4,
    S_IWOTH: 2,
    S_IXOTH: 1,
    F_OK: 0,
    R_OK: 4,
    W_OK: 2,
    X_OK: 1,
};

// --- Types ---
type Callback<T = void> = (err: Error | null, result?: T) => void;
type ReadCallback = (err: Error | null, bytesRead?: number, buffer?: Buffer) => void;
type WriteCallback = (err: Error | null, bytesWritten?: number, buffer?: Buffer) => void;
type WriteStringCallback = (err: Error | null, bytesWritten?: number, str?: string) => void;
type StatsCallback = (err: Error | null, stats?: Stats | BigIntStats) => void;
type ReaddirCallback = (err: Error | null, files?: string[]) => void;
type MkdtempCallback = (err: Error | null, folder?: string) => void;
type ReadvCallback = (err: Error | null, bytesRead?: number, buffers?: ArrayBufferView[]) => void;
type WritevCallback = (err: Error | null, bytesWritten?: number, buffers?: ArrayBufferView[]) => void;

export interface ReadOptions {
    buffer?: Buffer | Uint8Array;
    offset?: number;
    length?: number;
    position?: number | null;
}

export interface RmOptions {
    force?: boolean;
    maxRetries?: number;
    recursive?: boolean;
    retryDelay?: number;
}

export interface RmdirOptions {
    maxRetries?: number;
    recursive?: boolean;
    retryDelay?: number;
}

export interface StatOptions {
    bigint?: boolean;
}

// --- Stats Class ---
export class Stats {
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
    atime: Date;
    mtime: Date;
    ctime: Date;
    birthtime: Date;

    constructor(stats: NitroStats) {
        this.dev = stats.dev;
        this.ino = stats.ino;
        this.mode = stats.mode;
        this.nlink = stats.nlink;
        this.uid = stats.uid;
        this.gid = stats.gid;
        this.rdev = stats.rdev;
        this.size = stats.size;
        this.blksize = stats.blksize;
        this.blocks = stats.blocks;
        this.atimeMs = stats.atimeMs;
        this.mtimeMs = stats.mtimeMs;
        this.ctimeMs = stats.ctimeMs;
        this.birthtimeMs = stats.birthtimeMs;

        this.atime = new Date(stats.atimeMs);
        this.mtime = new Date(stats.mtimeMs);
        this.ctime = new Date(stats.ctimeMs);
        this.birthtime = new Date(stats.birthtimeMs);
    }

    private _checkModeProperty(property: number): boolean {
        return (this.mode & 0o170000) === property;
    }

    isDirectory(): boolean {
        return this._checkModeProperty(0o040000);
    }

    isFile(): boolean {
        return this._checkModeProperty(0o100000);
    }

    isBlockDevice(): boolean {
        return this._checkModeProperty(0o060000);
    }

    isCharacterDevice(): boolean {
        return this._checkModeProperty(0o020000);
    }

    isSymbolicLink(): boolean {
        return this._checkModeProperty(0o120000);
    }

    isFIFO(): boolean {
        return this._checkModeProperty(0o010000);
    }

    isSocket(): boolean {
        return this._checkModeProperty(0o140000);
    }
}

// --- BigIntStats Class ---
export class BigIntStats {
    dev: bigint;
    ino: bigint;
    mode: bigint;
    nlink: bigint;
    uid: bigint;
    gid: bigint;
    rdev: bigint;
    size: bigint;
    blksize: bigint;
    blocks: bigint;
    atimeMs: bigint;
    mtimeMs: bigint;
    ctimeMs: bigint;
    birthtimeMs: bigint;
    atimeNs: bigint;
    mtimeNs: bigint;
    ctimeNs: bigint;
    birthtimeNs: bigint;
    atime: Date;
    mtime: Date;
    ctime: Date;
    birthtime: Date;

    constructor(stats: NitroStats) {
        this.dev = BigInt(Math.floor(stats.dev));
        this.ino = BigInt(Math.floor(stats.ino));
        this.mode = BigInt(Math.floor(stats.mode));
        this.nlink = BigInt(Math.floor(stats.nlink));
        this.uid = BigInt(Math.floor(stats.uid));
        this.gid = BigInt(Math.floor(stats.gid));
        this.rdev = BigInt(Math.floor(stats.rdev));
        this.size = BigInt(Math.floor(stats.size));
        this.blksize = BigInt(Math.floor(stats.blksize));
        this.blocks = BigInt(Math.floor(stats.blocks));
        this.atimeMs = BigInt(Math.floor(stats.atimeMs));
        this.mtimeMs = BigInt(Math.floor(stats.mtimeMs));
        this.ctimeMs = BigInt(Math.floor(stats.ctimeMs));
        this.birthtimeMs = BigInt(Math.floor(stats.birthtimeMs));
        // Nanoseconds (approximated from ms since native doesn't provide ns directly)
        this.atimeNs = BigInt(Math.floor(stats.atimeMs)) * 1000000n;
        this.mtimeNs = BigInt(Math.floor(stats.mtimeMs)) * 1000000n;
        this.ctimeNs = BigInt(Math.floor(stats.ctimeMs)) * 1000000n;
        this.birthtimeNs = BigInt(Math.floor(stats.birthtimeMs)) * 1000000n;

        this.atime = new Date(stats.atimeMs);
        this.mtime = new Date(stats.mtimeMs);
        this.ctime = new Date(stats.ctimeMs);
        this.birthtime = new Date(stats.birthtimeMs);
    }

    private _checkModeProperty(property: number): boolean {
        return (Number(this.mode) & 0o170000) === property;
    }

    isDirectory(): boolean {
        return this._checkModeProperty(0o040000);
    }

    isFile(): boolean {
        return this._checkModeProperty(0o100000);
    }

    isBlockDevice(): boolean {
        return this._checkModeProperty(0o060000);
    }

    isCharacterDevice(): boolean {
        return this._checkModeProperty(0o020000);
    }

    isSymbolicLink(): boolean {
        return this._checkModeProperty(0o120000);
    }

    isFIFO(): boolean {
        return this._checkModeProperty(0o010000);
    }

    isSocket(): boolean {
        return this._checkModeProperty(0o140000);
    }
}

// --- Helper Functions ---
export function getFlags(flag: string | number | undefined): number {
    if (typeof flag === 'number') return flag;
    if (flag === undefined) return constants.O_RDONLY;
    // Basic mapping for common flags
    switch (flag) {
        case 'r': return constants.O_RDONLY;
        case 'r+': return constants.O_RDWR;
        case 'w': return constants.O_TRUNC | constants.O_CREAT | constants.O_WRONLY;
        case 'w+': return constants.O_TRUNC | constants.O_CREAT | constants.O_RDWR;
        case 'a': return constants.O_APPEND | constants.O_CREAT | constants.O_WRONLY;
        case 'a+': return constants.O_APPEND | constants.O_CREAT | constants.O_RDWR;
        default: return constants.O_RDONLY;
    }
}

function toUnixTimestamp(time: string | number | Date): number {
    if (time instanceof Date) {
        return time.getTime() / 1000.0;
    }
    if (typeof time === 'string') {
        const parsed = parseFloat(time);
        if (!isNaN(parsed)) return parsed;
        // Try Date Parse
        const d = Date.parse(time);
        if (!isNaN(d)) return d / 1000.0;
        return 0; // Or throw? Node throws.
    }
    if (typeof time === 'number') {
        return time; // Seconds
    }
    return 0;
}
// --- Implementation ---

export function openSync(path: string, flags: string | number = 'r', mode: number = 0o666): number {
    const flagsNum = getFlags(flags);
    const fd = NitroFileSystem.open(path, flagsNum, mode);
    if (fd < 0) {
        throw new Error(`ENOENT: no such file or directory, open '${path}'`);
    }
    return fd;
}

export function open(path: string, flags: string | number, mode?: number | Callback<number>, callback?: Callback<number>): void {
    if (typeof mode === 'function') {
        callback = mode;
        mode = 0o666;
    }
    const modeNum = mode as number || 0o666;
    const flagsNum = getFlags(flags);

    // Asynchronous implementation using setTimeout generally
    // But here we rely on the bridge. 
    // Since Nitro is sync by default (unless Promise), we wrap it.
    // Ideally, we should use a Thread or Promise in C++ for async.
    // For now, we simulate async with setTimeout around sync call.
    // TODO: Implement true async in C++ (Phase 3)

    // Basic stub for async
    setImmediate(() => {
        try {
            const fd = NitroFileSystem.open(path, flagsNum, modeNum);
            if (fd < 0) {
                callback?.(new Error(`ENOENT: no such file or directory, open '${path}'`));
            } else {
                callback?.(null, fd);
            }
        } catch (e: any) {
            callback?.(e);
        }
    });
}

export function closeSync(fd: number): void {
    NitroFileSystem.close(fd);
}

export function close(fd: number, callback?: Callback): void {
    setImmediate(() => {
        try {
            NitroFileSystem.close(fd);
            callback?.(null);
        } catch (e: any) {
            callback?.(e);
        }
    });
}

export function readSync(fd: number, buffer: Buffer | Uint8Array, offset?: number, length?: number, position?: number | null): number;
export function readSync(fd: number, options?: ReadOptions): number;
export function readSync(fd: number, bufferOrOptions?: Buffer | Uint8Array | ReadOptions, offset?: number, length?: number, position?: number | null): number {
    let buf: Buffer | Uint8Array;
    let off: number;
    let len: number;
    let pos: number;

    if (bufferOrOptions === undefined) {
        // read(fd) - allocate a buffer
        buf = Buffer.alloc(16384);
        off = 0;
        len = buf.length;
        pos = -1;
    } else if (bufferOrOptions instanceof Buffer || bufferOrOptions instanceof Uint8Array) {
        buf = bufferOrOptions;
        off = offset ?? 0;
        len = length ?? (buf.length - off);
        pos = position === null || position === undefined ? -1 : position;
    } else {
        // ReadOptions
        buf = bufferOrOptions.buffer ?? Buffer.alloc(16384);
        off = bufferOrOptions.offset ?? 0;
        len = bufferOrOptions.length ?? (buf.length - off);
        pos = bufferOrOptions.position === null || bufferOrOptions.position === undefined ? -1 : bufferOrOptions.position;
    }

    const bytesRead = NitroFileSystem.read(fd, buf.buffer as ArrayBuffer, (buf as any).byteOffset + off, len, pos);
    return bytesRead;
}

// Overload signatures for read()
export function read(fd: number, callback: ReadCallback): void;
export function read(fd: number, options: ReadOptions, callback: ReadCallback): void;
export function read(fd: number, buffer: Buffer | Uint8Array, callback: ReadCallback): void;
export function read(fd: number, buffer: Buffer | Uint8Array, offset: number, length: number, callback: ReadCallback): void;
export function read(fd: number, buffer: Buffer | Uint8Array, offset: number, length: number, position: number | null, callback: ReadCallback): void;
export function read(
    fd: number,
    bufferOrOptionsOrCallback?: Buffer | Uint8Array | ReadOptions | ReadCallback,
    offsetOrCallback?: number | ReadCallback,
    lengthOrCallback?: number | ReadCallback,
    positionOrCallback?: number | null | ReadCallback,
    callback?: ReadCallback
): void {
    let buf: Buffer | Uint8Array;
    let off: number;
    let len: number;
    let pos: number | null;
    let cb: ReadCallback;

    if (typeof bufferOrOptionsOrCallback === 'function') {
        // read(fd, callback)
        buf = Buffer.alloc(16384);
        off = 0;
        len = buf.length;
        pos = null;
        cb = bufferOrOptionsOrCallback;
    } else if (bufferOrOptionsOrCallback && !(bufferOrOptionsOrCallback instanceof Buffer) && !(bufferOrOptionsOrCallback instanceof Uint8Array)) {
        // read(fd, options, callback)
        const opts = bufferOrOptionsOrCallback as ReadOptions;
        buf = opts.buffer ?? Buffer.alloc(16384);
        off = opts.offset ?? 0;
        len = opts.length ?? (buf.length - off);
        pos = opts.position ?? null;
        cb = offsetOrCallback as ReadCallback;
    } else if (typeof offsetOrCallback === 'function') {
        // read(fd, buffer, callback)
        buf = bufferOrOptionsOrCallback as Buffer | Uint8Array;
        off = 0;
        len = buf.length;
        pos = null;
        cb = offsetOrCallback;
    } else if (typeof lengthOrCallback === 'function') {
        // read(fd, buffer, offset, callback)
        buf = bufferOrOptionsOrCallback as Buffer | Uint8Array;
        off = offsetOrCallback as number;
        len = buf.length - off;
        pos = null;
        cb = lengthOrCallback;
    } else if (typeof positionOrCallback === 'function') {
        // read(fd, buffer, offset, length, callback)
        buf = bufferOrOptionsOrCallback as Buffer | Uint8Array;
        off = offsetOrCallback as number;
        len = lengthOrCallback as number;
        pos = null;
        cb = positionOrCallback;
    } else {
        // read(fd, buffer, offset, length, position, callback)
        buf = bufferOrOptionsOrCallback as Buffer | Uint8Array;
        off = offsetOrCallback as number;
        len = lengthOrCallback as number;
        pos = positionOrCallback as number | null;
        cb = callback!;
    }

    setImmediate(() => {
        try {
            const bytesRead = readSync(fd, buf, off, len, pos);
            if (bytesRead < 0) {
                cb(new Error("Read failed"));
            } else {
                cb(null, bytesRead, buf as Buffer);
            }
        } catch (e: any) {
            cb(e);
        }
    });
}

// Write with buffer
export function writeSync(fd: number, buffer: Buffer | Uint8Array, offset?: number, length?: number, position?: number | null): number;
// Write with string
export function writeSync(fd: number, string: string, position?: number | null, encoding?: BufferEncoding): number;
export function writeSync(fd: number, bufferOrString: Buffer | Uint8Array | string, offsetOrPosition?: number | null, lengthOrEncoding?: number | BufferEncoding, position?: number | null): number {
    if (typeof bufferOrString === 'string') {
        const encoding = (typeof lengthOrEncoding === 'string' ? lengthOrEncoding : 'utf8') as BufferEncoding;
        const buf = Buffer.from(bufferOrString, encoding);
        const pos = offsetOrPosition === null || offsetOrPosition === undefined ? -1 : offsetOrPosition;
        return NitroFileSystem.write(fd, buf.buffer, buf.byteOffset, buf.length, pos);
    }

    const buf = bufferOrString instanceof Buffer ? bufferOrString : Buffer.from(bufferOrString);
    const off = (offsetOrPosition as number) || 0;
    const len = (typeof lengthOrEncoding === 'number' ? lengthOrEncoding : undefined) || (buf.length - off);
    const pos = position === null || position === undefined ? -1 : position;
    return NitroFileSystem.write(fd, buf.buffer, buf.byteOffset + off, len, pos);
}

// Overload signatures for write()
export function write(fd: number, buffer: Buffer | Uint8Array, callback: WriteCallback): void;
export function write(fd: number, buffer: Buffer | Uint8Array, offset: number, callback: WriteCallback): void;
export function write(fd: number, buffer: Buffer | Uint8Array, offset: number, length: number, callback: WriteCallback): void;
export function write(fd: number, buffer: Buffer | Uint8Array, offset: number, length: number, position: number | null, callback: WriteCallback): void;
export function write(fd: number, string: string, callback: WriteStringCallback): void;
export function write(fd: number, string: string, position: number | null, callback: WriteStringCallback): void;
export function write(fd: number, string: string, position: number | null, encoding: BufferEncoding, callback: WriteStringCallback): void;
export function write(
    fd: number,
    bufferOrString: Buffer | Uint8Array | string,
    offsetOrPositionOrCallback?: number | null | WriteCallback | WriteStringCallback,
    lengthOrEncodingOrCallback?: number | BufferEncoding | WriteCallback | WriteStringCallback,
    positionOrCallback?: number | null | WriteCallback | WriteStringCallback,
    callback?: WriteCallback | WriteStringCallback
): void {
    let buf: Buffer;
    let off: number;
    let len: number;
    let pos: number | null;
    let cb: WriteCallback | WriteStringCallback;
    let isString = typeof bufferOrString === 'string';

    if (isString) {
        // String write
        const str = bufferOrString as string;
        if (typeof offsetOrPositionOrCallback === 'function') {
            // write(fd, string, callback)
            buf = Buffer.from(str, 'utf8');
            pos = null;
            cb = offsetOrPositionOrCallback;
        } else if (typeof lengthOrEncodingOrCallback === 'function') {
            // write(fd, string, position, callback)
            buf = Buffer.from(str, 'utf8');
            pos = offsetOrPositionOrCallback as number | null;
            cb = lengthOrEncodingOrCallback;
        } else if (typeof positionOrCallback === 'function') {
            // write(fd, string, position, encoding, callback)
            const encoding = (lengthOrEncodingOrCallback as BufferEncoding) || 'utf8';
            buf = Buffer.from(str, encoding);
            pos = offsetOrPositionOrCallback as number | null;
            cb = positionOrCallback;
        } else {
            buf = Buffer.from(str, 'utf8');
            pos = null;
            cb = callback!;
        }
        off = 0;
        len = buf.length;
    } else {
        // Buffer write
        const buffer = bufferOrString as Buffer | Uint8Array;
        buf = buffer instanceof Buffer ? buffer : Buffer.from(buffer);

        if (typeof offsetOrPositionOrCallback === 'function') {
            // write(fd, buffer, callback)
            off = 0;
            len = buf.length;
            pos = null;
            cb = offsetOrPositionOrCallback;
        } else if (typeof lengthOrEncodingOrCallback === 'function') {
            // write(fd, buffer, offset, callback)
            off = offsetOrPositionOrCallback as number;
            len = buf.length - off;
            pos = null;
            cb = lengthOrEncodingOrCallback as WriteCallback;
        } else if (typeof positionOrCallback === 'function') {
            // write(fd, buffer, offset, length, callback)
            off = offsetOrPositionOrCallback as number;
            len = lengthOrEncodingOrCallback as number;
            pos = null;
            cb = positionOrCallback as WriteCallback;
        } else {
            // write(fd, buffer, offset, length, position, callback)
            off = (offsetOrPositionOrCallback as number) ?? 0;
            len = (lengthOrEncodingOrCallback as number) ?? buf.length;
            pos = positionOrCallback as number | null;
            cb = callback!;
        }
    }

    setImmediate(() => {
        try {
            const bytesWritten = writeSync(fd, buf, off, len, pos);
            if (bytesWritten < 0) {
                (cb as WriteCallback)(new Error("Write failed"));
            } else {
                if (isString) {
                    (cb as WriteStringCallback)(null, bytesWritten, bufferOrString as string);
                } else {
                    (cb as WriteCallback)(null, bytesWritten, buf);
                }
            }
        } catch (e: any) {
            (cb as WriteCallback)(e);
        }
    });
}

// Stat with options
export function statSync(path: string, options?: StatOptions): Stats | BigIntStats {
    try {
        const stats = NitroFileSystem.stat(path);
        if (options?.bigint) {
            return new BigIntStats(stats);
        }
        return new Stats(stats);
    } catch (e) {
        throw new Error(`ENOENT: no such file or directory, stat '${path}'`);
    }
}

export function stat(path: string, callback: StatsCallback): void;
export function stat(path: string, options: StatOptions, callback: StatsCallback): void;
export function stat(path: string, optionsOrCallback: StatOptions | StatsCallback, callback?: StatsCallback): void {
    let options: StatOptions | undefined;
    let cb: StatsCallback;

    if (typeof optionsOrCallback === 'function') {
        cb = optionsOrCallback;
    } else {
        options = optionsOrCallback;
        cb = callback!;
    }

    setImmediate(() => {
        try {
            const res = statSync(path, options);
            cb(null, res);
        } catch (e: any) {
            cb(e);
        }
    });
}

export function lstatSync(path: string, options?: StatOptions): Stats | BigIntStats {
    try {
        const stats = NitroFileSystem.lstat(path);
        if (options?.bigint) {
            return new BigIntStats(stats);
        }
        return new Stats(stats);
    } catch (e) {
        throw new Error(`ENOENT: no such file or directory, lstat '${path}'`);
    }
}

export function lstat(path: string, callback: StatsCallback): void;
export function lstat(path: string, options: StatOptions, callback: StatsCallback): void;
export function lstat(path: string, optionsOrCallback: StatOptions | StatsCallback, callback?: StatsCallback): void {
    let options: StatOptions | undefined;
    let cb: StatsCallback;

    if (typeof optionsOrCallback === 'function') {
        cb = optionsOrCallback;
    } else {
        options = optionsOrCallback;
        cb = callback!;
    }

    setImmediate(() => {
        try {
            const res = lstatSync(path, options);
            cb(null, res);
        } catch (e: any) {
            cb(e);
        }
    });
}

export function fstatSync(fd: number, options?: StatOptions): Stats | BigIntStats {
    try {
        const stats = NitroFileSystem.fstat(fd);
        if (options?.bigint) {
            return new BigIntStats(stats);
        }
        return new Stats(stats);
    } catch (e) {
        throw new Error(`EBADF: bad file descriptor, fstat '${fd}'`);
    }
}

export function fstat(fd: number, callback: StatsCallback): void;
export function fstat(fd: number, options: StatOptions, callback: StatsCallback): void;
export function fstat(fd: number, optionsOrCallback: StatOptions | StatsCallback, callback?: StatsCallback): void {
    let options: StatOptions | undefined;
    let cb: StatsCallback;

    if (typeof optionsOrCallback === 'function') {
        cb = optionsOrCallback;
    } else {
        options = optionsOrCallback;
        cb = callback!;
    }

    setImmediate(() => {
        try {
            const res = fstatSync(fd, options);
            cb(null, res);
        } catch (e: any) {
            cb(e);
        }
    });
}

export function mkdirSync(path: string, options?: { recursive?: boolean; mode?: number } | number): string | undefined {
    let mode = 0o777;
    let recursive = false;

    if (typeof options === 'number') {
        mode = options;
    } else if (typeof options === 'object') {
        mode = options.mode || mode;
        recursive = options.recursive || false;
    }

    NitroFileSystem.mkdir(path, mode, recursive);
    return undefined; // Node returns string if created first dir in recursive, here simplified
}

export function mkdir(path: string, options?: { recursive?: boolean; mode?: number } | number | Callback, callback?: Callback): void {
    if (typeof options === 'function') {
        callback = options;
        options = undefined;
    }

    let mode = 0o777;
    let recursive = false;

    if (typeof options === 'number') {
        mode = options;
    } else if (typeof options === 'object') {
        mode = options.mode || mode;
        recursive = options.recursive || false;
    }

    setImmediate(() => {
        try {
            mkdirSync(path, { mode, recursive });
            callback?.(null);
        } catch (e: any) {
            callback?.(e);
        }
    });
}

export function rmdirSync(path: string, options?: RmdirOptions): void {
    if (options?.recursive) {
        // Use rm for recursive deletion
        NitroFileSystem.rm(path, true);
    } else {
        NitroFileSystem.rmdir(path);
    }
}

export function rmdir(path: string, callback?: Callback): void;
export function rmdir(path: string, options: RmdirOptions, callback?: Callback): void;
export function rmdir(path: string, optionsOrCallback?: RmdirOptions | Callback, callback?: Callback): void {
    let options: RmdirOptions | undefined;
    let cb: Callback | undefined;

    if (typeof optionsOrCallback === 'function') {
        cb = optionsOrCallback;
    } else {
        options = optionsOrCallback;
        cb = callback;
    }

    setImmediate(() => {
        try {
            rmdirSync(path, options);
            cb?.(null);
        } catch (e: any) {
            cb?.(e);
        }
    });
}



export function unlinkSync(path: string): void {
    NitroFileSystem.unlink(path);
}

export function unlink(path: string, callback?: Callback): void {
    setImmediate(() => {
        try {
            unlinkSync(path);
            callback?.(null);
        } catch (e: any) {
            callback?.(e);
        }
    });
}

export function renameSync(oldPath: string, newPath: string): void {
    NitroFileSystem.rename(oldPath, newPath);
}

export function rename(oldPath: string, newPath: string, callback?: Callback): void {
    setImmediate(() => {
        try {
            renameSync(oldPath, newPath);
            callback?.(null);
        } catch (e: any) {
            callback?.(e);
        }
    });
}

export function copyFileSync(src: string, dest: string, flags: number = 0): void {
    NitroFileSystem.copyFile(src, dest, flags);
}

export function copyFile(src: string, dest: string, flags: number | Callback, callback?: Callback): void {
    if (typeof flags === 'function') {
        callback = flags;
        flags = 0;
    }
    const f = flags as number || 0;
    setImmediate(() => {
        try {
            copyFileSync(src, dest, f);
            callback?.(null);
        } catch (e: any) {
            callback?.(e);
        }
    });
}

// --- Phase 1: Basic Operations ---

export function accessSync(path: string, mode: number = constants.F_OK): void {
    NitroFileSystem.access(path, mode);
}

export function access(path: string, mode: number | Callback, callback?: Callback): void {
    if (typeof mode === 'function') {
        callback = mode;
        mode = constants.F_OK;
    }
    const m = mode as number || constants.F_OK;
    setImmediate(() => {
        try {
            accessSync(path, m);
            callback?.(null);
        } catch (e: any) {
            callback?.(e);
        }
    });
}

export function truncateSync(path: string, len: number = 0): void {
    NitroFileSystem.truncate(path, len);
}

export function truncate(path: string, len: number | Callback, callback?: Callback): void {
    if (typeof len === 'function') {
        callback = len;
        len = 0;
    }
    const l = len as number || 0;
    setImmediate(() => {
        try {
            truncateSync(path, l);
            callback?.(null);
        } catch (e: any) {
            callback?.(e);
        }
    });
}

export function ftruncateSync(fd: number, len: number = 0): void {
    NitroFileSystem.ftruncate(fd, len);
}

export function ftruncate(fd: number, len: number | Callback, callback?: Callback): void {
    if (typeof len === 'function') {
        callback = len;
        len = 0;
    }
    const l = len as number || 0;
    setImmediate(() => {
        try {
            ftruncateSync(fd, l);
            callback?.(null);
        } catch (e: any) {
            callback?.(e);
        }
    });
}

export function fsyncSync(fd: number): void {
    NitroFileSystem.fsync(fd);
}

export function fsync(fd: number, callback: Callback): void {
    setImmediate(() => {
        try {
            fsyncSync(fd);
            callback(null);
        } catch (e: any) {
            callback(e);
        }
    });
}

// --- Phase 2: Permissions & Timestamps ---

export function chmodSync(path: string, mode: number): void {
    NitroFileSystem.chmod(path, mode);
}

export function chmod(path: string, mode: number, callback?: Callback): void {
    setImmediate(() => {
        try {
            chmodSync(path, mode);
            callback?.(null);
        } catch (e: any) {
            callback?.(e);
        }
    });
}

export function lchmodSync(path: string, mode: number): void {
    NitroFileSystem.lchmod(path, mode);
}

export function lchmod(path: string, mode: number, callback?: Callback): void {
    setImmediate(() => {
        try {
            lchmodSync(path, mode);
            callback?.(null);
        } catch (e: any) {
            callback?.(e);
        }
    });
}

export function fchmodSync(fd: number, mode: number): void {
    NitroFileSystem.fchmod(fd, mode);
}

export function fchmod(fd: number, mode: number, callback?: Callback): void {
    setImmediate(() => {
        try {
            fchmodSync(fd, mode);
            callback?.(null);
        } catch (e: any) {
            callback?.(e);
        }
    });
}

export function chownSync(path: string, uid: number, gid: number): void {
    NitroFileSystem.chown(path, uid, gid);
}

export function chown(path: string, uid: number, gid: number, callback?: Callback): void {
    setImmediate(() => {
        try {
            chownSync(path, uid, gid);
            callback?.(null);
        } catch (e: any) {
            callback?.(e);
        }
    });
}

export function fchownSync(fd: number, uid: number, gid: number): void {
    NitroFileSystem.fchown(fd, uid, gid);
}

export function fchown(fd: number, uid: number, gid: number, callback?: Callback): void {
    setImmediate(() => {
        try {
            fchownSync(fd, uid, gid);
            callback?.(null);
        } catch (e: any) {
            callback?.(e);
        }
    });
}

export function lchownSync(path: string, uid: number, gid: number): void {
    NitroFileSystem.lchown(path, uid, gid);
}

export function lchown(path: string, uid: number, gid: number, callback?: Callback): void {
    setImmediate(() => {
        try {
            lchownSync(path, uid, gid);
            callback?.(null);
        } catch (e: any) {
            callback?.(e);
        }
    });
}

export function utimesSync(path: string, atime: string | number | Date, mtime: string | number | Date): void {
    NitroFileSystem.utimes(path, toUnixTimestamp(atime), toUnixTimestamp(mtime));
}

export function utimes(path: string, atime: string | number | Date, mtime: string | number | Date, callback?: Callback): void {
    setImmediate(() => {
        try {
            utimesSync(path, atime, mtime);
            callback?.(null);
        } catch (e: any) {
            callback?.(e);
        }
    });
}

export function lutimesSync(path: string, atime: string | number | Date, mtime: string | number | Date): void {
    NitroFileSystem.lutimes(path, toUnixTimestamp(atime), toUnixTimestamp(mtime));
}

export function lutimes(path: string, atime: string | number | Date, mtime: string | number | Date, callback?: Callback): void {
    setImmediate(() => {
        try {
            lutimesSync(path, atime, mtime);
            callback?.(null);
        } catch (e: any) {
            callback?.(e);
        }
    });
}

export function futimesSync(fd: number, atime: string | number | Date, mtime: string | number | Date): void {
    NitroFileSystem.futimes(fd, toUnixTimestamp(atime), toUnixTimestamp(mtime));
}

export function futimes(fd: number, atime: string | number | Date, mtime: string | number | Date, callback?: Callback): void {
    setImmediate(() => {
        try {
            futimesSync(fd, atime, mtime);
            callback?.(null);
        } catch (e: any) {
            callback?.(e);
        }
    });
}

// --- Phase 3: Links ---

export function linkSync(existingPath: string, newPath: string): void {
    NitroFileSystem.link(existingPath, newPath);
}

export function link(existingPath: string, newPath: string, callback?: Callback): void {
    setImmediate(() => {
        try {
            linkSync(existingPath, newPath);
            callback?.(null);
        } catch (e: any) {
            callback?.(e);
        }
    });
}

export function symlinkSync(target: string, path: string, type?: string): void {
    // type argument is ignored on posix usually, and we only support posix for now
    NitroFileSystem.symlink(target, path);
}

export function symlink(target: string, path: string, type?: string | Callback, callback?: Callback): void {
    if (typeof type === 'function') {
        callback = type;
        type = undefined;
    }
    setImmediate(() => {
        try {
            symlinkSync(target, path, type as string);
            callback?.(null);
        } catch (e: any) {
            callback?.(e);
        }
    });
}

export function readlinkSync(path: string, options?: { encoding?: string } | string): string {
    return NitroFileSystem.readlink(path);
}

export function readlink(path: string, options?: { encoding?: string } | string | Callback<string>, callback?: Callback<string>): void {
    if (typeof options === 'function') {
        callback = options;
        options = undefined;
    }
    setImmediate(() => {
        try {
            const res = readlinkSync(path, options as any);
            callback?.(null, res);
        } catch (e: any) {
            callback?.(e);
        }
    });
}

export function realpathSync(path: string, options?: { encoding?: string } | string): string {
    return NitroFileSystem.realpath(path);
}

export function realpath(path: string, options?: { encoding?: string } | string | Callback<string>, callback?: Callback<string>): void {
    if (typeof options === 'function') {
        callback = options;
        options = undefined;
    }
    setImmediate(() => {
        try {
            const res = realpathSync(path, options as any);
            callback?.(null, res);
        } catch (e: any) {
            callback?.(e);
        }
    });
}

// --- Phase 4: Modern Features ---

export function mkdtempSync(prefix: string, options?: any): string {
    // options (encoding) ignored for now
    return NitroFileSystem.mkdtemp(prefix);
}

export function mkdtemp(prefix: string, options?: any | Callback<string>, callback?: Callback<string>): void {
    if (typeof options === 'function') {
        callback = options;
        options = undefined;
    }
    setImmediate(() => {
        try {
            const res = mkdtempSync(prefix, options);
            callback?.(null, res);
        } catch (e: any) {
            callback?.(e);
        }
    });
}

export function rmSync(path: string, options?: RmOptions): void {
    const recursive = options?.recursive || false;
    NitroFileSystem.rm(path, recursive);
}

export function rm(path: string, options?: RmOptions | Callback, callback?: Callback): void {
    if (typeof options === 'function') {
        callback = options;
        options = undefined;
    }
    setImmediate(() => {
        try {
            rmSync(path, options as RmOptions);
            callback?.(null);
        } catch (e: any) {
            callback?.(e);
        }
    });
}

// --- Vector I/O (readv/writev) ---

export function readvSync(fd: number, buffers: ArrayBufferView[], position?: number | null): number {
    const pos = position === null || position === undefined ? -1 : position;

    // Convert ArrayBufferViews to ArrayBuffers for native call
    const arrayBuffers: ArrayBuffer[] = buffers.map(buf => {
        if (buf instanceof Buffer) {
            return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
        }
        return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
    });

    const totalRead = NitroFileSystem.readv(fd, arrayBuffers, pos);

    // Copy data back to original buffers (native writes to sliced copies)
    let offset = 0;
    for (let i = 0; i < buffers.length && offset < totalRead; i++) {
        const buf = buffers[i];
        const src = new Uint8Array(arrayBuffers[i]);
        const dst = buf instanceof Buffer ? buf : new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
        const copyLen = Math.min(dst.length, totalRead - offset);
        (dst as Uint8Array).set(src.subarray(0, copyLen));
        offset += copyLen;
    }

    return totalRead;
}

export function readv(fd: number, buffers: ArrayBufferView[], callback: ReadvCallback): void;
export function readv(fd: number, buffers: ArrayBufferView[], position: number | null, callback: ReadvCallback): void;
export function readv(fd: number, buffers: ArrayBufferView[], positionOrCallback: number | null | ReadvCallback, callback?: ReadvCallback): void {
    let position: number | null;
    let cb: ReadvCallback;

    if (typeof positionOrCallback === 'function') {
        position = null;
        cb = positionOrCallback;
    } else {
        position = positionOrCallback;
        cb = callback!;
    }

    setImmediate(() => {
        try {
            const bytesRead = readvSync(fd, buffers, position);
            cb(null, bytesRead, buffers);
        } catch (e: any) {
            cb(e);
        }
    });
}

export function writevSync(fd: number, buffers: ArrayBufferView[], position?: number | null): number {
    const pos = position === null || position === undefined ? -1 : position;

    // Convert ArrayBufferViews to ArrayBuffers for native call
    const arrayBuffers: ArrayBuffer[] = buffers.map(buf => {
        if (buf instanceof Buffer) {
            return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
        }
        return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
    });

    return NitroFileSystem.writev(fd, arrayBuffers, pos);
}

export function writev(fd: number, buffers: ArrayBufferView[], callback: WritevCallback): void;
export function writev(fd: number, buffers: ArrayBufferView[], position: number | null, callback: WritevCallback): void;
export function writev(fd: number, buffers: ArrayBufferView[], positionOrCallback: number | null | WritevCallback, callback?: WritevCallback): void {
    let position: number | null;
    let cb: WritevCallback;

    if (typeof positionOrCallback === 'function') {
        position = null;
        cb = positionOrCallback;
    } else {
        position = positionOrCallback;
        cb = callback!;
    }

    setImmediate(() => {
        try {
            const bytesWritten = writevSync(fd, buffers, position);
            cb(null, bytesWritten, buffers);
        } catch (e: any) {
            cb(e);
        }
    });
}

// fdatasync is an alias to fsync (as documented)
export function fdatasyncSync(fd: number): void {
    fsyncSync(fd);
}

export function fdatasync(fd: number, callback: Callback): void {
    fsync(fd, callback);
}


export function appendFileSync(file: string | number | Buffer, data: string | Buffer, options?: { encoding?: BufferEncoding; mode?: number; flag?: string } | BufferEncoding): void {
    let mode = 0o666;
    let flag = 'a';

    if (typeof options === 'object' && options !== null) {
        mode = options.mode || mode;
        flag = options.flag || flag;
    }

    const buf = typeof data === 'string' ? Buffer.from(data) : data;

    // Handle file descriptor
    if (typeof file === 'number') {
        writeSync(file, buf);
        return;
    }

    const path = typeof file === 'string' ? file : file.toString();
    const fd = openSync(path, flag, mode);
    try {
        writeSync(fd, buf);
    } finally {
        closeSync(fd);
    }
}

export function appendFile(file: string | number | Buffer, data: string | Buffer, options?: { encoding?: BufferEncoding; mode?: number; flag?: string } | BufferEncoding | Callback, callback?: Callback): void {
    if (typeof options === 'function') {
        callback = options;
        options = undefined;
    }

    let mode = 0o666;
    let flag = 'a';

    if (typeof options === 'object' && options !== null) {
        mode = options.mode || mode;
        flag = options.flag || flag;
    }

    const buf = typeof data === 'string' ? Buffer.from(data) : data;

    if (typeof file === 'number') {
        write(file, buf, (err: Error | null) => {
            callback?.(err);
        });
        return;
    }

    const path = typeof file === 'string' ? file : file.toString();

    open(path, flag, mode, (err, fd) => {
        if (err) {
            callback?.(err);
            return;
        }
        write(fd!, buf, (err) => {
            close(fd!, (closeErr) => {
                callback?.(err || closeErr);
            });
        });
    });
}




// --- High-level Operations ---

export function readFile(path: string, options?: { encoding?: string; flag?: string } | string | Callback<Buffer | string>, callback?: Callback<Buffer | string>): void {
    if (typeof options === 'function') {
        callback = options;
        options = undefined;
    }

    // Parse options (encoding/flag) if needed
    let encoding: string | undefined;
    if (typeof options === 'string') {
        encoding = options;
    } else if (typeof options === 'object') {
        encoding = options?.encoding;
    }

    setImmediate(() => {
        try {
            const arrayBuffer = NitroFileSystem.readFile(path);
            const buffer = Buffer.from(arrayBuffer);
            if (encoding) {
                callback?.(null, buffer.toString(encoding as BufferEncoding));
            } else {
                callback?.(null, buffer);
            }
        } catch (e: any) {
            callback?.(e);
        }
    });
}

export function readFileSync(path: string, options?: { encoding?: string; flag?: string } | string): Buffer | string {
    let encoding: string | undefined;
    if (typeof options === 'string') {
        encoding = options;
    } else if (typeof options === 'object') {
        encoding = options?.encoding;
    }

    const arrayBuffer = NitroFileSystem.readFile(path);
    const buffer = Buffer.from(arrayBuffer);

    if (encoding) {
        return buffer.toString(encoding as BufferEncoding);
    }
    return buffer;
}


export function writeFile(path: string, data: string | Buffer | Uint8Array, options?: { encoding?: string; mode?: number; flag?: string } | string | Callback, callback?: Callback): void {
    if (typeof options === 'function') {
        callback = options;
        options = undefined;
    }

    setImmediate(() => {
        try {
            const buffer = typeof data === 'string' ? Buffer.from(data, (typeof options === 'string' ? options : (options as any)?.encoding) || 'utf8') :
                (data instanceof Buffer ? data : Buffer.from(data));

            NitroFileSystem.writeFile(path, buffer.buffer);
            callback?.(null);
        } catch (e: any) {
            callback?.(e);
        }
    });
}

export function writeFileSync(path: string, data: string | Buffer | Uint8Array, options?: { encoding?: string; mode?: number; flag?: string } | string): void {
    const buffer = typeof data === 'string' ? Buffer.from(data, (typeof options === 'string' ? options : (options as any)?.encoding) || 'utf8') :
        (data instanceof Buffer ? data : Buffer.from(data));

    NitroFileSystem.writeFile(path, buffer.buffer);
}

// exports
export * from './Dir';
export * from './ReadStream';
export * from './WriteStream';
export * from './FSWatcher';

import { ReadStream, ReadStreamOptions } from './ReadStream';
import { WriteStream, WriteStreamOptions } from './WriteStream';
import { Dir } from './Dir';

export function createReadStream(path: string | Buffer, options?: string | ReadStreamOptions): ReadStream {
    if (typeof options === 'string') {
        options = { encoding: options as BufferEncoding };
    }
    return new ReadStream(path, options);
}

export function createWriteStream(path: string | Buffer, options?: string | WriteStreamOptions): WriteStream {
    if (typeof options === 'string') {
        options = { encoding: options as BufferEncoding };
    }
    return new WriteStream(path, options);
}

export function opendirSync(path: string, options?: any): Dir {
    const iterator = NitroFileSystem.opendir(path);
    return new Dir(iterator, path);
}

export function opendir(path: string, options?: any | ((err: NodeJS.ErrnoException | null, dir: Dir) => void), callback?: (err: NodeJS.ErrnoException | null, dir: Dir) => void): void {
    if (typeof options === 'function') {
        callback = options;
        options = undefined;
    }
    setImmediate(() => {
        try {
            const dir = opendirSync(path, options);
            callback?.(null, dir);
        } catch (e: any) {
            callback?.(e, null as any);
        }
    });
}

import { FSWatcher, WatchEventType, WatchListener } from './FSWatcher';

/**
 * Watch for changes on a file or directory.
 * Returns an FSWatcher that emits 'change' events.
 */
export function watch(
    filename: string | Buffer,
    options?: { persistent?: boolean; recursive?: boolean; encoding?: BufferEncoding } | WatchListener,
    listener?: WatchListener
): FSWatcher {
    const path = typeof filename === 'string' ? filename : filename.toString();

    if (typeof options === 'function') {
        listener = options;
        options = undefined;
    }

    const watcher = new FSWatcher(path, options as any);

    if (listener) {
        watcher.on('change', listener);
    }

    return watcher;
}

// --- Promises API ---
export const promises = {
    open: async (path: string, flags: string | number = 'r', mode: number = 0o666): Promise<number> => {
        return new Promise((resolve, reject) => {
            open(path, flags, mode, (err, fd) => {
                if (err) reject(err);
                else resolve(fd!);
            });
        });
    },
    read: async (fd: number, buffer: Buffer | Uint8Array, offset: number, length: number, position: number | null): Promise<number> => {
        return new Promise((resolve, reject) => {
            read(fd, buffer, offset, length, position, (err, bytesRead) => {
                if (err) reject(err);
                else resolve(bytesRead!);
            });
        });
    },
    close: async (fd: number): Promise<void> => {
        return new Promise((resolve, reject) => {
            close(fd, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    },
    readFile: async (path: string, options?: { encoding?: string; flag?: string } | string): Promise<string | Buffer> => {
        return new Promise((resolve, reject) => {
            readFile(path, options, (err, data) => {
                if (err) reject(err);
                else resolve(data!);
            });
        });
    },
    writeFile: async (path: string, data: string | Buffer | Uint8Array, options?: { encoding?: string; mode?: number; flag?: string } | string): Promise<void> => {
        return new Promise((resolve, reject) => {
            writeFile(path, data, options, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    },
    unlink: async (path: string): Promise<void> => {
        return new Promise((resolve, reject) => {
            unlink(path, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    },
    mkdir: async (path: string, mode?: number): Promise<void> => {
        return new Promise((resolve, reject) => {
            mkdir(path, mode, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    },
    rmdir: async (path: string): Promise<void> => {
        return new Promise((resolve, reject) => {
            rmdir(path, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    },
    readdir: async (path: string): Promise<string[]> => {
        return new Promise((resolve, reject) => {
            readdir(path, (err, files) => {
                if (err) reject(err);
                else resolve(files!);
            });
        });
    },
    rename: async (oldPath: string, newPath: string): Promise<void> => {
        return new Promise((resolve, reject) => {
            rename(oldPath, newPath, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    },
    copyFile: async (src: string, dest: string, flags: number = 0): Promise<void> => {
        return new Promise((resolve, reject) => {
            copyFile(src, dest, flags, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    },
    link: async (existingPath: string, newPath: string): Promise<void> => {
        return new Promise((resolve, reject) => {
            link(existingPath, newPath, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    },
    symlink: async (target: string, path: string, type?: string): Promise<void> => {
        return new Promise((resolve, reject) => {
            symlink(target, path, type, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    },
    readlink: async (path: string, options?: { encoding?: string } | string): Promise<string> => {
        return new Promise((resolve, reject) => {
            readlink(path, options, (err, res) => {
                if (err) reject(err);
                else resolve(res!);
            });
        });
    },
    realpath: async (path: string, options?: { encoding?: string } | string): Promise<string> => {
        return new Promise((resolve, reject) => {
            realpath(path, options, (err, res) => {
                if (err) reject(err);
                else resolve(res!);
            });
        });
    },
    mkdtemp: async (prefix: string, options?: any): Promise<string> => {
        return new Promise((resolve, reject) => {
            mkdtemp(prefix, options, (err, res) => {
                if (err) reject(err);
                else resolve(res!);
            });
        });
    },
    rm: async (path: string, options?: RmOptions): Promise<void> => {
        return new Promise((resolve, reject) => {
            rm(path, options, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    },
    stat: async (path: string): Promise<Stats> => {
        return new Promise((resolve, reject) => {
            stat(path, (err, stats) => {
                if (err) reject(err);
                else resolve(stats as Stats);
            });
        });
    },
    access: async (path: string, mode: number = constants.F_OK): Promise<void> => {
        return new Promise((resolve, reject) => {
            access(path, mode, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    },
    truncate: async (path: string, len: number = 0): Promise<void> => {
        return new Promise((resolve, reject) => {
            truncate(path, len, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    },
    ftruncate: async (fd: number, len: number = 0): Promise<void> => {
        return new Promise((resolve, reject) => {
            ftruncate(fd, len, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    },
    fsync: async (fd: number): Promise<void> => {
        return new Promise((resolve, reject) => {
            fsync(fd, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    },
    chmod: async (path: string, mode: number): Promise<void> => {
        return new Promise((resolve, reject) => {
            chmod(path, mode, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    },
    fchmod: async (fd: number, mode: number): Promise<void> => {
        return new Promise((resolve, reject) => {
            fchmod(fd, mode, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    },
    chown: async (path: string, uid: number, gid: number): Promise<void> => {
        return new Promise((resolve, reject) => {
            chown(path, uid, gid, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    },
    fchown: async (fd: number, uid: number, gid: number): Promise<void> => {
        return new Promise((resolve, reject) => {
            fchown(fd, uid, gid, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    },
    utimes: async (path: string, atime: string | number | Date, mtime: string | number | Date): Promise<void> => {
        return new Promise((resolve, reject) => {
            utimes(path, atime, mtime, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    },
    futimes: async (fd: number, atime: string | number | Date, mtime: string | number | Date): Promise<void> => {
        return new Promise((resolve, reject) => {
            futimes(fd, atime, mtime, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    },
    appendFile: async (file: string | number | Buffer, data: string | Buffer, options?: { encoding?: BufferEncoding; mode?: number; flag?: string } | BufferEncoding): Promise<void> => {
        return new Promise((resolve, reject) => {
            appendFile(file, data, options, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    },
    // Phase 3: Additional Promises API
    lstat: async (path: string): Promise<Stats> => {
        return new Promise((resolve, reject) => {
            lstat(path, (err, stats) => {
                if (err) reject(err);
                else resolve(stats as Stats);
            });
        });
    },
    lchmod: async (path: string, mode: number): Promise<void> => {
        return new Promise((resolve, reject) => {
            lchmod(path, mode, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    },
    lchown: async (path: string, uid: number, gid: number): Promise<void> => {
        return new Promise((resolve, reject) => {
            lchown(path, uid, gid, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    },
    lutimes: async (path: string, atime: string | number | Date, mtime: string | number | Date): Promise<void> => {
        return new Promise((resolve, reject) => {
            lutimes(path, atime, mtime, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    },
    opendir: async (path: string, options?: any): Promise<Dir> => {
        return new Promise((resolve, reject) => {
            opendir(path, options, (err, dir) => {
                if (err) reject(err);
                else resolve(dir);
            });
        });
    },
};


// --- Polling Watcher ---
interface StatWatcher {
    listeners: Array<(curr: Stats, prev: Stats) => void>;
    interval: number;
    timer: NodeJS.Timeout;
    prev: Stats | null;
}

const statWatchers = new Map<string, StatWatcher>();

export function watchFile(filename: string, options: { interval?: number; persistent?: boolean } | ((curr: Stats, prev: Stats) => void), listener?: (curr: Stats, prev: Stats) => void): void {
    const path = filename; // Normalize?
    let interval = 5007;
    let cb: ((curr: Stats, prev: Stats) => void) | undefined;

    if (typeof options === 'function') {
        cb = options;
        listener = undefined;
    } else if (typeof options === 'object' && options !== null) {
        if (options.interval !== undefined) interval = options.interval;
        cb = listener;
    } else {
        cb = listener;
    }

    if (!cb) return;

    let watcher = statWatchers.get(path);
    if (watcher) {
        watcher.listeners.push(cb);
    } else {
        // Start watching
        let prevStats: Stats;
        try {
            prevStats = statSync(path) as Stats;  // Always use regular Stats for watchFile
        } catch {
            // If file doesn't exist, statSync might fail. Node behavior: start mostly with empty stats or wait for exist?
            // Node says: "If the file is missing, the 'change' event will be emitted when it is created."
            // So we treat initial stats as "empty" or handle error.
            // For simplicity, we use "empty" stats or try to stat.
            // Let's assume non-existence = error which we catch.
            // We'll mimic empty stats for prev.
            prevStats = new Stats({ dev: 0, ino: 0, mode: 0, nlink: 0, uid: 0, gid: 0, rdev: 0, size: 0, blksize: 0, blocks: 0, atimeMs: 0, mtimeMs: 0, ctimeMs: 0, birthtimeMs: 0 } as any);
        }

        const timer = setInterval(() => {
            stat(path, (err, curr) => {
                if (err) {
                    // File might be gone.
                    // If prev was valid, emit change?
                    // Node emits change with size 0 etc if deleted.
                    const empty = new Stats({ dev: 0, ino: 0, mode: 0, nlink: 0, uid: 0, gid: 0, rdev: 0, size: 0, blksize: 0, blocks: 0, atimeMs: 0, mtimeMs: 0, ctimeMs: 0, birthtimeMs: 0 } as any);
                    if (watcher && watcher.prev && watcher.prev.mtimeMs !== 0) {
                        // It was there, now gone.
                        watcher.listeners.forEach(l => l(empty, watcher!.prev!));
                        watcher.prev = empty;
                    }
                    return;
                }

                if (watcher && curr) {
                    const currStats = curr as Stats;  // Always Stats in watchFile context
                    if (watcher.prev && watcher.prev.mtimeMs !== currStats.mtimeMs) {
                        // Changed
                        watcher.listeners.forEach(l => l(currStats, watcher!.prev!));
                        watcher.prev = currStats;
                    } else if (watcher.prev === null) {
                        // First sync?
                        watcher.prev = currStats;
                    } else if (watcher.prev.mtimeMs === 0 && currStats.mtimeMs !== 0) {
                        // Created
                        watcher.listeners.forEach(l => l(currStats, watcher!.prev!));
                        watcher.prev = currStats;
                    }
                }
            });
        }, interval);

        watcher = {
            listeners: [cb],
            interval,
            timer,
            prev: prevStats
        };
        statWatchers.set(path, watcher);
    }
}

export function unwatchFile(filename: string, listener?: (curr: Stats, prev: Stats) => void): void {
    const watcher = statWatchers.get(filename);
    if (!watcher) return;

    if (listener) {
        watcher.listeners = watcher.listeners.filter(l => l !== listener);
    } else {
        watcher.listeners = [];
    }

    if (watcher.listeners.length === 0) {
        clearInterval(watcher.timer);
        statWatchers.delete(filename);
    }
}

export function existsSync(path: string): boolean {
    try {
        accessSync(path, constants.F_OK);
        return true;
    } catch {
        return false;
    }
}

export function exists(path: string, callback: (exists: boolean) => void): void {
    access(path, constants.F_OK, (err) => {
        callback(!err);
    });
}

export class Dirent {
    name: string;
    private _mode: number;

    constructor(name: string, mode: number) {
        this.name = name;
        this._mode = mode;
    }

    isDirectory(): boolean {
        return (this._mode & 0o040000) === 0o040000;
    }

    isFile(): boolean {
        return (this._mode & 0o100000) === 0o100000;
    }

    isBlockDevice(): boolean {
        return (this._mode & 0o060000) === 0o060000;
    }

    isCharacterDevice(): boolean {
        return (this._mode & 0o020000) === 0o020000;
    }

    isSymbolicLink(): boolean {
        return (this._mode & 0o120000) === 0o120000;
    }

    isFIFO(): boolean {
        return (this._mode & 0o010000) === 0o010000;
    }

    isSocket(): boolean {
        return (this._mode & 0o140000) === 0o140000;
    }
}


export function readdirSync(path: string, options?: { encoding?: BufferEncoding | null; withFileTypes?: boolean } | BufferEncoding | null): string[] | Dirent[] {
    const files = NitroFileSystem.readdir(path);
    let withFileTypes = false;

    if (typeof options === 'object' && options !== null) {
        withFileTypes = options.withFileTypes === true;
    }

    if (!withFileTypes) {
        return files;
    }

    // Map to Dirent
    return files.map(file => {
        try {
            const s = lstatSync(`${path}/${file}`); // Using lstat to properly identify symlinks
            // s.mode may be number or bigint depending on Stats/BigIntStats
            return new Dirent(file, Number(s.mode));
        } catch {
            // Race condition: file deleted? Return unknown or skip? Node includes it? 
            // We return dummy? Or file generic?
            return new Dirent(file, 0);
        }
    });
}

export function readdir(path: string, options?: { encoding?: BufferEncoding | null; withFileTypes?: boolean } | BufferEncoding | null | ReaddirCallback, callback?: ReaddirCallback): void {
    let cb: ReaddirCallback;
    let withFileTypes = false;

    if (typeof options === 'function') {
        cb = options;
        options = undefined;
    } else {
        cb = callback!;
        if (typeof options === 'object' && options !== null) {
            withFileTypes = options.withFileTypes === true;
        }
    }

    setImmediate(() => {
        try {
            const res = readdirSync(path, { withFileTypes });
            cb(null, res as any);
        } catch (e: any) {
            cb(e);
        }
    });
}


// Export default object
export default {
    // Constants
    constants,
    // Methods
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
    // Vector I/O
    readv,
    readvSync,
    writev,
    writevSync,
    // fdatasync (alias to fsync)
    fdatasync,
    fdatasyncSync,
    // Classes
    Stats,
    BigIntStats,
    Dirent,
    ReadStream,
    WriteStream,
    FSWatcher,
    // Promisified
    promises,
    getTempPath: () => NitroFileSystem.getTempPath(),
};
