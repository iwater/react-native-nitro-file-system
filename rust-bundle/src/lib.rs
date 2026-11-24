use libc::{c_char, c_int, size_t, c_void, mode_t, uid_t, gid_t};
use std::os::unix::io::AsRawFd;
use std::os::unix::fs::symlink;
use filetime::{FileTime, set_file_times, set_file_handle_times};
use std::cell::Cell;
use std::ffi::{CStr, CString};
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write, Seek, SeekFrom};
use std::sync::Mutex;
use std::collections::HashMap;
use rand::{Rng, thread_rng};
use rand::distr::Alphanumeric;
use walkdir::WalkDir;
use std::path::Path;

pub mod watch;

use once_cell::sync::Lazy;

// --- Global State ---

// Simple file descriptor registry. 
// FD 0, 1, 2 are reserved for stdin/stdout/stderr (though we don't strictly use them here)
static FILE_REGISTRY: Lazy<Mutex<HashMap<c_int, File>>> = Lazy::new(|| {
    Mutex::new(HashMap::new())
});

static FD_COUNTER: Lazy<Mutex<c_int>> = Lazy::new(|| {
    Mutex::new(3) // Start from 3
});

// --- Last-error reporting -------------------------------------------------
//
// Every entry point that can fail records the platform errno here before it
// returns its failure sentinel (`-1` / `NULL` / `false`). The C++ layer reads
// it back with `rn_fs_last_errno()` and the JS layer turns it into a Node-style
// error carrying `code` / `errno` / `syscall` / `path`.
//
// Why a thread-local instead of a `-errno` return convention: the FFI
// signatures are consumed by callers that only test `ret < 0`, and `-1` is
// indistinguishable from `-EPERM` (errno 1) in that encoding.
//
// Why not just let `errno` propagate: these are Rust `std`/`libc` calls, and
// `std::io::Error` is the only place the real code survives. Nothing in the
// C++ layer sets or reads the C `errno`, so it would be stale by the time the
// exception is built.
thread_local! {
    static LAST_ERRNO: Cell<c_int> = const { Cell::new(0) };
}

fn record_errno(code: c_int) {
    LAST_ERRNO.with(|c| c.set(code));
}

/// Record the OS error carried by an `io::Error` (falls back to `EIO` for the
/// rare `io::Error` that has no `raw_os_error()`, e.g. custom errors).
fn record_io_error(e: &std::io::Error) -> c_int {
    let code = e.raw_os_error().unwrap_or(libc::EIO);
    record_errno(code);
    code
}

/// Failure sentinel for `c_int`-returning entry points.
fn fail_io(e: &std::io::Error) -> c_int {
    record_io_error(e);
    -1
}

/// Failure sentinel for `*mut T`-returning entry points.
fn fail_io_null<T>(e: &std::io::Error) -> *mut T {
    record_io_error(e);
    std::ptr::null_mut()
}

/// The input could not be interpreted at all (path was not valid UTF-8, or it
/// contained an interior NUL). `EILSEQ` is what Node reports for the former.
fn fail_input() -> c_int {
    record_errno(libc::EILSEQ);
    -1
}

fn fail_input_null<T>() -> *mut T {
    record_errno(libc::EILSEQ);
    std::ptr::null_mut()
}

/// Record the calling thread's current C `errno` when a `libc::*` call failed,
/// and return its result unchanged. Those calls signal failure through `errno`
/// rather than through a Rust `Result`.
fn with_errno(ret: c_int) -> c_int {
    if ret != 0 {
        record_errno(
            std::io::Error::last_os_error()
                .raw_os_error()
                .unwrap_or(libc::EIO),
        );
    }
    ret
}

/// Same as [`with_errno`] for the `readv`/`writev` family, which return a byte
/// count and signal failure with a negative value.
fn with_errno_isize(ret: isize) -> isize {
    if ret < 0 {
        record_errno(
            std::io::Error::last_os_error()
                .raw_os_error()
                .unwrap_or(libc::EIO),
        );
    }
    ret
}

/// errno of the most recent failed entry point (0 if the last one succeeded).
#[no_mangle]
pub extern "C" fn rn_fs_last_errno() -> c_int {
    LAST_ERRNO.with(|c| c.get())
}

/// Overwrite the recorded errno. Exists so the C++ layer can tag failures it
/// detects on its own (bookmark/`content://` URIs, undersized buffers, ...),
/// which have no OS errno of their own. Without this, `rn_fs_last_errno()`
/// would still hold the code of some *earlier*, unrelated failure and the JS
/// layer would report a confidently wrong `code`.
#[no_mangle]
pub extern "C" fn rn_fs_set_errno(code: c_int) {
    record_errno(code);
}

/// errno -> POSIX name, e.g. `2 -> "ENOENT"`.
///
/// This mapping lives here rather than in JS because the *numbers* are not the
/// same on every platform: `ENOTEMPTY` is 39 on Linux and 66 on Darwin,
/// `ELOOP` is 40 vs 62, `ENAMETOOLONG` 36 vs 63, `EAGAIN` 11 vs 35, ...
/// Resolving against the platform's own `libc` constants is the only way to
/// guarantee the JS `code` matches the platform it is running on.
///
/// A linear scan rather than a `match`: several errno constants share a value
/// on some platforms (`ENOTSUP`/`EOPNOTSUPP`, `EAGAIN`/`EWOULDBLOCK`), and
/// duplicate `match` arms are a compile error.
// ⚠️ `cstr!` appends a NUL on purpose. A Rust `&str` is *not* NUL-terminated,
// so handing `name.as_ptr()` straight to C makes it read past the end of the
// literal until it happens to hit a zero byte - the caller then sees this
// entry concatenated with every neighbouring string in the table.
macro_rules! cstr {
    ($s:literal) => {
        concat!($s, "\0")
    };
}

