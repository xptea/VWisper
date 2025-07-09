use std::thread;
use std::time::Duration;
use tauri::AppHandle;
use rdev::{listen, EventType, Key};

pub fn start_global_key_monitor(app_handle: AppHandle) {
    thread::spawn(move || {
        let mut last_action_time = std::time::Instant::now();
        
        log::info!("macOS Fn key monitoring started using rdev");
        log::info!("Hold Fn to record, release to process and see results");
        
        let app_handle_for_fallback = app_handle.clone();
        if let Err(error) = listen(move |event| {
            match event.event_type {
                EventType::KeyPress(key) => {
                    if key == Key::Function {
                        let now = std::time::Instant::now();
                        if now.duration_since(last_action_time) > Duration::from_millis(25) {
                            last_action_time = now;
                            // Show window and start recording
                            let _ = crate::modules::ui::commands::show_wave_window_and_start_recording(app_handle.clone());
                        }
                    }
                }
                EventType::KeyRelease(key) => {
                    if key == Key::Function {
                        let now = std::time::Instant::now();
                        if now.duration_since(last_action_time) > Duration::from_millis(25) {
                            last_action_time = now;
                            // Stop recording but keep window visible for processing
                            let _ = crate::modules::ui::commands::stop_recording_and_process(app_handle.clone());
                        }
                    }
                }
                _ => {}
            }
        }) {
            log::error!("Failed to start Fn key monitoring: {:?}", error);
            log::info!("Falling back to Control key monitoring");
            // Fallback to device_query with Control key
            fallback_to_control_key(app_handle_for_fallback);
        }
    });
}

fn fallback_to_control_key(app_handle: AppHandle) {
    use device_query::{DeviceQuery, DeviceState, Keycode};
    
    thread::spawn(move || {
        let device_state = DeviceState::new();
        let mut last_control_state = false;
        let mut last_action_time = std::time::Instant::now();
        
        log::info!("macOS fallback: Control key monitoring started");
        log::info!("Hold Control to record, release to process and see results");
        
        loop {
            let keys: Vec<Keycode> = device_state.get_keys();
            let control_pressed = keys.contains(&Keycode::LControl);
            
            if control_pressed && !last_control_state {
                let now = std::time::Instant::now();
                if now.duration_since(last_action_time) > Duration::from_millis(25) {
                    last_action_time = now;
                    let _ = crate::modules::ui::commands::show_wave_window_and_start_recording(app_handle.clone());
                }
            }
            
            if !control_pressed && last_control_state {
                let now = std::time::Instant::now();
                if now.duration_since(last_action_time) > Duration::from_millis(25) {
                    last_action_time = now;
                    let _ = crate::modules::ui::commands::stop_recording_and_process(app_handle.clone());
                }
            }
            
            last_control_state = control_pressed;
            thread::sleep(Duration::from_millis(15));
        }
    });
}

// ---------- Non-macOS fallback (kept unchanged) ---------- //
#[cfg(not(target_os = "macos"))]
pub fn start_global_key_monitor(app_handle: AppHandle) {
    thread::spawn(move || {
        let device_state = DeviceState::new();
        let mut last_control_state = false;
        let mut last_action_time = std::time::Instant::now();
        log::info!("Cross-platform key monitoring started (non-macOS)");

        loop {
            let keys: Vec<Keycode> = device_state.get_keys();
            let control_pressed = keys.contains(&Keycode::RControl) || keys.contains(&Keycode::LControl);

            if control_pressed && !last_control_state {
                let now = std::time::Instant::now();
                if now.duration_since(last_action_time) > Duration::from_millis(25) {
                    last_action_time = now;
                    let _ = crate::modules::ui::commands::show_wave_window_and_start_recording(app_handle.clone());
                }
            }

            if !control_pressed && last_control_state {
                let now = std::time::Instant::now();
                if now.duration_since(last_action_time) > Duration::from_millis(25) {
                    last_action_time = now;
                    let _ = crate::modules::ui::commands::stop_recording_and_process(app_handle.clone());
                }
            }

            last_control_state = control_pressed;
            thread::sleep(Duration::from_millis(15));
        }
    });
} 