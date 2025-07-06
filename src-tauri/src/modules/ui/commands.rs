use tauri::{Manager, Emitter};
use log::{info, error};
use crate::modules::{
    core::state::set_window_visible,
    audio::{
        start_global_recording, stop_global_recording, 
        get_global_audio_receiver, get_global_sample_rate,
        is_global_recording,
        AudioProcessor
    },
    audio::devices::AudioDeviceManager,
    settings::AppConfig,
};
use std::sync::{Arc, Mutex};
use once_cell::sync::Lazy;

// Global audio processor instance
static AUDIO_PROCESSOR: Lazy<Arc<Mutex<Option<AudioProcessor>>>> = Lazy::new(|| {
    Arc::new(Mutex::new(None))
});

#[tauri::command]
pub fn show_wave_window(app: tauri::AppHandle) -> Result<(), String> {
    info!("Showing wave window");
    
    if let Some(window) = app.get_webview_window("wave-window") {
        // Unminimize and show the window
        let _ = window.unminimize();
        
        // Position wave-window relative to the monitor where the MAIN window resides (better for multi-display setups).
        let target_monitor = app.get_webview_window("main")
            .and_then(|w| w.current_monitor().ok().flatten())
            .or_else(|| window.current_monitor().ok().flatten());

        if let Some(mon) = target_monitor {
            let mon_size = mon.size();
            let mon_pos = mon.position();

            // Determine the current window size so we can truly center it.
            let (win_w, win_h) = match window.inner_size() {
                Ok(size) => (size.width as i32, size.height as i32),
                Err(_) => (120, 40), // Fallback to defaults if size query fails
            };

            // Center horizontally & move near the bottom with padding.
            let x = mon_pos.x + (mon_size.width as i32 - win_w) / 2;
            let padding_bottom = 60; // pixels above the bottom edge
            let y = mon_pos.y + mon_size.height as i32 - win_h - padding_bottom;

            let _ = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y }));
        }
        
        match window.show() {
            Ok(_) => {
                info!("Wave window shown successfully");
                set_window_visible(true);

                // Tell the frontend to reset its UI state so the bubble starts small.
                if let Err(e) = app.emit_to("wave-window", "wave-reset", ()) {
                    error!("Failed to emit wave-reset event: {}", e);
                }
            }
            Err(e) => {
                error!("Failed to show window: {}", e);
                return Err(e.to_string());
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub fn hide_wave_window(app: tauri::AppHandle) -> Result<(), String> {
    info!("Hiding wave window");
    
    if let Some(window) = app.get_webview_window("wave-window") {
        // Attempt to minimize
        if let Err(e) = window.minimize() {
            error!("Failed to minimize window: {}", e);
        }
        
        // Ensure the window is hidden
        match window.hide() {
            Ok(_) => {
                info!("Wave window hidden successfully");
                set_window_visible(false);
            }
            Err(e) => {
                error!("Failed to hide window: {}", e);
                return Err(e.to_string());
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub fn toggle_wave_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("wave-window") {
        let is_minimized = window.is_minimized().unwrap_or(false);
        let is_visible = window.is_visible().unwrap_or(false);
        if is_minimized || !is_visible {
            show_wave_window(app)?;
        } else {
            hide_wave_window(app)?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn get_audio_devices() -> Result<Vec<crate::modules::audio::devices::AudioDeviceInfo>, String> {
    let device_manager = AudioDeviceManager::new();
    match device_manager.get_input_devices() {
        Ok(devices) => {
            info!("Found {} audio devices", devices.len());
            Ok(devices)
        }
        Err(e) => {
            error!("Failed to get audio devices: {}", e);
            Err(e.to_string())
        }
    }
}

#[tauri::command]
pub fn set_audio_device(device_name: String) -> Result<(), String> {
    info!("Setting audio device to: {}", device_name);
    
    let device_manager = AudioDeviceManager::new();
    let device = match device_manager.get_device_by_name(&device_name) {
        Ok(Some(device)) => device,
        Ok(None) => {
            error!("Device not found: {}", device_name);
            return Err(format!("Device not found: {}", device_name));
        }
        Err(e) => {
            error!("Failed to get device: {}", e);
            return Err(e.to_string());
        }
    };
    
    // Reinitialize audio recorder with new device
    if let Err(e) = crate::modules::audio::init_audio_recorder(Some(device)) {
        error!("Failed to reinitialize audio recorder: {}", e);
        return Err(e.to_string());
    }
    
    info!("Audio device set successfully");
    Ok(())
}

fn start_speech_to_text_session(app_handle: tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    info!("Starting speech-to-text session");
    
    // Start audio recording
    start_global_recording()?;
    
    // Get audio receiver and sample rate
    let receiver = get_global_audio_receiver()
        .ok_or("Failed to get audio receiver")?;
    let sample_rate = get_global_sample_rate();
    
    // Drain any stale audio that might remain from a previous session so that
    // we never leak the last words of the *previous* hot-key press into the
    // next.
    while receiver.try_recv().is_ok() {}
    
    // Start audio processor
    let mut processor_guard = AUDIO_PROCESSOR.lock().unwrap();
    if processor_guard.is_none() {
        *processor_guard = Some(AudioProcessor::new());
    }
    
    if let Some(processor) = processor_guard.as_mut() {
        processor.start_processing(app_handle, receiver, sample_rate);
    }
    
    info!("Speech-to-text session started successfully");
    Ok(())
}

fn stop_speech_to_text_session() {
    info!("Stopping speech-to-text session");
    
    stop_global_recording();
    
    let mut processor_guard = AUDIO_PROCESSOR.lock().unwrap();
    if let Some(processor) = processor_guard.as_mut() {
        processor.stop_processing();
    }
    
    info!("Speech-to-text session stopped");
}

#[tauri::command]
pub fn set_groq_api_key(api_key: String) -> Result<(), String> {
    let mut cfg = AppConfig::load();
    cfg.groq_api_key = Some(api_key);
    cfg.save().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_current_groq_api_key() -> Result<Option<String>, String> {
    let cfg = AppConfig::load();
    Ok(cfg.groq_api_key)
}

#[tauri::command]
pub fn start_recording(app: tauri::AppHandle) -> Result<(), String> {
    info!("Starting recording command called");
    
    // Check if already recording
    if is_global_recording() {
        info!("Already recording, skipping start");
        return Ok(());
    }
    
    // Start audio recording and speech-to-text processing
    if let Err(e) = start_speech_to_text_session(app.clone()) {
        error!("Failed to start speech-to-text session: {}", e);
        return Err(e.to_string());
    }
    
    // Emit event to frontend about recording state
    if let Err(e) = app.emit("recording-started", ()) {
        error!("Failed to emit recording-started event: {}", e);
    } else {
        info!("Emitted recording-started event");
    }
    
    info!("Recording started successfully");
    Ok(())
}

#[tauri::command]
pub fn stop_recording(app: tauri::AppHandle) -> Result<(), String> {
    info!("Stopping recording command called");
    
    // Check if not recording
    if !is_global_recording() {
        info!("Not currently recording, skipping stop");
        return Ok(());
    }
    
    // Stop audio recording and processing
    stop_speech_to_text_session();
    
    // Emit event to frontend about recording state
    if let Err(e) = app.emit("recording-stopped", ()) {
        error!("Failed to emit recording-stopped event: {}", e);
    } else {
        info!("Emitted recording-stopped event");
    }
    
    info!("Recording stopped successfully");
    Ok(())
}

#[tauri::command]
pub fn toggle_recording(app: tauri::AppHandle) -> Result<(), String> {
    if is_global_recording() {
        stop_recording(app)
    } else {
        start_recording(app)
    }
}

#[tauri::command]
pub fn toggle_wave_window_and_recording(app: tauri::AppHandle) -> Result<(), String> {
    info!("Toggling wave window and recording");
    
    if let Some(window) = app.get_webview_window("wave-window") {
        let is_visible = window.is_visible().unwrap_or(false);
        let is_recording = is_global_recording();
        
        info!("Current state: visible={}, recording={}", is_visible, is_recording);
        
        if is_visible && is_recording {
            // Currently visible and recording - stop recording and hide window
            info!("Stopping recording and hiding window");
            stop_recording(app.clone())?;
            hide_wave_window(app)?;
        } else if is_visible && !is_recording {
            // Currently visible but not recording - start recording
            info!("Starting recording (window already visible)");
            start_recording(app)?;
        } else {
            // Currently hidden - show window and start recording
            info!("Showing window and starting recording");
            show_wave_window(app.clone())?;
            start_recording(app)?;
        }
    }
    
    Ok(())
}

#[tauri::command]
pub fn show_wave_window_and_start_recording(app: tauri::AppHandle) -> Result<(), String> {
    info!("Showing wave window and starting recording");
    
    // First show the window in small mode
    show_wave_window(app.clone())?;
    
    // Then start recording
    start_recording(app)?;
    
    Ok(())
}

#[tauri::command]
pub fn stop_recording_and_process(app: tauri::AppHandle) -> Result<(), String> {
    info!("Stopping recording and starting processing");
    
    // Stop recording (this will trigger processing)
    stop_recording(app.clone())?;
    
    // Emit event to expand window for processing
    if let Err(e) = app.emit("expand-for-processing", ()) {
        error!("Failed to emit expand-for-processing event: {}", e);
    }
    
    Ok(())
} 