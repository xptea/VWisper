use std::thread;
use std::time::Duration;
use tauri::AppHandle;
use device_query::{DeviceQuery, DeviceState, Keycode};
use std::os::raw::{c_char, c_int};

pub fn suppress_alsa_errors() {
    // Silence noisy ALSA/JACK stderr messages that bypass the Rust logger.

    // -------------------------------- ALSA --------------------------------
    // Provide a variadic-compatible no-op handler for libasound.
    unsafe extern "C" fn alsa_silent(_: *const c_char, _: c_int, _: *const c_char, _: c_int, _: *const c_char, _: c_int) {}

    unsafe {
        let alsa_handler_ptr = std::mem::transmute::<
            unsafe extern "C" fn(
                *const c_char,
                c_int,
                *const c_char,
                c_int,
                *const c_char,
                c_int,
            ),
            alsa_sys::snd_lib_error_handler_t,
        >(alsa_silent);
        alsa_sys::snd_lib_error_set_handler(alsa_handler_ptr);
    }

    // -------------------------------- JACK --------------------------------
    // Suppress libjack info/error prints that appear when the JACK server is absent.
    // These come from `jack_error` / `jack_info` which delegate to function pointers
    // set via `jack_set_error_function` / `jack_set_info_function`.
    #[cfg(feature = "jack")]
    {
        // Define a stub with the required (const char*) signature.
        unsafe extern "C" fn jack_silent(_: *const c_char) {}

        unsafe {
            #[allow(non_snake_case)]
            {
                // The symbols are provided by libjack via the jack-sys crate.
                jack_sys::jack_set_error_function(Some(jack_silent));
                jack_sys::jack_set_info_function(Some(jack_silent));
            }
        }
    }
}

pub fn start_global_key_monitor(app_handle: AppHandle) {
    suppress_alsa_errors(); // Call before we touch ALSA through CPAL to suppress spam

    thread::spawn(move || {
        let device_state = DeviceState::new();
        let mut last_control_state = false;
        let mut last_action_time = std::time::Instant::now();
        let mut consecutive_errors = 0;
        
        log::info!("Linux key monitoring started using device_query");
        log::info!("Hold RIGHT CTRL to record, release to process and see results");
        
        loop {
            let keys: Vec<Keycode> = device_state.get_keys();
            let control_pressed = keys.contains(&Keycode::RControl); // Only RIGHT CTRL
            
            // Check for key press (show window and start recording)
            if control_pressed && !last_control_state {
                let now = std::time::Instant::now();
                if now.duration_since(last_action_time) > Duration::from_millis(200) {
                    last_action_time = now;
                    
                    // Limit consecutive errors to prevent spam
                    if consecutive_errors < 3 {
                        // Show window and start recording
                        let result = crate::modules::ui::commands::show_wave_window_and_start_recording(app_handle.clone());
                        
                        if result.is_err() {
                            consecutive_errors += 1;
                            log::warn!("Show window and start recording failed, error count: {}", consecutive_errors);
                        } else {
                            consecutive_errors = 0; // Reset error count on success
                        }
                    } else {
                        log::error!("Too many consecutive errors while showing window. Aborting.");
                        thread::sleep(Duration::from_millis(1000)); // Wait longer
                        consecutive_errors = 0; // Reset after waiting
                    }
                }
            }
            
            // Check for key release (stop recording but keep window for processing)
            if !control_pressed && last_control_state {
                let now = std::time::Instant::now();
                if now.duration_since(last_action_time) > Duration::from_millis(200) {
                    last_action_time = now;
                    
                    // Stop recording but keep window visible for processing
                    let _ = crate::modules::ui::commands::stop_recording_and_process(app_handle.clone());
                }
            }
            
            last_control_state = control_pressed;
            thread::sleep(Duration::from_millis(100)); // Increased polling interval
        }
    });
} 