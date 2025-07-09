use std::thread;
use std::time::Duration;
use tauri::AppHandle;
use device_query::{DeviceQuery, DeviceState, Keycode};

pub fn start_global_key_monitor(app_handle: AppHandle) {
    thread::spawn(move || {
        let device_state = DeviceState::new();
        let mut last_control_state = false;
        let mut last_action_time = std::time::Instant::now();
        
        log::info!("macOS balanced key monitoring started using device_query");
        log::info!("Hold Control to record, release to process and see results");
        
        loop {
            let keys: Vec<Keycode> = device_state.get_keys();
            let control_pressed = keys.contains(&Keycode::RControl) || keys.contains(&Keycode::LControl);
            
            // Check for key press (show window and start recording)
            if control_pressed && !last_control_state {
                let now = std::time::Instant::now();
                if now.duration_since(last_action_time) > Duration::from_millis(25) { // Balanced debounce
                    last_action_time = now;
                    
                    // Show window and start recording
                    let _ = crate::modules::ui::commands::show_wave_window_and_start_recording(app_handle.clone());
                }
            }
            
            // Check for key release (stop recording but keep window for processing)
            if !control_pressed && last_control_state {
                let now = std::time::Instant::now();
                if now.duration_since(last_action_time) > Duration::from_millis(25) { // Balanced debounce
                    last_action_time = now;
                    
                    // Stop recording but keep window visible for processing
                    let _ = crate::modules::ui::commands::stop_recording_and_process(app_handle.clone());
                }
            }
            
            last_control_state = control_pressed;
            thread::sleep(Duration::from_millis(15)); // Balanced polling for reliability
        }
    });
} 