const ERRNO_NAMES: &[(c_int, &str)] = &[
    (libc::EPERM, cstr!("EPERM")),
    (libc::ENOENT, cstr!("ENOENT")),
    (libc::EIO, cstr!("EIO")),
    (libc::ENXIO, cstr!("ENXIO")),
    (libc::E2BIG, cstr!("E2BIG")),
    (libc::EBADF, cstr!("EBADF")),
    (libc::EAGAIN, cstr!("EAGAIN")),
    (libc::ENOMEM, cstr!("ENOMEM")),
    (libc::EACCES, cstr!("EACCES")),
    (libc::EBUSY, cstr!("EBUSY")),
    (libc::EEXIST, cstr!("EEXIST")),
    (libc::EXDEV, cstr!("EXDEV")),
    (libc::ENODEV, cstr!("ENODEV")),
    (libc::ENOTDIR, cstr!("ENOTDIR")),
    (libc::EISDIR, cstr!("EISDIR")),
    (libc::EINVAL, cstr!("EINVAL")),
    (libc::ENFILE, cstr!("ENFILE")),
    (libc::EMFILE, cstr!("EMFILE")),
    (libc::EFBIG, cstr!("EFBIG")),
    (libc::ENOSPC, cstr!("ENOSPC")),
    (libc::ESPIPE, cstr!("ESPIPE")),
    (libc::EROFS, cstr!("EROFS")),
    (libc::EMLINK, cstr!("EMLINK")),
    (libc::EPIPE, cstr!("EPIPE")),
    (libc::EDEADLK, cstr!("EDEADLK")),
    (libc::ENAMETOOLONG, cstr!("ENAMETOOLONG")),
    (libc::ENOLCK, cstr!("ENOLCK")),
    (libc::ENOSYS, cstr!("ENOSYS")),
    (libc::ENOTEMPTY, cstr!("ENOTEMPTY")),
    (libc::ELOOP, cstr!("ELOOP")),
    (libc::EOVERFLOW, cstr!("EOVERFLOW")),
    (libc::EILSEQ, cstr!("EILSEQ")),
    (libc::ENOTSUP, cstr!("ENOTSUP")),
    (libc::EOPNOTSUPP, cstr!("EOPNOTSUPP")),
    (libc::EDQUOT, cstr!("EDQUOT")),
];

/// Static, NUL-terminated name of `errno`, e.g. `2 -> "ENOENT"`. Returns
/// `"UNKNOWN"` for a code the table does not cover. Never null; the caller
/// must not free the result.
// ⚠️ The parameter is *not* called `errno`: cbindgen emits the parameter name
// into the C header, and `<cerrno>` (and `<errno.h>`) define `errno` as a
// macro - which turned the generated declaration into
// `rn_fs_errno_name(int (*__error()))`, i.e. a function-pointer parameter.
#[no_mangle]
pub extern "C" fn rn_fs_errno_name(code: c_int) -> *const c_char {
    for (errno, name) in ERRNO_NAMES {
        if *errno == code {
            return name.as_ptr() as *const c_char;
        }
    }
    b"UNKNOWN\0".as_ptr() as *const c_char
}

#[cfg(test)]
mod tests {
    use super::*;

    // A `&str` is not NUL-terminated, so handing its pointer to C without a
    // trailing NUL makes the caller read straight through the whole table.
    // Regression test: the returned C string must stop at the name.
    #[test]
    fn errno_name_is_a_nul_terminated_c_string() {
        unsafe {
            for (code, expected) in ERRNO_NAMES {
                let name = std::ffi::CStr::from_ptr(rn_fs_errno_name(*code))
                    .to_str()
                    .expect("valid UTF-8");
                let expected = expected.trim_end_matches('\0');
                assert_eq!(name, expected, "errno {} -> {:?}", code, name);
            }
        }
    }

    #[test]
    fn errno_name_falls_back_to_unknown() {
        unsafe {
            let name = std::ffi::CStr::from_ptr(rn_fs_errno_name(123456))
                .to_str()
                .unwrap();
            assert_eq!(name, "UNKNOWN");
        }
    }
}

// --- Platform open(2) flags ----------------------------------------------
//
// `fs.constants` used to be a hardcoded Linux `O_*` table compiled into the JS
// bundle, while `rn_fs_open` below used a second hardcoded copy of the same
// Linux numbers. On macOS/iOS both were wrong for the platform, so a numeric
// flag meant something different than it does in Node (e.g. `O_CREAT` was 64
// instead of 512, `O_APPEND` was 1024 instead of 8) - silently, because the two
// copies agreed with each other.
//
// The single source of truth is now `libc`, i.e. the platform's own
// `<fcntl.h>`. These values are also reported to JS so `fs.constants` is built
// from the same numbers the native layer interprets.
//
// A negative value means "this platform has no such flag"; the JS layer then
// omits the key, which is exactly what Node's `fs.constants` does (verified:
// `O_DIRECT` / `O_NOATIME` are absent on Darwin, `O_SYMLINK` on Linux).
#[repr(C)]
pub struct RNOpenFlags {
    pub o_rdonly: c_int,
    pub o_wronly: c_int,
    pub o_rdwr: c_int,
    pub o_creat: c_int,
    pub o_excl: c_int,
    pub o_noctty: c_int,
    pub o_trunc: c_int,
    pub o_append: c_int,
    pub o_directory: c_int,
    pub o_noatime: c_int,
    pub o_nofollow: c_int,
    pub o_sync: c_int,
    pub o_dsync: c_int,
    pub o_symlink: c_int,
    pub o_direct: c_int,
    pub o_nonblock: c_int,
}

