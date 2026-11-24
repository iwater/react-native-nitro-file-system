use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher};
use std::ffi::{CStr, CString};
use std::os::raw::{c_char, c_void};
use std::sync::mpsc::channel;
use std::thread;

pub struct WatcherHandle {
    // We keep the sender to keep the channel alive if needed, or other control structures
    stop_tx: Option<std::sync::mpsc::Sender<()>>,
}

type WatchCallback = extern "C" fn(*mut c_void, *const c_char, i32);

// Events: 1=Rename, 2=Change
// Simplified for now.

#[no_mangle]
pub extern "C" fn rn_fs_watch(
    path: *const c_char,
    context: *mut c_void,
    callback: WatchCallback,
) -> *mut WatcherHandle {
    let c_str = unsafe { CStr::from_ptr(path) };
    let path_str = match c_str.to_str() {
        Ok(s) => s.to_string(),
        Err(_) => return std::ptr::null_mut(),
    };

    let (stop_tx, stop_rx) = channel::<()>();
    
    // We spawn a thread to handle watching because notify methods are blocking or async. 
    // Using RecommendedWatcher with a channel receiver is a common pattern.
    
    // Note: This is a simplified implementation. Proper implementing might need 
    // a more robust way to handle the callback across threads if the C++ side expects calls on specific threads.
    // However, usually C++ callbacks are thread-agnostic or handle their own dispatch.
    
    // We need to move context and callback into the thread.
    // WARNING: 'context' must be thread-safe pointer.
    
    // To properly support "stopping", we need to keep the watcher alive in a struct.
    let handle = Box::into_raw(Box::new(WatcherHandle { stop_tx: Some(stop_tx) }));
    
    let context_val = context as usize;
    
    thread::spawn(move || {
        let context = context_val as *mut c_void;
        let (tx, rx) = channel();
        
        // MacOS kqueue might need polling or FSEvents. 
        // RecommendedWatcher picks the best.
        
        let mut watcher = match RecommendedWatcher::new(tx, Config::default()) {
            Ok(w) => w,
            Err(_) => return,
        };
        
        if let Err(_) = watcher.watch(std::path::Path::new(&path_str), RecursiveMode::NonRecursive) {
            return;
        }

        // Loop until stop signal
        loop {
            // Check for stop signal first (non-blocking)
            if let Ok(_) = stop_rx.try_recv() {
                break;
            }

            // Receive event
            match rx.recv_timeout(std::time::Duration::from_millis(100)) {
                Ok(Ok(event)) => {
                    // Map event types
                    // notify::EventKind::Modify => 2 (Change)
                    // notify::EventKind::Create | Remove | Rename => 1 (Rename)
                    
                    use notify::EventKind;
                    let event_code = match event.kind {
                        EventKind::Modify(_) => 2,
                        _ => 1,
                    };

                    for path in event.paths {
                         let path_string = path.file_name().and_then(|n| n.to_str()).unwrap_or("").to_string();
                         let c_path = CString::new(path_string).unwrap();
                         (callback)(context, c_path.as_ptr(), event_code);
                    }
                },
                Ok(Err(_)) => {}, // Watch error
                Err(_) => {}, // Timeout
            }
        }
    });

    handle
}

#[no_mangle]
pub unsafe extern "C" fn rn_fs_unwatch(handle: *mut WatcherHandle) {
    if !handle.is_null() {
        let mut watcher = Box::from_raw(handle);
        if let Some(tx) = watcher.stop_tx.take() {
            let _ = tx.send(());
        }
        // watcher dropped here
    }
}
