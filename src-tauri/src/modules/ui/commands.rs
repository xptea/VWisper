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
use crate::modules::storage::{UsageStats, AnalyticsData, RecordingSession};
use uuid::Uuid;
use chrono::Utc;

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

#[cfg(target_os = "macos")]
fn detect_macos_taskbar() -> Option<i32> {
    use std::process::Command;
    
    // Try to detect if Dock is visible and get its height
    // This is a heuristic approach since macOS doesn't provide direct API access
    match Command::new("defaults").args(["read", "com.apple.dock", "autohide"]).output() {
        Ok(output) => {
            let autohide = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if autohide == "1" {
                // Dock is auto-hidden, so minimal padding needed
                Some(20)
            } else {
                // Dock is visible, use larger padding
                // Try to get Dock position (bottom is most common)
                match Command::new("defaults").args(["read", "com.apple.dock", "orientation"]).output() {
                    Ok(pos_output) => {
                        let orientation = String::from_utf8_lossy(&pos_output.stdout).trim().to_string();
                        if orientation == "bottom" {
                            // Dock at bottom, use significant padding
                            Some(80)
                        } else {
                            // Dock at left/right, use minimal padding
                            Some(20)
                        }
                    }
                    Err(_) => {
                        // Fallback: assume dock is at bottom and visible
                        Some(80)
                    }
                }
            }
        }
        Err(_) => {
            // Fallback: assume dock is visible at bottom
            Some(80)
        }
    }
}

#[cfg(not(target_os = "macos"))]
fn detect_macos_taskbar() -> Option<i32> {
    None
}