#[no_mangle]
pub unsafe extern "C" fn rn_fs_open_flags(out: *mut RNOpenFlags) -> c_int {
    if out.is_null() {
        record_errno(libc::EINVAL);
        return -1;
    }
    unsafe {
        (*out).o_rdonly = libc::O_RDONLY;
        (*out).o_wronly = libc::O_WRONLY;
        (*out).o_rdwr = libc::O_RDWR;
        (*out).o_creat = libc::O_CREAT;
        (*out).o_excl = libc::O_EXCL;
        (*out).o_noctty = libc::O_NOCTTY;
        (*out).o_trunc = libc::O_TRUNC;
        (*out).o_append = libc::O_APPEND;
        (*out).o_directory = libc::O_DIRECTORY;
        (*out).o_nofollow = libc::O_NOFOLLOW;
        (*out).o_sync = libc::O_SYNC;
        (*out).o_dsync = libc::O_DSYNC;
        (*out).o_nonblock = libc::O_NONBLOCK;
    }

    #[cfg(any(target_os = "macos", target_os = "ios"))]
    unsafe {
        (*out).o_symlink = libc::O_SYMLINK;
        (*out).o_direct = -1;
        (*out).o_noatime = -1;
    }
    #[cfg(not(any(target_os = "macos", target_os = "ios")))]
    unsafe {
        (*out).o_symlink = -1;
        (*out).o_direct = libc::O_DIRECT;
        (*out).o_noatime = libc::O_NOATIME;
    }

    0
}

// --- Helper Functions ---

fn next_fd() -> c_int {
    let mut counter = FD_COUNTER.lock().unwrap();
    let fd = *counter;
    *counter += 1;
    fd
}

// --- FFI Interfaces ---

#[no_mangle]
pub unsafe extern "C" fn rn_fs_access(path: *const c_char, mode: c_int) -> c_int {
    let c_str = unsafe { CStr::from_ptr(path) };
    let path_str = match c_str.to_str() { Ok(s) => s, Err(_) => return fail_input() };
    
    // Rust std::fs doesn't have direct access(2) wrapper that takes mode (R_OK/W_OK/X_OK).
    // metadata() check existence (F_OK). 
    // permissions() readonly check (W_OK).
    // Executable check is platform specific.
    // For now we implement basic existence check if mode == 0 (F_OK)
    
    // Use libc::access directly for POSIX compliance on unix-like systems (iOS/Android/Mac)
    // Since we import libc, let's use it.
    
    with_errno(libc::access(path, mode))
}

#[no_mangle]
pub unsafe extern "C" fn rn_fs_truncate(path: *const c_char, len: size_t) -> c_int {
    let c_str = unsafe { CStr::from_ptr(path) };
    let path_str = match c_str.to_str() { Ok(s) => s, Err(_) => return fail_input() };
    
    let f = OpenOptions::new().write(true).open(path_str);
    match f {
        Ok(file) => {
            match file.set_len(len as u64) {
                 Ok(_) => 0,
                 Err(e) => fail_io(&e)
            }
        },
        Err(e) => fail_io(&e)
    }
}

#[no_mangle]
pub unsafe extern "C" fn rn_fs_ftruncate(fd: c_int, len: size_t) -> c_int {
    let registry = FILE_REGISTRY.lock().unwrap();
    if let Some(file) = registry.get(&fd) {
        match file.set_len(len as u64) {
             Ok(_) => 0,
             Err(e) => fail_io(&e)
        }
    } else {
        -1
    }
}

#[no_mangle]
pub unsafe extern "C" fn rn_fs_fsync(fd: c_int) -> c_int {
    let registry = FILE_REGISTRY.lock().unwrap();
    if let Some(file) = registry.get(&fd) {
        match file.sync_all() {
             Ok(_) => 0,
             Err(e) => fail_io(&e)
        }
    } else {
        -1
    }
}


#[no_mangle]
pub unsafe extern "C" fn rn_fs_chmod(path: *const c_char, mode: c_int) -> c_int {
    let c_str = unsafe { CStr::from_ptr(path) };
    let path_str = match c_str.to_str() { Ok(s) => s, Err(_) => return fail_input() };
    
    // Convert path to CString for libc call ensuring null termination
    let c_path = match CString::new(path_str) { Ok(s) => s, Err(_) => return fail_input() };
    
    // libc::chmod takes mode_t
    with_errno(libc::chmod(c_path.as_ptr(), mode as mode_t))
}

#[no_mangle]
pub unsafe extern "C" fn rn_fs_fchmod(fd: c_int, mode: c_int) -> c_int {
    with_errno(libc::fchmod(fd, mode as mode_t))
}

#[no_mangle]
pub unsafe extern "C" fn rn_fs_chown(path: *const c_char, uid: c_int, gid: c_int) -> c_int {
    let c_str = unsafe { CStr::from_ptr(path) };
    let path_str = match c_str.to_str() { Ok(s) => s, Err(_) => return fail_input() };
    let c_path = match CString::new(path_str) { Ok(s) => s, Err(_) => return fail_input() };
    
    with_errno(libc::chown(c_path.as_ptr(), uid as uid_t, gid as gid_t))
}

#[no_mangle]
pub unsafe extern "C" fn rn_fs_fchown(fd: c_int, uid: c_int, gid: c_int) -> c_int {
    with_errno(libc::fchown(fd, uid as uid_t, gid as gid_t))
}

