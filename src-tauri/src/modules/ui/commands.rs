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
    settings::AppConfig,
    audio::processor::request_cancel_processing,
};
use std::sync::{Arc, Mutex};
use once_cell::sync::Lazy;
use crate::constants::{WAVE_WIDTH_COMPACT, WAVE_WIDTH_EXPANDED, WAVE_HEIGHT};

// Global audio processor instance
static AUDIO_PROCESSOR: Lazy<Arc<Mutex<Option<AudioProcessor>>>> = Lazy::new(|| {
    Arc::new(Mutex::new(None))
});

// Helper: create a new wave window with default settings
fn create_wave_window(app: &tauri::AppHandle) -> Result<(), String> {
    match WebviewWindowBuilder::new(
        app,
        "wave-window",
        WebviewUrl::App("src/wave-window.html".into()),
    )
    .title("VWisper Wave")
    .inner_size(WAVE_WIDTH_COMPACT as f64, WAVE_HEIGHT as f64)
    .min_inner_size(WAVE_WIDTH_COMPACT as f64, WAVE_HEIGHT as f64)
    .max_inner_size(WAVE_WIDTH_EXPANDED as f64, WAVE_HEIGHT as f64)
    .resizable(true)
    .decorations(false)
    .transparent(true)
    .shadow(false)
    .always_on_top(true)
    .skip_taskbar(false)
    .visible(false)
    .theme(Some(tauri::Theme::Dark))
    .build() {
        Ok(_) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn show_wave_window(app: tauri::AppHandle) -> Result<(), String> {
    info!("Showing wave window");

    // If window doesn't exist, create it.
    if app.get_webview_window("wave-window").is_none() {
        info!("No existing wave window, creating a new one.");
        create_wave_window(&app)?;
    }

    if let Some(window) = app.get_webview_window("wave-window") {
        // Position wave-window relative to the primary monitor, falling back to current.
        let target_monitor = window.primary_monitor().ok().flatten()
            .or_else(|| window.current_monitor().ok().flatten());

        if let Some(mon) = target_monitor {
            let mon_size = mon.size();
            let mon_pos = mon.position();
            let win_w = WAVE_WIDTH_COMPACT;
            let win_h = WAVE_HEIGHT;

            // Center horizontally & move near the bottom with padding.
            let x = mon_pos.x + (mon_size.width as i32 - win_w) / 2;
            let padding_bottom = 60; // pixels above the bottom edge
            let y = mon_pos.y + (mon_size.height as i32) - win_h - padding_bottom;

            if let Err(e) = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y })) {
                error!("Failed to set window position: {}", e);
            }
        }

        // Ensure window starts at compact size before showing
        if let Err(e) = window.set_size(tauri::Size::Physical(tauri::PhysicalSize { width: WAVE_WIDTH_COMPACT as u32, height: WAVE_HEIGHT as u32 })) {
             error!("Failed to set window size: {}", e);
        }

        match window.show() {
            Ok(_) => {
                info!("Wave window shown successfully");
                let _ = window.unminimize();
                set_window_visible(true);

                // Workaround for compositor bug: jiggle the window size to force a redraw
                let initial_size = tauri::Size::Physical(tauri::PhysicalSize { width: WAVE_WIDTH_COMPACT as u32, height: WAVE_HEIGHT as u32 });
                let jiggle_size = tauri::Size::Physical(tauri::PhysicalSize { width: WAVE_WIDTH_COMPACT as u32 + 1, height: WAVE_HEIGHT as u32 });
                let _ = window.set_size(jiggle_size);
                let _ = window.set_size(initial_size);

                if let Err(e) = window.emit("wave-reset", ()) {
                    error!("Failed to emit wave-reset event: {}", e);
                }
            }
            Err(e) => {
                error!("Failed to show window: {}", e);
                return Err(e.to_string());
            }
        }
    } else {
        error!("Wave window not found after creation attempt");
        return Err("Wave window not found after creation attempt".to_string());
    }
    Ok(())
}

#[tauri::command]
pub fn hide_wave_window(app: tauri::AppHandle) -> Result<(), String> {
    info!("Hiding wave window");
    if let Some(window) = app.get_webview_window("wave-window") {
        info!("Hiding wave window.");
        if let Err(e) = window.hide() {
            error!("Failed to hide wave window: {}", e);
        }
    }
    set_window_visible(false);
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
    
    let info = format!(
        "Total windows: {}, Wave windows: {}",
        windows.len(),
        wave_windows.len()
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
    info!("Reset wave window counter");
    Ok("Wave window counter reset".to_string())
}

pub fn reset_wave_window_counter_internal() {
    info!("Reset wave window counter");
}

#[tauri::command]
pub fn start_recording(app: tauri::AppHandle) -> Result<(), String> {
    info!("Starting recording command called");
    
    // Check if already recording
    if is_global_recording() {
        info!("Already recording, skipping start");
        return Ok(());
    }
    
    // Play start sound
    crate::modules::audio::sound::play_start_sound();
    
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
        if let Err(e) = window.set_size(tauri::Size::Physical(tauri::PhysicalSize { width: WAVE_WIDTH_EXPANDED as u32, height: WAVE_HEIGHT as u32 })) {
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
        let _ = window.set_size(tauri::Size::Physical(tauri::PhysicalSize { width: WAVE_WIDTH_COMPACT as u32, height: WAVE_HEIGHT as u32 }));
        let _ = window.hide();
    }

    // Reset the internal window counter so the next invocation works as expected
    reset_wave_window_counter_internal();

    Ok(())
}

// =====================================================================
// Settings & Utility Commands
// =====================================================================

/// Return the persisted application settings.
#[tauri::command]
pub fn load_settings() -> Result<crate::modules::settings::AppConfig, String> {
    Ok(crate::modules::settings::AppConfig::load())
}

#[derive(serde::Deserialize)]
pub struct SettingsPayload {
    pub groq_api_key: Option<String>,
    pub shortcut_enabled: bool,
    pub auto_start: bool,
}

/// Persist updated application settings to disk.
#[tauri::command]
pub fn save_settings(settings: SettingsPayload) -> Result<(), String> {
    let mut cfg = crate::modules::settings::AppConfig::load();
    cfg.groq_api_key = settings.groq_api_key;
    cfg.shortcut_enabled = settings.shortcut_enabled;
    cfg.auto_start = settings.auto_start;
    cfg.save().map_err(|e| e.to_string())
}

/// Quick validity check for a Groq API key by requesting the /models endpoint.
#[tauri::command]
pub fn test_groq_api_key(api_key: String) -> Result<bool, String> {
    use reqwest::blocking::Client;
    let client = Client::new();
    match client
        .get("https://api.groq.com/openai/v1/models")
        .bearer_auth(api_key)
        .send()
    {
        Ok(resp) => Ok(resp.status().is_success()),
        Err(e) => Err(e.to_string()),
    }
} 