fn calculate_optimal_position(mon_size: tauri::PhysicalSize<u32>, mon_pos: tauri::PhysicalPosition<i32>, win_w: i32, win_h: i32) -> (i32, i32) {
    // Center horizontally
    let x = mon_pos.x + (mon_size.width as i32 - win_w) / 2;
    
    // Calculate vertical position with dynamic padding
    let base_padding = 60; // Default padding
    
    #[cfg(target_os = "macos")]
    let dynamic_padding = detect_macos_taskbar().unwrap_or(base_padding);
    
    #[cfg(not(target_os = "macos"))]
    let dynamic_padding = base_padding;
    
    // Use percentage-based positioning for better adaptability
    let screen_height = mon_size.height as i32;
    let percentage_from_bottom = 0.08; // 8% from bottom of screen
    let pixel_padding = (screen_height as f32 * percentage_from_bottom) as i32;
    
    // Use the larger of dynamic padding or percentage-based padding
    let final_padding = std::cmp::max(dynamic_padding, pixel_padding);
    
    let y = mon_pos.y + screen_height - win_h - final_padding;
    
    info!("Positioning wave window: x={}, y={}, padding={}, screen_height={}", x, y, final_padding, screen_height);
    
    (x, y)
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

            // Use dynamic positioning
            let (x, y) = calculate_optimal_position(mon_size.clone(), mon_pos.clone(), win_w, win_h);

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
    // next. Limit drain to prevent delays.
    let mut drain_count = 0;
    while receiver.try_recv().is_ok() && drain_count < 100 {
        drain_count += 1;
    }
    
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
    
    // Start audio recording and speech-to-text processing immediately
    if let Err(e) = start_speech_to_text_session(app.clone()) {
        error!("Failed to start speech-to-text session: {}", e);
        return Err(e.to_string());
    }
    
    // Emit event for frontend to play start sound
    if let Err(e) = app.emit("play-sound", "start") {
        error!("Failed to emit play-sound event for start: {}", e);
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
    
    // Start recording immediately for minimal delay
    start_recording(app.clone())?;
    
    // Show the window concurrently (don't wait for it)
    let app_clone = app.clone();
    std::thread::spawn(move || {
        if let Err(e) = show_wave_window(app_clone) {
            error!("Failed to show wave window: {}", e);
        }
    });
    
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

#[tauri::command]
pub fn open_settings_window(app: tauri::AppHandle) -> Result<(), String> {
    info!("Opening settings window");
    
    // Check if settings window already exists
    if let Some(window) = app.get_webview_window("settings") {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
    } else {
        // Create new settings window if it doesn't exist
        match WebviewWindowBuilder::new(
            &app,
            "settings",
            WebviewUrl::App("src/settings.html".into()),
        )
        .title("VWisper Settings")
        .inner_size(500.0, 700.0)
        .resizable(true)
        .center()
        .build() {
            Ok(_) => info!("Settings window created successfully"),
            Err(e) => return Err(e.to_string()),
        }
    }
    
    Ok(())
}

#[tauri::command]
pub fn quit_app(app: tauri::AppHandle) -> Result<(), String> {
    info!("Quitting application");
    app.exit(0);
    Ok(())
}

#[tauri::command]
pub fn show_dashboard_window(app: tauri::AppHandle) -> Result<(), String> {
    info!("=== Starting show_dashboard_window ===");
    
    // First, try to close any existing dashboard window to avoid conflicts
    if let Some(existing_window) = app.get_webview_window("dashboard") {
        info!("Found existing dashboard window, closing it first");
        let _ = existing_window.close();
        // Give it a moment to close
        std::thread::sleep(std::time::Duration::from_millis(100));
    } else {
        info!("No existing dashboard window found");
    }
    
    // Always create a new dashboard window
    info!("Creating new dashboard window with URL: src/dashboard.html");
    let window_result = WebviewWindowBuilder::new(
        &app,
        "dashboard",
        WebviewUrl::App("src/dashboard.html".into()),
    )
    .title("VWisper Dashboard")
    .inner_size(1235.0, 850.0)
    .min_inner_size(1235.0, 800.0)
    .max_inner_size(1400.0, 1300.0)
    .resizable(true)
    .center()
    .visible(true)
    .focused(true)
    .decorations(true)
    .always_on_top(false)
    .skip_taskbar(false)
    .build();

    match window_result {
        Ok(window) => {
            info!("Dashboard window created successfully with size 1235x850");
            
            // Force show and focus
            match window.show() {
                Ok(_) => info!("Window.show() successful"),
                Err(e) => error!("Window.show() failed: {}", e),
            }
            
            match window.set_focus() {
                Ok(_) => info!("Window.set_focus() successful"),
                Err(e) => error!("Window.set_focus() failed: {}", e),
            }
            
            // Verify the window size after creation
            if let Ok(size) = window.inner_size() {
                info!("Window inner size after creation: {}x{}", size.width, size.height);
            }
            
            info!("=== Dashboard window setup complete ===");
        },
        Err(e) => {
            error!("Failed to create dashboard window: {}", e);
            return Err(format!("Window creation failed: {}", e));
        }
    }
    
    Ok(())
}

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

#[tauri::command]
pub fn close_splashscreen_window(app: tauri::AppHandle) -> Result<(), String> {
    info!("=== Closing splashscreen window ===");
    
    if let Some(window) = app.get_webview_window("splashscreen") {
        info!("Found splashscreen window, closing it");
        window.close().map_err(|e| {
            error!("Failed to close splashscreen window: {}", e);
            e.to_string()
        })?;
        info!("Splashscreen window closed successfully");
    } else {
        warn!("No splashscreen window found to close");
    }
    
    // List remaining windows
    let windows: Vec<String> = app.webview_windows().keys().map(|k| k.clone()).collect();
    info!("Remaining windows after splash close: {:?}", windows);
    
    Ok(())
}

#[tauri::command]
pub fn debug_windows(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let windows: Vec<String> = app.webview_windows()
        .keys()
        .map(|k| k.clone())
        .collect();
    
    info!("Available windows: {:?}", windows);
    Ok(windows)
}

#[tauri::command]
pub fn transform_splash_to_dashboard(app: tauri::AppHandle) -> Result<(), String> {
    info!("=== Transforming splashscreen to separate dashboard window ===");

    // 1. Close splash window (if any) and show/create dashboard
    if let Some(window) = app.get_webview_window("splashscreen") {
        info!("Closing splashscreen window after dashboard is ready");
        let _ = window.close();
    }

    if let Err(e) = show_dashboard_window(app.clone()) {
        error!("Failed to create/show dashboard window: {}", e);
        return Err(e);
    }

    // 3. Persist that the splash was shown so we skip it next launch
    {
        let mut cfg = crate::modules::settings::AppConfig::load();
        if !cfg.has_seen_splash {
            cfg.has_seen_splash = true;
            let _ = cfg.save();
        }
    }

    Ok(())
}

#[tauri::command]
pub fn get_usage_stats() -> Result<UsageStats, String> {
    let stats = UsageStats::load();
    Ok(stats)
}

#[tauri::command]
pub fn get_analytics_data() -> Result<AnalyticsData, String> {
    let analytics = AnalyticsData::load();
    Ok(analytics)
}

#[tauri::command]
pub fn record_transcription_session(
    duration_ms: u64,
    audio_length_ms: u64,
    transcription_length: usize,
    processing_time_ms: u64,
    success: bool,
    error_message: Option<String>,
    transcribed_text: Option<String>
) -> Result<(), String> {
    let session = RecordingSession {
        id: Uuid::new_v4().to_string(),
        timestamp: Utc::now(),
        duration_ms,
        audio_length_ms,
        transcription_length,
        processing_time_ms,
        success,
        error_message,
        transcribed_text: transcribed_text.unwrap_or_default(),
    };

    // Update usage stats
    let mut stats = UsageStats::load();
    stats.add_recording(session.clone());

    // Update analytics
    let mut analytics = AnalyticsData::load();
    analytics.update_with_recording(audio_length_ms, transcription_length);

    Ok(())
}

#[tauri::command]
pub fn get_formatted_usage_stats() -> Result<serde_json::Value, String> {
    let stats = UsageStats::load();
    
    let formatted_stats = serde_json::json!({
        "total_recordings": stats.total_recordings,
        "total_duration_ms": stats.total_duration_ms,
        "total_duration_formatted": stats.get_total_duration_formatted(),
        "average_duration_ms": stats.get_average_duration(),
        "average_processing_time_ms": stats.get_average_processing_time(),
        "success_rate": stats.get_success_rate(),
        "successful_recordings": stats.successful_recordings,
        "failed_recordings": stats.failed_recordings,
        "total_characters_transcribed": stats.total_characters_transcribed,
        "first_use": stats.first_use,
        "last_use": stats.last_use,
    });
    
    Ok(formatted_stats)
}

#[tauri::command]
pub fn open_url(url: String) -> Result<(), String> {
    use std::process::Command;
    
    info!("Opening URL: {}", url);
    
    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(["/c", "start", &url])
            .spawn()
            .map_err(|e| format!("Failed to open URL: {}", e))?;
    }
    
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| format!("Failed to open URL: {}", e))?;
    }
    
    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| format!("Failed to open URL: {}", e))?;
    }
    
    Ok(())
}