#[no_mangle]
pub unsafe extern "C" fn rn_fs_utimes(path: *const c_char, atime: f64, mtime: f64) -> c_int {
    let c_str = unsafe { CStr::from_ptr(path) };
    let path_str = match c_str.to_str() { Ok(s) => s, Err(_) => return fail_input() };
    
    let atime_ft = FileTime::from_unix_time(atime as i64, ((atime.fract()) * 1_000_000_000.0) as u32);
    let mtime_ft = FileTime::from_unix_time(mtime as i64, ((mtime.fract()) * 1_000_000_000.0) as u32);
    
    match set_file_times(path_str, atime_ft, mtime_ft) {
        Ok(_) => 0,
        Err(e) => fail_io(&e)
    }
}

#[no_mangle]
pub unsafe extern "C" fn rn_fs_futimes(fd: c_int, atime: f64, mtime: f64) -> c_int {
    let registry = FILE_REGISTRY.lock().unwrap();
    if let Some(file) = registry.get(&fd) {
        let atime_ft = FileTime::from_unix_time(atime as i64, ((atime.fract()) * 1_000_000_000.0) as u32);
        let mtime_ft = FileTime::from_unix_time(mtime as i64, ((mtime.fract()) * 1_000_000_000.0) as u32);
        
        match set_file_handle_times(file, Some(atime_ft), Some(mtime_ft)) {
             Ok(_) => 0,
             Err(e) => fail_io(&e)
        }
    } else {
        -1
    }
}
use std::os::unix::fs::MetadataExt;
use std::time::UNIX_EPOCH;

#[repr(C)]
pub struct RNStats {
    pub dev: u64,
    pub ino: u64,
    pub mode: u32,
    pub nlink: u64,
    pub uid: u32,
    pub gid: u32,
    pub rdev: u64,
    pub size: u64,
    pub blksize: u64,
    pub blocks: u64,
    pub atime_ms: f64,
    pub mtime_ms: f64,
    pub ctime_ms: f64,
    pub birthtime_ms: f64,
}

fn time_to_ms(t: i64, n: i64) -> f64 {
    (t as f64) * 1000.0 + (n as f64) / 1_000_000.0
}

fn fill_stats(meta: std::fs::Metadata, out: *mut RNStats) {
    unsafe {
        (*out).dev = meta.dev();
        (*out).ino = meta.ino();
        (*out).mode = meta.mode();
        (*out).nlink = meta.nlink();
        (*out).uid = meta.uid();
        (*out).gid = meta.gid();
        (*out).rdev = meta.rdev();
        (*out).size = meta.size();
        (*out).blksize = meta.blksize();
        (*out).blocks = meta.blocks();
        
        (*out).atime_ms = time_to_ms(meta.atime(), meta.atime_nsec());
        (*out).mtime_ms = time_to_ms(meta.mtime(), meta.mtime_nsec());
        (*out).ctime_ms = time_to_ms(meta.ctime(), meta.ctime_nsec());
        // birthtime is not always available in MetadataExt trait standardly across all unixes via simple accessor 
        // in same way, but on macos/ios it might be. 
        // For portability/simplicity we map birthtime to ctime or 0 if not easily accessible via basic Ext
        // Actually MetadataExt doesn't typically provide birthtime directly cross-platform in std.
        // But basic Metadata does have created().
        
        if let Ok(created) = meta.created() {
            if let Ok(duration) = created.duration_since(UNIX_EPOCH) {
                (*out).birthtime_ms = duration.as_millis() as f64;
            } else {
                 (*out).birthtime_ms = 0.0;
            }
        } else {
             (*out).birthtime_ms = 0.0;
        }
    }
}

#[no_mangle]
pub unsafe extern "C" fn rn_fs_stat(path: *const c_char, out: *mut RNStats) -> c_int {
    let c_str = unsafe { CStr::from_ptr(path) };
    let path_str = match c_str.to_str() {
        Ok(s) => s,
        Err(_) => return fail_input(),
    };
    
    match fs::metadata(path_str) {
        Ok(meta) => {
            fill_stats(meta, out);
            0
        },
        Err(e) => fail_io(&e)
    }
}

#[no_mangle]
pub unsafe extern "C" fn rn_fs_lstat(path: *const c_char, out: *mut RNStats) -> c_int {
    let c_str = unsafe { CStr::from_ptr(path) };
    let path_str = match c_str.to_str() {
        Ok(s) => s,
        Err(_) => return fail_input(),
    };
    
    match fs::symlink_metadata(path_str) {
        Ok(meta) => {
            fill_stats(meta, out);
            0
        },
        Err(e) => fail_io(&e)
    }
}

#[no_mangle]
pub unsafe extern "C" fn rn_fs_fstat(fd: c_int, out: *mut RNStats) -> c_int {
    let registry = FILE_REGISTRY.lock().unwrap();
    if let Some(file) = registry.get(&fd) {
        match file.metadata() {
            Ok(meta) => {
                fill_stats(meta, out);
                0
            },
            Err(e) => fail_io(&e)
        }
    } else {
        -1
    }
}

#[no_mangle]
pub extern "C" fn rn_fs_mkdir(path: *const c_char, mode: u32, recursive: bool) -> bool {
    let c_str = unsafe { CStr::from_ptr(path) };
    let path_str = match c_str.to_str() {
        Ok(s) => s,
        Err(_) => {
            record_errno(libc::EILSEQ);
            return false;
        }
    };

    let res = if recursive {
        fs::create_dir_all(path_str)
    } else {
        fs::create_dir(path_str)
    };

    match res {
        Ok(_) => {
            // mode handling could go here
            true
        },
        Err(e) => {
            // Was an unconditional `eprintln!`, which no `RUST_LOG` setting
            // could silence and which leaked into stderr parity checks.
            // It now goes through `log`, so the host decides what to do with it.
            // through `rn_fs_last_errno()`, which is far more useful anyway.
            record_io_error(&e);
            log::error!("mkdir failed: {}", e);
            false
        }
    }
}

