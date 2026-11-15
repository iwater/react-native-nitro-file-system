import type { Buffer } from 'react-native-nitro-buffer';
import type { Stats as NitroStats, StatFs } from './specs/HybridFileSystem.nitro';

export type PathLike = string | URL;
export type HashAlgorithm = 'md5' | 'sha1' | 'sha256' | 'sha512';

export interface DiskSpaceInfo {
    totalBytes: number;
    availableBytes: number;
    freeBytes: number;
}

export interface BigIntStatFs {
    totalBytes: bigint;
    availableBytes: bigint;
    freeBytes: bigint;
    type: bigint;
    bsize: bigint;
    blocks: bigint;
    bfree: bigint;
    bavail: bigint;
    files: bigint;
    ffree: bigint;
}

export interface NitroPaths {
    cache: string;
    document: string;
    download: string;
    externalCache: string;
    external: string;
    externalStorage: string;
    library: string;
    mainBundle: string;
    pictures: string;
    temp: string;
    bundleUri: string;
    documentUri: string;
    cacheUri: string;
    tempUri: string;
    readonly availableDiskSpace: number;
    readonly totalDiskSpace: number;
}

export interface FsConstants {
    // open(2) flags - values come from the platform
    O_RDONLY: number;
    O_WRONLY: number;
    O_RDWR: number;
    O_CREAT: number;
    O_EXCL: number;
    O_NOCTTY: number;
    O_TRUNC: number;
    O_APPEND: number;
    O_DIRECTORY: number;
    O_NOFOLLOW: number;
    O_SYNC: number;
    O_DSYNC: number;
    O_NONBLOCK: number;
    O_NOATIME?: number;
    O_SYMLINK?: number;
    O_DIRECT?: number;
    // mode bits and access(2) - identical on every POSIX platform
    S_IRWXU: number;
    S_IRUSR: number;
    S_IWUSR: number;
    S_IXUSR: number;
    S_IRWXG: number;
    S_IRGRP: number;
    S_IWGRP: number;
    S_IXGRP: number;
    S_IRWXO: number;
    S_IROTH: number;
    S_IWOTH: number;
    S_IXOTH: number;
    F_OK: number;
    R_OK: number;
    W_OK: number;
    X_OK: number;
}

export const POSIX_MODE_AND_ACCESS_CONSTANTS = {
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
} as const;

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

export interface CpOptions {
    recursive?: boolean;
    force?: boolean;
    errorOnExist?: boolean;
    dereference?: boolean;
    preserveTimestamps?: boolean;
}

export interface RmdirOptions {
    maxRetries?: number;
    recursive?: boolean;
    retryDelay?: number;
}

export interface StatOptions {
    bigint?: boolean;
}

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

        // ⚠️ 必须 `Math.round`，不能直接 `new Date(stats.mtimeMs)`。
        // `mtimeMs` 带亚毫秒小数（实测 1790508365815.8477），而 `new Date(<number>)` 按规范是
        // **截断**（ToIntegerOrInfinity）⇒ 直接传会比 Node 少 1 ms。Node 的规则实测是
        // **四舍五入到毫秒**（`os.utime` 受控实验：0.499999→0、0.5→1、0.8477→1）。
        // 危害路径：`send` 的 ETag = `W/"<size hex>-<mtime.getTime() hex>"` ⇒
        // `res.sendFile` / `res.download` / `express.static` 的 ETag 与 Node 差 1
        // （实测 `W/"11-1a0e29d77f8"` vs `W/"11-1a0e29d77f7"`）。
        // ⚠️ 只有 `Stats` 是四舍五入 —— `BigIntStats` 是**截断**（见该类注释），别统一。
        this.atime = new Date(Math.round(stats.atimeMs));
        this.mtime = new Date(Math.round(stats.mtimeMs));
        this.ctime = new Date(Math.round(stats.ctimeMs));
        this.birthtime = new Date(Math.round(stats.birthtimeMs));
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

        // ⚠️⚠️ `BigIntStats` 与 `Stats` 的取整规则**不同**，别「统一」（Node 实测）：
        //     Stats.mtime      = new Date(**round**(mtimeMs))
        //     BigIntStats.mtime = new Date(**trunc**(mtimeMs))  ← 即 new Date(Number(this.mtimeMs))
        // 同一文件实测（ns=499900000）：`Stats` 得 …500、`BigIntStats` 得 …499。
        // ⇒ 这里**不能**跟着 `Stats` 改成 `Math.round`（改了就与 Node 差 1 ms）。
        // 用 `Number(this.xxxMs)` 是刻意的：镜像 Node 的结构（它由 BigInt 的 ms 构造 Date），
        // 于是 `mtime.getTime() === Number(mtimeMs)` 这条不变量两侧都成立。
        this.atime = new Date(Number(this.atimeMs));
        this.mtime = new Date(Number(this.mtimeMs));
        this.ctime = new Date(Number(this.ctimeMs));
        this.birthtime = new Date(Number(this.birthtimeMs));
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