#[tauri::command]
pub fn get_data_directory() -> Result<String, String> {
    match dirs::data_dir() {
        Some(mut data_dir) => {
            data_dir.push("vwisper");
            Ok(data_dir.to_string_lossy().to_string())
        }
        None => Err("Failed to get data directory".to_string())
    }
}

#[tauri::command]
pub fn read_version_file() -> Result<String, String> {
    use std::fs;
    use std::path::Path;
    
    // Try to read from the assets directory first (for development and if file exists)
    let assets_path = Path::new("src-tauri/src/assets/version.txt");
    if assets_path.exists() {
        match fs::read_to_string(assets_path) {
            Ok(content) => {
                let version = content.trim().to_string();
                info!("Successfully read version '{}' from assets: {}", version, assets_path.display());
                return Ok(version);
            }
            Err(e) => {
                warn!("Failed to read version from assets {}: {}", assets_path.display(), e);
            }
        }
    }
    
    // Fallback to the root version.txt (for development)
    let root_path = Path::new("version.txt");
    if root_path.exists() {
        match fs::read_to_string(root_path) {
            Ok(content) => {
                let version = content.trim().to_string();
                info!("Successfully read version '{}' from root: {}", version, root_path.display());
                return Ok(version);
            }
            Err(e) => {
                warn!("Failed to read version from root {}: {}", root_path.display(), e);
            }
        }
    }
    
    // If neither file exists, return a default version
    warn!("Could not find version.txt file, using default version");
    Ok("1.0.2".to_string())
}