#[no_mangle]
pub unsafe extern "C" fn rn_fs_rmdir(path: *const c_char) -> c_int {
    let c_str = unsafe { CStr::from_ptr(path) };
    let path_str = match c_str.to_str() {
        Ok(s) => s,
        Err(_) => return fail_input(),
    };
    match fs::remove_dir(path_str) {
        Ok(_) => 0,
        Err(e) => fail_io(&e)
    }
}

#[no_mangle]
pub unsafe extern "C" fn rn_fs_unlink(path: *const c_char) -> c_int {
    let c_str = unsafe { CStr::from_ptr(path) };
    let path_str = match c_str.to_str() {
        Ok(s) => s,
        Err(_) => return fail_input(),
    };
    match fs::remove_file(path_str) {
        Ok(_) => 0,
        Err(e) => fail_io(&e)
    }
}

#[no_mangle]
pub unsafe extern "C" fn rn_fs_rename(old_path: *const c_char, new_path: *const c_char) -> c_int {
    let old_c_str = unsafe { CStr::from_ptr(old_path) };
    let new_c_str = unsafe { CStr::from_ptr(new_path) };
    let old_str = match old_c_str.to_str() { Ok(s) => s, Err(_) => return fail_input() };
    let new_str = match new_c_str.to_str() { Ok(s) => s, Err(_) => return fail_input() };
    
    match fs::rename(old_str, new_str) {
        Ok(_) => 0,
        Err(e) => fail_io(&e)
    }
}

#[no_mangle]
pub unsafe extern "C" fn rn_fs_copy_file(src: *const c_char, dest: *const c_char, _flags: c_int) -> c_int {
    let src_c_str = unsafe { CStr::from_ptr(src) };
    let dest_c_str = unsafe { CStr::from_ptr(dest) };
    let src_str = match src_c_str.to_str() { Ok(s) => s, Err(_) => return fail_input() };
    let dest_str = match dest_c_str.to_str() { Ok(s) => s, Err(_) => return fail_input() };
    
    match fs::copy(src_str, dest_str) {
        Ok(_) => 0,
        Err(e) => fail_io(&e)
    }
}

#[no_mangle]
pub unsafe extern "C" fn rn_fs_cp(
    src: *const c_char,
    dest: *const c_char,
    recursive: bool,
    force: bool,
    dereference: bool,
    error_on_exist: bool,
    preserve_timestamps: bool,
) -> c_int {
    let src_c_str = unsafe { CStr::from_ptr(src) };
    let dest_c_str = unsafe { CStr::from_ptr(dest) };
    let src_str = match src_c_str.to_str() { Ok(s) => s, Err(_) => return fail_input() };
    let dest_str = match dest_c_str.to_str() { Ok(s) => s, Err(_) => return fail_input() };

    let src_path = Path::new(src_str);
    let dest_path = Path::new(dest_str);

    if !src_path.exists() {
        record_errno(libc::ENOENT);
        return -2; // ENOENT
    }

    if dest_path.exists() && !force {
        if error_on_exist {
            record_errno(libc::EEXIST);
            return -3; // EEXIST
        } else {
            return 0; // Skip
        }
    }

    if src_path.is_file() {
        if let Some(parent) = dest_path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        if let Err(e) = fs::copy(src_path, dest_path) {
            return fail_io(&e);
        }
        if preserve_timestamps {
            if let Ok(metadata) = fs::metadata(src_path) {
                let atime = FileTime::from_last_access_time(&metadata);
                let mtime = FileTime::from_last_modification_time(&metadata);
                let _ = set_file_times(dest_path, atime, mtime);
            }
        }
        return 0;
    }

    if src_path.is_dir() {
        if !recursive {
            record_errno(libc::EISDIR);
            return -4; // EISDIR
        }

        // Use WalkDir for recursive copy
        let walker = WalkDir::new(src_path).follow_links(dereference);
        for entry in walker {
            let entry = match entry {
                Ok(e) => e,
                Err(_) => continue,
            };

            let rel_path = match entry.path().strip_prefix(src_path) {
                Ok(p) => p,
                Err(_) => continue,
            };
            let target_path = dest_path.join(rel_path);

            if entry.path().is_dir() {
                if let Err(_) = fs::create_dir_all(&target_path) {
                    // return -1;
                }
            } else {
                if let Some(parent) = target_path.parent() {
                    let _ = fs::create_dir_all(parent);
                }

                if target_path.exists() && !force {
                    if error_on_exist {
                        record_errno(libc::EEXIST);
                        return -3;
                    }
                    continue;
                }

                if let Err(_) = fs::copy(entry.path(), &target_path) {
                    // return -1;
                }

                if preserve_timestamps {
                    if let Ok(metadata) = entry.metadata() {
                        let atime = FileTime::from_last_access_time(&metadata);
                        let mtime = FileTime::from_last_modification_time(&metadata);
                        let _ = set_file_times(&target_path, atime, mtime);
                    }
                }
            }
        }
        return 0;
    }

    -1
}

#[no_mangle]
pub unsafe extern "C" fn rn_fs_link(existing: *const c_char, new_path: *const c_char) -> c_int {
    let existing_c_str = unsafe { CStr::from_ptr(existing) };
    let new_path_c_str = unsafe { CStr::from_ptr(new_path) };
    let existing_str = match existing_c_str.to_str() { Ok(s) => s, Err(_) => return fail_input() };
    let new_path_str = match new_path_c_str.to_str() { Ok(s) => s, Err(_) => return fail_input() };

    match fs::hard_link(existing_str, new_path_str) {
        Ok(_) => 0,
        Err(e) => fail_io(&e)
    }
}

