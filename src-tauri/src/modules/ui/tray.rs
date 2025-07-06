use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, Runtime,
};
use log::{info, error};

pub fn create_system_tray<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<(), Box<dyn std::error::Error>> {
    info!("Creating system tray...");
    
    // Create menu items
    let settings_item = MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    
    // Create the menu
    let menu = Menu::with_items(app, &[
        &settings_item,
        &separator,
        &quit_item,
    ])?;
    
    // Create the tray icon
    let _tray = TrayIconBuilder::new()
        .menu(&menu)
        .icon(app.default_window_icon().unwrap().clone())
        .tooltip("VWisper - Speech to Text")
        .on_tray_icon_event(|tray, event| {
            match event {
                TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                } => {
                    info!("Tray icon clicked");
                    // Toggle main window or show settings
                    if let Some(window) = tray.app_handle().get_webview_window("main") {
                        if let Ok(is_visible) = window.is_visible() {
                            if is_visible {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                }
                _ => {}
            }
        })
        .on_menu_event(|app, event| {
            info!("Menu event triggered: {}", event.id().as_ref());
            match event.id().as_ref() {
                "settings" => {
                    info!("Settings menu clicked");
                    if let Err(e) = show_settings_window(app) {
                        error!("Failed to show settings window: {}", e);
                    }
                }
                "quit" => {
                    info!("Quit menu clicked");
                    app.exit(0);
                }
                _ => {
                    info!("Unknown menu event: {}", event.id().as_ref());
                }
            }
        })
        .build(app)?;
    
    info!("System tray created successfully");
    Ok(())
}

fn show_settings_window<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<(), Box<dyn std::error::Error>> {
    info!("Attempting to show settings window...");
    
    // Check if settings window already exists
    if let Some(window) = app.get_webview_window("settings") {
        info!("Settings window already exists, showing it");
        window.show()?;
        window.set_focus()?;
        return Ok(());
    }
    
    info!("Creating new settings window");
    
    // Create new settings window
    let _settings_window = tauri::WebviewWindowBuilder::new(
        app,
        "settings",
        tauri::WebviewUrl::App("settings.html".into()),
    )
    .title("VWisper Settings")
    .inner_size(500.0, 400.0)
    .min_inner_size(400.0, 300.0)
    .center()
    .resizable(true)
    .decorations(true)
    .always_on_top(false)
    .skip_taskbar(false)
    .visible(true)
    .build()?;
    
    info!("Settings window created and shown");
    Ok(())
} 