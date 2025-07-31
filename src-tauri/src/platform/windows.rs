use std::thread;
use std::time::{Duration, Instant};
use device_query::{DeviceState, Keycode, DeviceQuery};
use tauri::{AppHandle, Emitter, Manager};
use crate::audio;
use crate::handle_stop_recording_workflow;

#[cfg(target_os = "windows")]
use windows::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, SetForegroundWindow};
#[cfg(target_os = "windows")]
use windows::Win32::Foundation::HWND;

pub fn start_global_key_monitor(app_handle: AppHandle) {
    thread::spawn(move || {
        let device_state = DeviceState::new();
        let mut last_control_state = false;
        let mut last_action_time = Instant::now();
        let mut active_window_handle: Option<HWND> = None;
        let mut hold_start_time: Option<Instant> = None;
        
        loop {
            let keys = device_state.get_keys();
            let control_pressed = keys.contains(&Keycode::RControl);
            let now = Instant::now();
            
            if control_pressed && !last_control_state && now.duration_since(last_action_time) > Duration::from_millis(25) {
                last_action_time = now;
                hold_start_time = Some(now); // Record when the key press started
                
                // Capture the currently active window before showing our window
                #[cfg(target_os = "windows")]
                {
                    active_window_handle = Some(unsafe { GetForegroundWindow() });
                }
                
                if let Some(window) = app_handle.get_webview_window("main") {
                    let _ = window.show();
                }
                let _ = app_handle.emit_to("main", "pill-state", "listening");
                let _ = app_handle.emit_to("main", "start-recording", "");
                let _ = audio::start_recording();
            }
            
            if !control_pressed && last_control_state && now.duration_since(last_action_time) > Duration::from_millis(25) {
                last_action_time = now;
                let _ = app_handle.emit_to("main", "pill-state", "loading");
                let _ = app_handle.emit_to("main", "stop-recording", "");
                
                // Calculate hold time
                let hold_time_ms = hold_start_time.map(|start| start.elapsed().as_millis() as u64);
                
                let app_handle_clone = app_handle.clone();
                let window_to_restore = active_window_handle;
                
                thread::spawn(move || {
                    let result = handle_stop_recording_workflow(&app_handle_clone, Some(Box::new(move || {
                        // Restore focus to the original window
                        #[cfg(target_os = "windows")]
                        if let Some(hwnd) = window_to_restore {
                            unsafe {
                                let _ = SetForegroundWindow(hwnd);
                            }
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
            last_control_state = control_pressed;
            thread::sleep(Duration::from_millis(15));
        }
    });
}
