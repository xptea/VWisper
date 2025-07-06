#![allow(unexpected_cfgs)]

use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
use log::{info, error};

mod modules;
mod platform;

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
            get_audio_devices,
            set_audio_device,
            set_groq_api_key,
            get_current_groq_api_key,
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
    env_logger::Builder::from_env(env_logger::Env::default().filter_or("RUST_LOG", "error"))
        .format_timestamp(None)
        // Show Groq round-trip INFO while keeping the rest of audio chatter quiet
        .filter_module("vwisper_lib::modules::audio::processor", log::LevelFilter::Info)
        .filter_module("vwisper_lib::modules::audio", log::LevelFilter::Warn)
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
            info!("Setting up application");
            
            // Load configuration
            let _config = AppConfig::load();
            
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
                let _wave_window = WebviewWindowBuilder::new(
                    app,
                    "wave-window",
                    WebviewUrl::App("wave-window.html".into()),
                )
                .title("VWisper Wave")
                .inner_size(120.0, 40.0)
                .min_inner_size(120.0, 40.0)
                .max_inner_size(300.0, 60.0)
                .resizable(false)
                .decorations(false)
                .transparent(true)
                .always_on_top(true)
                .skip_taskbar(true)
                .visible(false)
                .build()
                .expect("Failed to create wave window");
            }
            
            // Start platform-specific key monitoring
            let app_handle = app.handle().clone();
            std::thread::spawn(move || {
                platform::start_platform_key_monitor(app_handle);
            });
            
            info!("Application setup completed");
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
            get_audio_devices,
            set_audio_device,
            set_groq_api_key,
            get_current_groq_api_key,
        ])
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