export class Dirent {
    name: string;
    private _mode: number;

    constructor(name: string, mode: number = 0) {
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

export function getFlagsFromConstants(
    c: Pick<FsConstants, 'O_RDONLY' | 'O_WRONLY' | 'O_RDWR' | 'O_CREAT' | 'O_TRUNC' | 'O_APPEND'>,
    flag: string | number | undefined
): number {
    if (typeof flag === 'number') return flag;
    if (flag === undefined) return c.O_RDONLY;
    switch (flag) {
        case 'r': return c.O_RDONLY;
        case 'r+': return c.O_RDWR;
        case 'w': return c.O_TRUNC | c.O_CREAT | c.O_WRONLY;
        case 'w+': return c.O_TRUNC | c.O_CREAT | c.O_RDWR;
        case 'a': return c.O_APPEND | c.O_CREAT | c.O_WRONLY;
        case 'a+': return c.O_APPEND | c.O_CREAT | c.O_RDWR;
        default: return c.O_RDONLY;
    }
}

function safeDecodeURIComponent(value: string): string {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
}

export function normalizePath(path: PathLike): string {
    if (typeof path === 'object' && path instanceof URL) {
        if (path.protocol !== 'file:') {
            return path.toString();
        }
        return safeDecodeURIComponent(path.pathname);
    }
    if (typeof path === 'string') {
        if (path.startsWith('file://')) {
            return safeDecodeURIComponent(path.substring(7));
        }
        if (path.startsWith('file:/')) {
            return safeDecodeURIComponent(path.substring(5));
        }
    }
    return path as string;
}

/** 将本地物理路径转换为标准 URI（已含非 file 协议则原样返回；file:// 或物理路径统一按段百分号编码） */
export function toFileUri(path: PathLike): string {
    if (!path) return '';
    if (typeof path === 'object' && path instanceof URL) {
        return path.toString();
    }
    const raw = String(path);
    if (!raw) return '';
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(raw) && !raw.startsWith('file://')) {
        return raw;
    }
    const physical = (raw.startsWith('file://') || raw.startsWith('file:/'))
        ? normalizePath(raw)
        : raw;
    const normalized = physical.startsWith('/') ? physical : `/${physical}`;
    const encoded = normalized
        .split('/')
        .map((seg) => encodeURIComponent(seg))
        .join('/');
    return `file://${encoded}`;
}

export function toBigIntStatFs(s: StatFs): BigIntStatFs {
    return {
        totalBytes: BigInt(Math.trunc(s.totalBytes)),
        availableBytes: BigInt(Math.trunc(s.availableBytes)),
        freeBytes: BigInt(Math.trunc(s.freeBytes)),
        type: BigInt(Math.trunc(s.type)),
        bsize: BigInt(Math.trunc(s.bsize)),
        blocks: BigInt(Math.trunc(s.blocks)),
        bfree: BigInt(Math.trunc(s.bfree)),
        bavail: BigInt(Math.trunc(s.bavail)),
        files: BigInt(Math.trunc(s.files)),
        ffree: BigInt(Math.trunc(s.ffree)),
    };
}