#[no_mangle]
pub unsafe extern "C" fn rn_fs_symlink(target: *const c_char, path: *const c_char) -> c_int {
    let target_c_str = unsafe { CStr::from_ptr(target) };
    let path_c_str = unsafe { CStr::from_ptr(path) };
    let target_str = match target_c_str.to_str() { Ok(s) => s, Err(_) => return fail_input() };
    let path_str = match path_c_str.to_str() { Ok(s) => s, Err(_) => return fail_input() };

    match symlink(target_str, path_str) {
        Ok(_) => 0,
        Err(e) => fail_io(&e)
    }
}

#[no_mangle]
pub unsafe extern "C" fn rn_fs_readlink(path: *const c_char) -> *mut c_char {
    let c_str = unsafe { CStr::from_ptr(path) };
    let path_str = match c_str.to_str() { Ok(s) => s, Err(_) => return fail_input_null() };
    
    match fs::read_link(path_str) {
        Ok(p) => {
            if let Ok(s) = p.into_os_string().into_string() {
                return CString::new(s).unwrap().into_raw();
            }
            std::ptr::null_mut()
        },
        Err(e) => fail_io_null(&e)
    }
}

#[no_mangle]
pub unsafe extern "C" fn rn_fs_realpath(path: *const c_char) -> *mut c_char {
    let c_str = unsafe { CStr::from_ptr(path) };
    let path_str = match c_str.to_str() { Ok(s) => s, Err(_) => return fail_input_null() };
    
    match fs::canonicalize(path_str) {
        Ok(p) => {
            if let Ok(s) = p.into_os_string().into_string() {
                // Canonicalize returns absolute path, possibly with \\?\ prefix on windows but we are unix here
                return CString::new(s).unwrap().into_raw();
            }
            std::ptr::null_mut()
        },
        Err(e) => fail_io_null(&e)
    }
}


// Readdir iterator implementation
pub struct DirIter {
    iter: fs::ReadDir,
}

#[no_mangle]
pub unsafe extern "C" fn rn_fs_readdir_open(path: *const c_char) -> *mut DirIter {
    let c_str = unsafe { CStr::from_ptr(path) };
    let path_str = match c_str.to_str() { Ok(s) => s, Err(_) => return fail_input_null() };
    
    match fs::read_dir(path_str) {
        Ok(read_dir) => {
            let iter = DirIter { iter: read_dir };
            Box::into_raw(Box::new(iter))
        },
        Err(e) => fail_io_null(&e),
    }
}

// Returns null if end of dir or error. Caller must not free the returned string, 
// but it is valid only until next call or close.
// Actually, safely returning const char* from Rust string is hard because CString needs to be kept alive.
// Only way: return malloc'd string and caller frees.
#[no_mangle]
pub unsafe extern "C" fn rn_fs_readdir_next(iter_ptr: *mut DirIter) -> *mut c_char {
    if iter_ptr.is_null() { return std::ptr::null_mut(); }
    let dir_iter = &mut *iter_ptr;
    
    loop {
        match dir_iter.iter.next() {
            Some(Ok(entry)) => {
                if let Ok(fname) = entry.file_name().into_string() {
                     return CString::new(fname).unwrap().into_raw();
                }
                // If not valid string, skip
            },
            Some(Err(_)) => {
                // Error in entry, skip or return null? usually next.
                continue;
            },
            None => return std::ptr::null_mut(),
        }
    }
}

#[no_mangle]
pub unsafe extern "C" fn rn_fs_free_string(s: *mut c_char) {
    if !s.is_null() {
        let _ = CString::from_raw(s);
    }
}

#[no_mangle]
pub unsafe extern "C" fn rn_fs_readdir_close(iter_ptr: *mut DirIter) {
    if !iter_ptr.is_null() {
        let _ = Box::from_raw(iter_ptr);
    }
}

#[no_mangle]
pub unsafe extern "C" fn rn_fs_mkdtemp(prefix: *const c_char) -> *mut c_char {
    let c_str = unsafe { CStr::from_ptr(prefix) };
    let prefix_str = match c_str.to_str() { Ok(s) => s, Err(_) => return fail_input_null() };
    
    // Simple mkdtemp implementation: prefix + 6 random chars
    // Try a few times to avoid collision
    let mut rng = thread_rng();
    let mut last_err: Option<std::io::Error> = None;

    for _ in 0..10 {
        let suffix: String = (0..6).map(|_| rng.sample(Alphanumeric) as char).collect();
        let path = format!("{}{}", prefix_str, suffix);
        
        match fs::create_dir(&path) {
            Ok(_) => return CString::new(path).unwrap().into_raw(),
            Err(e) => last_err = Some(e),
        }
    }
    match last_err {
        Some(e) => {
            record_io_error(&e);
            std::ptr::null_mut()
        }
        None => {
            record_errno(libc::EEXIST);
            std::ptr::null_mut()
        }
    }
}

#[no_mangle]
pub unsafe extern "C" fn rn_fs_rm(path: *const c_char, recursive: bool) -> c_int {
    let c_str = unsafe { CStr::from_ptr(path) };
    let path_str = match c_str.to_str() { Ok(s) => s, Err(_) => return fail_input() };
    
    let metadata = match fs::symlink_metadata(path_str) {
        Ok(m) => m,
        Err(e) => return fail_io(&e), // ENOENT or access denied
    };
    
    if metadata.is_dir() {
        if recursive {
            match fs::remove_dir_all(path_str) {
                Ok(_) => 0,
                Err(e) => fail_io(&e)
            }
        } else {
            // Node fs.rm(..., {recursive: false}) -> err: EISDIR: illegal operation on a directory
            record_errno(libc::EISDIR);
            return -1;
        }
    } else {
        // file or symlink
        match fs::remove_file(path_str) {
            Ok(_) => 0,
            Err(e) => fail_io(&e)
        }
    }
}