#[tauri::command]
pub fn test_text_injection(test_text: String) -> Result<String, String> {
    use crate::modules::core::text_injection::inject_text;
    
    info!("Testing text injection with: '{}'", test_text);
    
    match inject_text(&test_text) {
        Ok(_) => {
            let success_msg = format!("Successfully injected text: '{}'", test_text);
            info!("{}", success_msg);
            Ok(success_msg)
        }
        Err(e) => {
            let error_msg = format!("Failed to inject text '{}': {}", test_text, e);
            error!("{}", error_msg);
            Err(error_msg)
        }
    }
}

#[tauri::command]
pub fn test_simple_text_injection() -> Result<String, String> {
    use crate::modules::core::text_injection::inject_text;
    
    let test_text = "Hello from VWisper!";
    info!("Testing simple text injection with: '{}'", test_text);
    
    match inject_text(test_text) {
        Ok(_) => {
            let success_msg = format!("✅ Text injection test successful: '{}'", test_text);
            info!("{}", success_msg);
            Ok(success_msg)
        }
        Err(e) => {
            let error_msg = format!("❌ Text injection test failed: {}", e);
            error!("{}", error_msg);
            Err(error_msg)
        }
    }
}



#[derive(serde::Serialize)]
pub struct UpdateCheckResult {
    pub local_version: String,
    pub remote_version: String,
    pub has_update: bool,
    pub success: bool,
    pub error_message: Option<String>,
}

#[tauri::command]
pub fn check_for_updates() -> Result<UpdateCheckResult, String> {
    info!("Checking for updates...");
    
    // Get local version
    let local_version = match read_version_file() {
        Ok(version) => version,
        Err(e) => {
            let error_msg = format!("Failed to read local version: {}", e);
            error!("{}", error_msg);
            return Ok(UpdateCheckResult {
                local_version: "unknown".to_string(),
                remote_version: "unknown".to_string(),
                has_update: false,
                success: false,
                error_message: Some(error_msg),
            });
        }
    };
    
    // Fetch remote version from GitHub
    let remote_version = match fetch_remote_version() {
        Ok(version) => version,
        Err(e) => {
            let error_msg = format!("Failed to fetch remote version: {}", e);
            error!("{}", error_msg);
            return Ok(UpdateCheckResult {
                local_version,
                remote_version: "unknown".to_string(),
                has_update: false,
                success: false,
                error_message: Some(error_msg),
            });
        }
    };
    
    // Compare versions
    let has_update = compare_versions(&remote_version, &local_version) > 0;
    
    info!("Update check completed - Local: {}, Remote: {}, Has update: {}", 
          local_version, remote_version, has_update);
    
    Ok(UpdateCheckResult {
        local_version,
        remote_version,
        has_update,
        success: true,
        error_message: None,
    })
}

fn fetch_remote_version() -> Result<String, String> {
    use reqwest::blocking::Client;
    use std::time::Duration;
    
    let client = Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;
    
    let url = "https://raw.githubusercontent.com/xptea/VWisper/refs/heads/main/src-tauri/src/assets/version.txt";
    
    let response = client
        .get(url)
        .send()
        .map_err(|e| format!("Failed to fetch remote version: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("HTTP error: {}", response.status()));
    }
    
    let content = response
        .text()
        .map_err(|e| format!("Failed to read response: {}", e))?;
    
    Ok(content.trim().to_string())
}

fn compare_versions(version1: &str, version2: &str) -> i32 {
    let v1_parts: Vec<u32> = version1.split('.').filter_map(|s| s.parse().ok()).collect();
    let v2_parts: Vec<u32> = version2.split('.').filter_map(|s| s.parse().ok()).collect();
    
    let max_len = v1_parts.len().max(v2_parts.len());
    
    for i in 0..max_len {
        let v1_part = v1_parts.get(i).copied().unwrap_or(0);
        let v2_part = v2_parts.get(i).copied().unwrap_or(0);
        
        if v1_part > v2_part {
            return 1;
        } else if v1_part < v2_part {
            return -1;
        }
    }
    
    0
}