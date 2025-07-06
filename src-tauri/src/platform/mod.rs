#[cfg(target_os = "macos")]
mod macos;

#[cfg(target_os = "linux")]
pub mod linux;

#[cfg(target_os = "windows")]
mod windows;

use tauri::AppHandle;

pub fn start_platform_key_monitor(app_handle: AppHandle) {
    #[cfg(target_os = "macos")]
    macos::start_global_key_monitor(app_handle);
    
    #[cfg(target_os = "linux")]
    linux::start_global_key_monitor(app_handle);
    
    #[cfg(target_os = "windows")]
    windows::start_global_key_monitor(app_handle);
}