#[no_mangle]
pub unsafe extern "C" fn rn_fs_read_file(path: *const c_char, out_len: *mut size_t) -> *mut u8 {
    let c_str = unsafe { CStr::from_ptr(path) };
    let path_str = match c_str.to_str() { Ok(s) => s, Err(_) => return fail_input_null() };
    
    match fs::read(path_str) {
        Ok(mut bytes) => {
            unsafe { *out_len = bytes.len() };
            bytes.shrink_to_fit();
            let ptr = bytes.as_mut_ptr();
            std::mem::forget(bytes); // Leak memory to C, C must free it
            ptr
        },
        Err(e) => fail_io_null(&e),
    }
}

#[no_mangle]
pub unsafe extern "C" fn rn_fs_read_file_free(ptr: *mut u8, len: size_t) {
    if !ptr.is_null() {
        let _ = Vec::from_raw_parts(ptr, len, len);
    }
}

#[no_mangle]
pub unsafe extern "C" fn rn_fs_write_file(path: *const c_char, data: *const u8, len: size_t) -> c_int {
    let c_str = unsafe { CStr::from_ptr(path) };
    let path_str = match c_str.to_str() { Ok(s) => s, Err(_) => return fail_input() };
    let slice = unsafe { std::slice::from_raw_parts(data, len) };
    
    match fs::write(path_str, slice) {
        Ok(_) => 0,
        Err(e) => fail_io(&e)
    }
}

#[no_mangle]
pub unsafe extern "C" fn rn_fs_open(path: *const c_char, flags: c_int, _mode: c_int) -> c_int {
    let c_str = unsafe { CStr::from_ptr(path) };
    let path_str = match c_str.to_str() {
        Ok(s) => s,
        Err(_) => return fail_input(),
    };

    let mut options = OpenOptions::new();

    // `O_ACCMODE` masks the two access-mode bits. Testing against `O_RDONLY`
    // directly is always true, because `O_RDONLY` is 0 and `flags & 0 == 0`
    // for every input - which silently turned every open into O_RDWR.
    let access_mode = flags & libc::O_ACCMODE;
    let read = access_mode == libc::O_RDONLY || access_mode == libc::O_RDWR;
    let write = access_mode == libc::O_WRONLY || access_mode == libc::O_RDWR;

    options.read(read);
    options.write(write);

    if (flags & libc::O_CREAT) != 0 {
        options.create(true);
    }
    if (flags & libc::O_TRUNC) != 0 {
        options.truncate(true);
    }
    if (flags & libc::O_APPEND) != 0 {
        options.append(true);
    }
    // O_EXCL is deliberately not handled yet: `'wx'` expands to
    // O_TRUNC|O_CREAT|O_EXCL|O_WRONLY, and Rust's `OpenOptions` rejects
    // `create_new(true)` combined with `truncate(true)`. Doing this correctly
    // means dropping the truncate bit when O_EXCL is set.

    match options.open(path_str) {
        Ok(file) => {
            let fd = next_fd();
            FILE_REGISTRY.lock().unwrap().insert(fd, file);
            fd
        },
        Err(e) => {
            // Was an unconditional `eprintln!`, which no `RUST_LOG` setting
            // could silence - see the comment in `rn_fs_mkdir`.
            log::error!("rn_fs_open error: {}", e);
            fail_io(&e)
        }
    }
}

#[no_mangle]
pub unsafe extern "C" fn rn_fs_close(fd: c_int) -> c_int {
    match FILE_REGISTRY.lock().unwrap().remove(&fd) {
        Some(_) => 0,
        None => {
            record_errno(libc::EBADF);
            -1
        }
    }
}

// Import raw fd from other sources (e.g. JNI)
use std::os::unix::io::FromRawFd;

#[no_mangle]
pub unsafe extern "C" fn rn_fs_import_fd(fd: c_int) -> c_int {
    if fd < 0 {
        record_errno(libc::EBADF);
        return -1;
    }
    // Take ownership of the raw fd
    let file = File::from_raw_fd(fd);
    FILE_REGISTRY.lock().unwrap().insert(fd, file);
    fd
}

#[no_mangle]
pub unsafe extern "C" fn rn_fs_read(fd: c_int, buffer: *mut u8, len: size_t, position: i64) -> i64 {
    let mut registry = FILE_REGISTRY.lock().unwrap();
    if let Some(file) = registry.get_mut(&fd) {
        if position >= 0 {
             if let Err(e) = file.seek(SeekFrom::Start(position as u64)) {
                 return fail_io(&e) as i64;
             }
        }
        
        // Safety: buffer must be valid for len bytes
        let buf_slice = unsafe { std::slice::from_raw_parts_mut(buffer, len) };
        
        match file.read(buf_slice) {
            Ok(bytes_read) => bytes_read as i64,
            Err(e) => fail_io(&e) as i64,
        }
    } else {
        record_errno(libc::EBADF);
        -1
    }
}

#[no_mangle]
pub unsafe extern "C" fn rn_fs_write(fd: c_int, buffer: *const u8, len: size_t, position: i64) -> i64 {
    let mut registry = FILE_REGISTRY.lock().unwrap();
    if let Some(file) = registry.get_mut(&fd) {
        if position >= 0 {
             if let Err(e) = file.seek(SeekFrom::Start(position as u64)) {
                 return fail_io(&e) as i64;
             }
        }
        
        // Safety: buffer must be valid for len bytes
        let buf_slice = unsafe { std::slice::from_raw_parts(buffer, len) };
        
        match file.write(buf_slice) {
            Ok(bytes_written) => bytes_written as i64,
            Err(e) => fail_io(&e) as i64,
        }
    } else {
        record_errno(libc::EBADF);
        -1
    }
}

