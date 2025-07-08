#![allow(unexpected_cfgs)]

use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
use log::{info, error, warn};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Once;

mod modules;
mod platform;
mod constants;

// Global flag to ensure key monitoring is only started once
static KEY_MONITORING_STARTED: AtomicBool = AtomicBool::new(false);
static INIT: Once = Once::new();

use modules::{
    audio::init_audio_recorder,
    core::text_injection::init_text_injector,
    ui::{
        commands::{
            show_wave_window,
            hide_wave_window,
            toggle_wave_window,
            toggle_wave_window_and_recording,
            show_wave_window_and_start_recording,
            stop_recording_and_process,
            start_recording,
            stop_recording,
            toggle_recording,
            set_groq_api_key,
            get_current_groq_api_key,
            debug_wave_windows,
            reset_wave_window_counter,
            cancel_processing,
            load_settings,
            save_settings,
            test_groq_api_key,
            open_settings_window,
            quit_app,
            show_dashboard_window,
            close_splashscreen_window,
            debug_windows,
            transform_splash_to_dashboard,
            get_usage_stats,
            get_analytics_data,
            record_transcription_session,
            get_formatted_usage_stats,
            open_url,
            get_data_directory,
            read_version_file,
            test_text_injection,
            test_simple_text_injection,
            check_for_updates,
        },
        history_commands::{
            get_transcription_history,
            search_transcription_history,
            delete_transcription_entry,
            clear_transcription_history,
            get_history_stats,
            get_history_entries_by_date,
            reload_transcription_history,
        },
        tray::create_system_tray,
    },
    settings::AppConfig,
};

#[cfg(target_os = "linux")]
fn init_x11_threads() {
    unsafe {
        use x11::xlib::XInitThreads;
        XInitThreads();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize logging (default to `error` unless the user overrides `RUST_LOG`)
    env_logger::Builder::from_env(env_logger::Env::default().filter_or("RUST_LOG", "info"))
        .format_timestamp(None)
        // Show Groq round-trip INFO while keeping the rest of audio chatter quiet
        .filter_module("vwisper_lib::modules::audio::processor", log::LevelFilter::Info)
        .filter_module("vwisper_lib::modules::audio", log::LevelFilter::Warn)
        // Show text injection logs at INFO level for debugging
        .filter_module("vwisper_lib::modules::core::text_injection", log::LevelFilter::Info)
        // Downgrade platform key-monitor logs to WARN and above
        .filter_module("vwisper_lib::platform", log::LevelFilter::Warn)
        .init();
    info!("Starting VWisper application");

    #[cfg(target_os = "linux")]
    init_x11_threads();

    #[cfg(target_os = "linux")]
    {
        // Silence ALSA/JACK spam early.
        platform::linux::suppress_alsa_errors();
    }

    tauri::Builder::default()
        .setup(|app| {
            INIT.call_once(|| {
                info!("Setting up application");
                
                // Load configuration and decide which initial window to show
                let _config = AppConfig::load();
                
                // Always open (or create) the dashboard window on launch
                if let Some(dashboard) = app.get_webview_window("dashboard") {
                    let _ = dashboard.show();
                    let _ = dashboard.set_focus();
                } else if let Err(e) = crate::modules::ui::commands::show_dashboard_window(app.handle().clone()) {
                    error!("Failed to open dashboard window: {}", e);
                }
                
                // Initialize audio recorder
                if let Err(e) = init_audio_recorder(None) {
                    error!("Failed to initialize audio recorder: {}", e);
                }
                
                // Initialize text injector
                if let Err(e) = init_text_injector() {
                    error!("Failed to initialize text injector: {}", e);
                }
                
                // Create system tray
                if let Err(e) = create_system_tray(&app.handle()) {
                    error!("Failed to create system tray: {}", e);
                }
                
                // Create the wave window if it doesn't exist
                if app.get_webview_window("wave-window").is_none() {
                    info!("Creating wave window");
                    let _wave_window = WebviewWindowBuilder::new(
                        app,
                        "wave-window",
                        WebviewUrl::App("src/wave-window.html".into()),
                    )
                    .title("VWisper Wave")
                    .inner_size(140.0, 80.0)
                    .min_inner_size(140.0, 80.0)
                    .max_inner_size(185.0, 80.0)
                    .resizable(false)
                    .decorations(false)
                    .transparent(true)
                    .shadow(false)
                    .always_on_top(true)
                    .skip_taskbar(true)
                    .visible(false)
                    .theme(Some(tauri::Theme::Dark))
                    .build()
                    .expect("Failed to create wave window");
                    info!("Wave window created successfully");
                } else {
                    info!("Wave window already exists, skipping creation");
                }
                
                // Start platform-specific key monitoring only once
                if !KEY_MONITORING_STARTED.load(Ordering::Acquire) {
                    info!("Starting key monitoring");
                    KEY_MONITORING_STARTED.store(true, Ordering::Release);
                    let app_handle = app.handle().clone();
                    std::thread::spawn(move || {
                        platform::start_platform_key_monitor(app_handle);
                    });
                } else {
                    info!("Key monitoring already started, skipping");
                }
                
                info!("Application setup completed");
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            show_wave_window,
            hide_wave_window,
            toggle_wave_window,
            toggle_wave_window_and_recording,
            show_wave_window_and_start_recording,
            stop_recording_and_process,
            start_recording,
            stop_recording,
            toggle_recording,
            set_groq_api_key,
            get_current_groq_api_key,
            debug_wave_windows,
            reset_wave_window_counter,
            cancel_processing,
            load_settings,
            save_settings,
            test_groq_api_key,
            open_settings_window,
            quit_app,
            show_dashboard_window,
            close_splashscreen_window,
            debug_windows,
            transform_splash_to_dashboard,
            get_usage_stats,
            get_analytics_data,
            record_transcription_session,
            get_formatted_usage_stats,
            open_url,
            get_data_directory,
            read_version_file,
            get_transcription_history,
            search_transcription_history,
            delete_transcription_entry,
            clear_transcription_history,
            get_history_stats,
            get_history_entries_by_date,
            reload_transcription_history,
            test_text_injection,
            test_simple_text_injection,
            check_for_updates,
        ])
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
            info!("Single instance detected: another VWisper instance tried to start");
            info!("Args: {:?}, CWD: {:?}", argv, cwd);
            
            // When a second instance tries to start, bring the existing dashboard to focus
            match app.get_webview_window("splashscreen") {
                Some(window) => {
                    info!("Found splashscreen window, bringing to focus");
                    let _ = window.set_focus();
                    let _ = window.show();
                    let _ = window.unminimize();
                }
                None => {
                    // If no splashscreen, try to open/focus the dashboard
                    info!("No splashscreen found, trying to show dashboard");
                    if let Err(e) = crate::modules::ui::commands::show_dashboard_window(app.clone()) {
                        warn!("Failed to show dashboard window: {}", e);
                    }
                }
            }
        }))
        // On macOS, fully quit the app when the main dashboard window is closed
        .on_window_event(|window, event| {
            #[cfg(target_os = "macos")]
            {
                use tauri::WindowEvent;

                // Check if the dashboard window is being closed
                if window.label() == "dashboard" {
                    if let WindowEvent::CloseRequested { api, .. } = event {
                        // Prevent the default close behaviour and quit the entire application instead
                        api.prevent_close();
                        window.app_handle().exit(0);
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
