use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};
use log::{info, error};
use crate::modules::ui::commands::show_dashboard_window;

pub fn create_system_tray(app: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    info!("Creating system tray...");
    
    // Create menu items
    let dashboard_item = MenuItem::with_id(app, "dashboard", "Dashboard", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    
    // Create the menu
    let menu = Menu::with_items(app, &[
        &dashboard_item,
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
                "dashboard" => {
                    info!("Dashboard menu clicked");
                    // Try to show existing dashboard window; if absent, create a fresh one
                    if let Some(window) = app.get_webview_window("dashboard") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    } else {
                        info!("Dashboard window not found, creating a new one via command");
                        if let Err(e) = show_dashboard_window(app.clone()) {
                            error!("Failed to open dashboard from tray: {}", e);
                        }
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