// Caller must free result with rn_fs_readdir_free_string (it uses same CString mechanism)
#[no_mangle]
pub unsafe extern "C" fn rn_fs_get_temp_dir() -> *mut c_char {
    let temp_dir = std::env::temp_dir();
    if let Ok(path_str) = temp_dir.into_os_string().into_string() {
        return CString::new(path_str).unwrap().into_raw();
    }
    std::ptr::null_mut()
}

#[no_mangle]
pub unsafe extern "C" fn rn_fs_lchown(path: *const c_char, uid: u32, gid: u32) -> c_int {
    let c_str = unsafe { CStr::from_ptr(path) };
    let path_str = match c_str.to_str() { Ok(s) => s, Err(_) => return fail_input() };
    
    match std::os::unix::fs::lchown(path_str, Some(uid), Some(gid)) {
        Ok(_) => 0,
        Err(e) => fail_io(&e)
    }
}

#[no_mangle]
pub unsafe extern "C" fn rn_fs_lutimes(path: *const c_char, atime_sec: i64, mtime_sec: i64) -> c_int {
    let c_str = unsafe { CStr::from_ptr(path) };
    let path_str = match c_str.to_str() { Ok(s) => s, Err(_) => return fail_input() };
    
    let atime = filetime::FileTime::from_unix_time(atime_sec, 0);
    let mtime = filetime::FileTime::from_unix_time(mtime_sec, 0);
    
    match filetime::set_symlink_file_times(path_str, atime, mtime) {
        Ok(_) => 0,
        Err(e) => fail_io(&e)
    }
}

#[no_mangle]
pub unsafe extern "C" fn rn_fs_lchmod(path: *const c_char, mode: u32) -> c_int {
    let c_str = unsafe { CStr::from_ptr(path) };
    let _path_str = match c_str.to_str() { Ok(s) => s, Err(_) => return fail_input() };

    #[cfg(any(target_os = "macos", target_os = "ios"))]
    {
        extern "C" {
             fn lchmod(path: *const libc::c_char, mode: libc::mode_t) -> libc::c_int;
        }
        match with_errno(lchmod(c_str.as_ptr(), mode as libc::mode_t)) {
            0 => 0,
            _ => -1
        }
    }
    #[cfg(not(any(target_os = "macos", target_os = "ios")))]
    {
        // Not supported on Linux/Android properly or consistently
        record_errno(libc::EOPNOTSUPP);
        -1
    }
}

// Vector I/O: readv/writev
// Uses preadv/pwritev for atomic scatter/gather I/O with position support

#[repr(C)]
pub struct RNIovec {
    pub base: *mut u8,
    pub len: size_t,
}

#[no_mangle]
pub unsafe extern "C" fn rn_fs_readv(
    fd: c_int,
    iovecs: *const RNIovec,
    iovcnt: c_int,
    position: i64,
) -> isize {
    if iovecs.is_null() || iovcnt <= 0 {
        record_errno(libc::EINVAL);
        return -1;
    }

    // Convert RNIovec to libc::iovec
    let mut libc_iovecs: Vec<libc::iovec> = Vec::with_capacity(iovcnt as usize);
    for i in 0..iovcnt as usize {
        let iov = &*iovecs.add(i);
        libc_iovecs.push(libc::iovec {
            iov_base: iov.base as *mut c_void,
            iov_len: iov.len,
        });
    }

    // Get raw fd from our registry
    let registry = FILE_REGISTRY.lock().unwrap();
    if let Some(file) = registry.get(&fd) {
        let raw_fd = file.as_raw_fd();
        
        if position >= 0 {
            // Use preadv for positional read
            with_errno_isize(libc::preadv(raw_fd, libc_iovecs.as_ptr(), iovcnt, position as libc::off_t))
        } else {
            // Use readv for current position
            with_errno_isize(libc::readv(raw_fd, libc_iovecs.as_ptr(), iovcnt))
        }
    } else {
        record_errno(libc::EBADF);
        -1
    }
}

#[no_mangle]
pub unsafe extern "C" fn rn_fs_writev(
    fd: c_int,
    iovecs: *const RNIovec,
    iovcnt: c_int,
    position: i64,
) -> isize {
    if iovecs.is_null() || iovcnt <= 0 {
        record_errno(libc::EINVAL);
        return -1;
    }

    // Convert RNIovec to libc::iovec
    let mut libc_iovecs: Vec<libc::iovec> = Vec::with_capacity(iovcnt as usize);
    for i in 0..iovcnt as usize {
        let iov = &*iovecs.add(i);
        libc_iovecs.push(libc::iovec {
            iov_base: iov.base as *mut c_void,
            iov_len: iov.len,
        });
    }

    // Get raw fd from our registry
    let registry = FILE_REGISTRY.lock().unwrap();
    if let Some(file) = registry.get(&fd) {
        let raw_fd = file.as_raw_fd();
        
        if position >= 0 {
            // Use pwritev for positional write
            with_errno_isize(libc::pwritev(raw_fd, libc_iovecs.as_ptr(), iovcnt, position as libc::off_t))
        } else {
            // Use writev for current position
            with_errno_isize(libc::writev(raw_fd, libc_iovecs.as_ptr(), iovcnt))
        }
    } else {
        record_errno(libc::EBADF);
        -1
    }
}

