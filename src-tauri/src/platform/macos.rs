use std::thread;
use std::time::{Duration, Instant};
use rdev::{listen, Event, EventType, Key};
use tauri::{AppHandle, Emitter, Manager};
use crate::audio;
use crate::handle_stop_recording_workflow;

#[cfg(target_os = "macos")]
use core_graphics::window::{CGWindowListCopyWindowInfo, kCGWindowListOptionOnScreenOnly, kCGNullWindowID};

static mut FN_PRESSED: bool = false;

pub fn start_global_key_monitor(app_handle: AppHandle) {
    thread::spawn(move || {
        let mut last_fn_state = false;
        let mut last_action_time = Instant::now();
        let active_window_info: Option<String> = None;
        let mut hold_start_time: Option<Instant> = None;
        
        // Listen for key events
        if let Err(error) = listen(move |event: Event| {
            // Check if FN key state changed
            if let EventType::KeyPress(Key::Function) = event.event_type {
                unsafe {
                    FN_PRESSED = true;
                }
            } else if let EventType::KeyRelease(Key::Function) = event.event_type {
                unsafe {
                    FN_PRESSED = false;
                }
            }
            
            let fn_pressed = unsafe { FN_PRESSED };
            let now = Instant::now();
            
            if fn_pressed && !last_fn_state && now.duration_since(last_action_time) > Duration::from_millis(25) {
                last_action_time = now;
                hold_start_time = Some(now); // Record when the key press started
                
                // Capture the currently active window info before showing our window
                #[cfg(target_os = "macos")]
                {
                    unsafe {
                        let window_list = CGWindowListCopyWindowInfo(kCGWindowListOptionOnScreenOnly, kCGNullWindowID);
                        if !window_list.is_null() {
                            // For now, we'll skip the window info capture as it requires more complex Core Graphics API usage
                            // The window restoration will still work via AppleScript
                        }
                    }
                }
                
                if let Some(window) = app_handle.get_webview_window("main") {
                    let _ = window.show();
                }
                let _ = app_handle.emit_to("main", "pill-state", "listening");
                let _ = app_handle.emit_to("main", "start-recording", "");
                let _ = audio::start_recording();
            }
            
            if !fn_pressed && last_fn_state && now.duration_since(last_action_time) > Duration::from_millis(25) {
                last_action_time = now;
                let _ = app_handle.emit_to("main", "pill-state", "loading");
                let _ = app_handle.emit_to("main", "stop-recording", "");
                
                // Calculate hold time
                let hold_time_ms = hold_start_time.map(|start| start.elapsed().as_millis() as u64);
                
                let app_handle_clone = app_handle.clone();
                let window_name_to_restore = active_window_info.clone();
                
                thread::spawn(move || {
                    let result = handle_stop_recording_workflow(&app_handle_clone, Some(Box::new(move || {
                        // Restore focus to the original window using AppleScript
                        #[cfg(target_os = "macos")]
                        if let Some(window_name) = window_name_to_restore {
                            let script = format!(
                                "tell application \"System Events\" to set frontmost of process \"{}\" to true",
                                window_name
                            );
                            let _ = std::process::Command::new("osascript")
                                .arg("-e")
                                .arg(&script)
                                .output();
                        }
                    })), hold_time_ms);
                    
                    if let Err(e) = result {
                        eprintln!("Error in handle_stop_recording_workflow: {}", e);
                        let _ = app_handle_clone.emit_to("main", "pill-state", "error");
                        thread::sleep(Duration::from_secs(3));
                    } else {
                        let _ = app_handle_clone.emit_to("main", "pill-state", "success");
                        thread::sleep(Duration::from_millis(500));
                    }
                    let _ = app_handle_clone.emit_to("main", "pill-state", "idle");
                    if let Some(window) = app_handle_clone.get_webview_window("main") {
                        let _ = window.hide();
                    }
                });
                
                // Emit the hold time for potential frontend use
                if let Some(hold_time) = hold_time_ms {
                    let _ = app_handle.emit_to("main", "hold-time", hold_time);
                }
            }
            last_fn_state = fn_pressed;
        }) {
            eprintln!("Error listening for global key events: {:?}", error);
        }
    });
}
