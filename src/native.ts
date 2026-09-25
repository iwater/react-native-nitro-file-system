import { NitroModules } from 'react-native-nitro-modules'
import type { HybridFileSystem } from './specs/HybridFileSystem.nitro'

// ── Turning native failures into Node-shaped errors ─────────────────────────
//
// Node's fs errors always carry `code` / `errno` / `syscall` / `path`, and
// `if (err.code === 'ENOENT')` is the universal way to react to them. Until now
// the native layer reported every failure as a bare `-1` (or a thrown
// `std::runtime_error` with no errno behind it), so callers got an `Error` with
// none of those fields, and that branch was silently always false.
//
// `errno` and its POSIX name now come from the native side, resolved against
// the platform's own errno constants - the numbers differ between Darwin and
// Linux (`ENOTEMPTY` is 66 vs 39, `ELOOP` 62 vs 40, ...), so a table here would
// be wrong on one of them.
//
// What stays here are the two pieces that really are a JS concern: which
// `syscall` name Node uses for each operation, and libuv's `uv_strerror` text.

/** native method name -> the `syscall` Node reports for that operation. */
const SYSCALL: Record<string, string> = {
    open: 'open',
    close: 'close',
    read: 'read',
    write: 'write',
    readv: 'readv',
    writev: 'writev',
    // Node's readFile/writeFile report the *open* that failed inside them.
    readFile: 'open',
    writeFile: 'open',
    stat: 'stat',
    lstat: 'lstat',
    fstat: 'fstat',
    access: 'access',
    truncate: 'truncate',
    ftruncate: 'ftruncate',
    fsync: 'fsync',
    chmod: 'chmod',
    lchmod: 'lchmod',
    fchmod: 'fchmod',
    chown: 'chown',
    lchown: 'lchown',
    fchown: 'fchown',
    utimes: 'utimes',
    lutimes: 'lutimes',
    futimes: 'futimes',
    link: 'link',
    symlink: 'symlink',
    readlink: 'readlink',
    realpath: 'realpath',
    mkdir: 'mkdir',
    rmdir: 'rmdir',
    readdir: 'scandir',
    opendir: 'scandir',
    unlink: 'unlink',
    rename: 'rename',
    copyFile: 'copyfile',
    cp: 'cp',
    rm: 'rm',
    mkdtemp: 'mkdtemp',
    watch: 'watch',
}

// libuv's `uv_strerror` wording, so `String(err)` matches Node's.
// Only the codes that can actually come out of fs are listed; anything else
// keeps the native message rather than being given a made-up one.
const DESCRIPTION: Record<string, string> = {
    EACCES: 'permission denied',
    EBADF: 'bad file descriptor',
    EBUSY: 'resource busy or locked',
    EEXIST: 'file already exists',
    EFBIG: 'file too large',
    EINVAL: 'invalid argument',
    EIO: 'input/output error',
    EISDIR: 'illegal operation on a directory',
    ELOOP: 'too many symbolic links encountered',
    EMFILE: 'too many open files',
    EMLINK: 'too many links',
    ENAMETOOLONG: 'file name too long',
    ENODEV: 'no such device',
    ENOENT: 'no such file or directory',
    ENOSPC: 'no space left on device',
    ENOTDIR: 'not a directory',
    ENOTEMPTY: 'directory not empty',
    ENXIO: 'no such device or address',
    EOVERFLOW: 'value too large for defined data type',
    EPERM: 'operation not permitted',
    EPIPE: 'broken pipe',
    EROFS: 'read-only file system',
    ESPIPE: 'invalid seek',
    EXDEV: 'cross-device link not permitted',
    EDQUOT: 'disk quota exceeded',
    EILSEQ: 'invalid or incomplete multibyte or wide character',
}

const native = NitroModules.createHybridObject<HybridFileSystem>('NitroNodeFileSystem')

/**
 * Read the errno the native layer recorded for the failure that just happened.
 * Returns `null` when there is none (the failure was detected in C++ rather
 * than by the OS, or the code is not one we can name).
 */
function lastError(): { errno: number; code: string } | null {
    let errno = 0
    let code = ''
    try {
        errno = native.lastErrno as number
        code = native.lastErrorCode as string
    } catch {
        return null
    }
    if (!errno || !code || code === 'UNKNOWN') return null
    return { errno, code }
}

/**
 * Build the Node-shaped error for a failed native call, or return the original
 * error untouched when there is no usable errno behind it.
 *
 * Deliberately never invents a `code`: an error with `code === undefined` is
 * visible to the caller, while a plausible but wrong `code` silently sends
 * `if (err.code === 'ENOENT')` down the wrong branch.
 */
function withNodeFields(e: unknown, method: string, args: any[]): unknown {
    const err = lastError()
    if (!err) return e

    const syscall = SYSCALL[method]
    const path = typeof args[0] === 'string' ? args[0] : undefined
    const description = DESCRIPTION[err.code]

    // Rebuild the error only when Node's whole message can be produced;
    // otherwise attach what we know to the original error. An error with a real
    // `code` and a slightly different message beats one with no `code` at all.
    let target: any = e
    if (description && syscall && path !== undefined) {
        target = new Error(`${err.code}: ${description}, ${syscall} '${path}'`)
    }
    if (target && typeof target === 'object') {
        // Node inserts them in this order, and `Object.keys(err)` is observable.
        target.errno = -err.errno
        target.code = err.code
        if (syscall) target.syscall = syscall
        if (path !== undefined) target.path = path
    }
    return target
}

/**
 * Build a Node-shaped error for operations that report failure through a
 * sentinel return value (`open` returns -1) instead of throwing.
 */
export function nodeFsError(syscall: string, path: string): Error {
    const err = lastError()
    const description = err ? DESCRIPTION[err.code] : undefined
    const target: any =
        err && description
            ? new Error(`${err.code}: ${description}, ${syscall} '${path}'`)
            : new Error(`${syscall} failed: '${path}'`)
    if (err) {
        target.errno = -err.errno
        target.code = err.code
    }
    target.syscall = syscall
    target.path = path
    return target
}

// Wrapped so that every native failure comes out with Node's error shape.
// The wrappers are cached per method: this sits on the hot path of
// read/write/readv/writev, and building a closure per call is not free.
const wrappers = new Map<string, Function>()

export const NitroFileSystem = new Proxy(native, {
    get(target, prop) {
        if (typeof prop !== 'string') return Reflect.get(target, prop)
        const cached = wrappers.get(prop)
        if (cached) return cached
        const value = Reflect.get(target, prop)
        if (typeof value !== 'function') return value
        const wrapped = function (...args: any[]) {
            try {
                return (value as Function).apply(target, args)
            } catch (e) {
                throw withNodeFields(e, prop, args)
            }
        }
        wrappers.set(prop, wrapped)
        return wrapped
    },
}) as HybridFileSystem
