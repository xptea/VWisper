use tauri::{Manager, Emitter, WebviewWindowBuilder, WebviewUrl};
use log::{info, error, warn, debug};
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
    audio::processor::request_cancel_processing,
};
use std::sync::{Arc, Mutex};
use once_cell::sync::Lazy;

// Global audio processor instance
static AUDIO_PROCESSOR: Lazy<Arc<Mutex<Option<AudioProcessor>>>> = Lazy::new(|| {
    Arc::new(Mutex::new(None))
});

// Global window counter to prevent multiple windows
static WAVE_WINDOW_COUNT: Lazy<Arc<Mutex<u32>>> = Lazy::new(|| {
    Arc::new(Mutex::new(0))
});

// Helper: create a new wave window with default settings
fn create_wave_window(app: &tauri::AppHandle) -> Result<(), String> {
    if app.get_webview_window("wave-window").is_some() {
        return Ok(()); // already exists
    }

    match WebviewWindowBuilder::new(
        app,
        "wave-window",
        WebviewUrl::App("src/wave-window.html".into()),
    )
    .title("VWisper Wave")
    .inner_size(80.0, 80.0)
    .min_inner_size(80.0, 80.0)
    .max_inner_size(200.0, 80.0)
    .resizable(false)
    .decorations(false)
    .transparent(true)
    .always_on_top(true)
    .skip_taskbar(true)
    .visible(false)
    .build() {
        Ok(_) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn show_wave_window(app: tauri::AppHandle) -> Result<(), String> {
    info!("Showing wave window");
    
    // Check window count
    let mut count_guard = WAVE_WINDOW_COUNT.lock().unwrap();
    if *count_guard > 0 {
        info!("Wave window already exists (count: {}), skipping show", *count_guard);
        return Ok(());
    }
    
    // Ensure window exists; create if missing
    if app.get_webview_window("wave-window").is_none() {
        create_wave_window(&app)?;
    }

    if let Some(window) = app.get_webview_window("wave-window") {
        // If already visible, just shrink and reset UI then return.
        if window.is_visible().unwrap_or(false) {
            info!("Wave window already visible – resetting to compact mode");

            let _ = window.set_size(tauri::Size::Physical(tauri::PhysicalSize { width: 80, height: 80 }));

            // Reset bubble UI state
            if let Err(e) = window.emit("wave-reset", ()) {
                error!("Failed to emit wave-reset event: {}", e);
            }

            return Ok(());
        }

        // Increment counter only when becoming visible for first time in this cycle
        *count_guard += 1;
        info!("Wave window count: {}", *count_guard);
        
        // Ensure window starts at compact size before show
        let _ = window.set_size(tauri::Size::Physical(tauri::PhysicalSize { width: 80, height: 80 }));
        
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
                Err(_) => (80, 80), // Fallback to new defaults if size query fails
            };

            // Center horizontally & move near the bottom with padding.
            let x = mon_pos.x + (mon_size.width as i32 - win_w) / 2;
            let padding_bottom = 60; // pixels above the bottom edge
            let y = mon_pos.y + mon_size.height as i32 - win_h - padding_bottom;

            // Only set position if window is not already visible to prevent flickering
            if !window.is_visible().unwrap_or(false) {
                let _ = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y }));
            }
        }
        
        match window.show() {
            Ok(_) => {
                info!("Wave window shown successfully");
                set_window_visible(true);

                // Tell the frontend to reset its UI state so the bubble starts small.
                if let Err(e) = window.emit("wave-reset", ()) {
                    error!("Failed to emit wave-reset event: {}", e);
                }
            }
            Err(e) => {
                // Decrement counter on error
                *count_guard -= 1;
                error!("Failed to show window: {}", e);
                return Err(e.to_string());
            }
        }
    } else {
        error!("Wave window not found");
        return Err("Wave window not found".to_string());
    }
    Ok(())
}

#[tauri::command]
pub fn hide_wave_window(app: tauri::AppHandle) -> Result<(), String> {
    info!("Hiding wave window");
    
    // Ensure window exists; create if missing
    if app.get_webview_window("wave-window").is_none() {
        create_wave_window(&app)?;
    }

    if let Some(window) = app.get_webview_window("wave-window") {
        // Close and destroy the window entirely instead of just hiding
        match window.close() {
            Ok(_) => info!("Wave window closed"),
            Err(e) => warn!("Failed to close wave window: {}", e),
        }

        set_window_visible(false);

        // Decrement counter
        let mut count_guard = WAVE_WINDOW_COUNT.lock().unwrap();
        if *count_guard > 0 {
            *count_guard -= 1;
            info!("Wave window count: {}", *count_guard);
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
pub fn debug_wave_windows(app: tauri::AppHandle) -> Result<String, String> {
    let windows = app.webview_windows();
    let wave_windows: Vec<_> = windows.values().filter(|w| w.label() == "wave-window").collect();
    
    let count_guard = WAVE_WINDOW_COUNT.lock().unwrap();
    let info = format!(
        "Total windows: {}, Wave windows: {}, Counter: {}",
        windows.len(),
        wave_windows.len(),
        *count_guard
    );
    
    info!("{}", info);
    
    for (i, window) in wave_windows.iter().enumerate() {
        let is_visible = window.is_visible().unwrap_or(false);
        let is_minimized = window.is_minimized().unwrap_or(false);
        info!("Wave window {}: visible={}, minimized={}", i, is_visible, is_minimized);
    }
    
    Ok(info)
}

#[tauri::command]
pub fn reset_wave_window_counter() -> Result<String, String> {
    let mut count_guard = WAVE_WINDOW_COUNT.lock().unwrap();
    let old_count = *count_guard;
    *count_guard = 0;
    info!("Reset wave window counter from {} to 0", old_count);
    Ok(format!("Reset counter from {} to 0", old_count))
}

pub fn reset_wave_window_counter_internal() {
    let mut count_guard = WAVE_WINDOW_COUNT.lock().unwrap();
    let old_count = *count_guard;
    *count_guard = 0;
    info!("Reset wave window counter from {} to 0", old_count);
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
    
    // Resize window to accommodate processing section
    if let Some(window) = app.get_webview_window("wave-window") {
        if let Err(e) = window.set_size(tauri::Size::Physical(tauri::PhysicalSize { width: 200, height: 80 })) {
            error!("Failed to resize window: {}", e);
        }
    }
    
    // Emit event to expand window for processing
    if let Err(e) = app.emit("expand-for-processing", ()) {
        error!("Failed to emit expand-for-processing event: {}", e);
    }
    
    Ok(())
}

#[tauri::command]
pub fn cancel_processing(app: tauri::AppHandle) -> Result<(), String> {
    info!("Cancelling current recording/processing");

    // Signal the audio processor (if any) to abort
    request_cancel_processing();

    // Stop recording if it is still active – ignore any errors
    if crate::modules::audio::is_global_recording() {
        let _ = stop_recording(app.clone());
    }

    // Hide the wave window, if present
    if let Some(window) = app.get_webview_window("wave-window") {
        let _ = window.set_size(tauri::Size::Physical(tauri::PhysicalSize { width: 80, height: 80 }));
        let _ = window.hide();
    }

    // Reset the internal window counter so the next invocation works as expected
    reset_wave_window_counter_internal();

    Ok(())
} 