use enigo::{Enigo, Keyboard, Settings};
use std::sync::{Arc, Mutex};
use once_cell::sync::Lazy;
use log::{info, error, warn};
use std::thread;
use std::time::Duration;

#[cfg(target_os = "windows")]
use clipboard::{ClipboardProvider, ClipboardContext};

#[cfg(not(target_os = "macos"))]
static TEXT_INJECTOR: Lazy<Arc<Mutex<Option<Enigo>>>> = Lazy::new(|| {
    Arc::new(Mutex::new(None))
});

pub fn init_text_injector() -> Result<(), Box<dyn std::error::Error>> {
    #[cfg(not(target_os = "macos"))]
    {
        // On Windows, we might need specific settings for better text injection
        #[cfg(target_os = "windows")]
        let settings = Settings::default();
        
        #[cfg(not(target_os = "windows"))]
        let settings = Settings::default();
        
        let enigo = Enigo::new(&settings).map_err(|e| format!("Failed to create Enigo instance: {}", e))?;
        
        let mut injector_guard = TEXT_INJECTOR.lock().unwrap();
        *injector_guard = Some(enigo);
        
        info!("Text injector initialized for {}", std::env::consts::OS);
    }
    
    #[cfg(target_os = "macos")]
    {
        info!("Text injector initialized (macOS mode - per-use instances)");
    }
    
    Ok(())
}

pub fn inject_text(text: &str) -> Result<(), Box<dyn std::error::Error>> {
    #[cfg(not(target_os = "macos"))]
    {
        info!("Injecting text on {}: '{}'", std::env::consts::OS, text);
        
        // On Windows, use clipboard method as it's more reliable
        #[cfg(target_os = "windows")]
        {
            warn!("Using clipboard-based text injection on Windows");
            return inject_text_via_clipboard(text);
        }
        
        // For non-Windows platforms, use direct text injection
        #[cfg(not(target_os = "windows"))]
        {
            let mut injector_guard = TEXT_INJECTOR.lock().unwrap();
            
            if let Some(injector) = injector_guard.as_mut() {
                // On Linux, add a small delay before injection
                #[cfg(target_os = "linux")]
                {
                    info!("Adding Linux-specific delay before text injection");
                    thread::sleep(Duration::from_millis(50));
                }
                
                // Try to inject the text directly
                match injector.text(text) {
                    Ok(_) => {
                        info!("Direct text injection successful");
                        
                        // Add a small delay after injection to ensure completion
                        thread::sleep(Duration::from_millis(50));
                        Ok(())
                    }
                    Err(e) => {
                        error!("Failed to inject text with Enigo: {}", e);
                        Err(format!("Failed to inject text: {}", e).into())
                    }
                }
            } else {
                error!("Text injector not initialized");
                Err("Text injector not initialized".into())
            }
        }
    }
    
    #[cfg(target_os = "macos")]
    {
        info!("Injecting text (macOS): {}", text);
        let mut enigo = Enigo::new(&Settings::default()).map_err(|e| format!("Failed to create Enigo instance: {}", e))?;
        enigo.text(text).map_err(|e| format!("Failed to inject text: {}", e))?;
        Ok(())
    }
}

#[cfg(target_os = "windows")]
fn inject_text_via_clipboard(text: &str) -> Result<(), Box<dyn std::error::Error>> {
    use enigo::{Key, Direction};
    
    info!("Using clipboard method to inject text: '{}'", text);
    
    // Store current clipboard content to restore later
    let mut ctx: ClipboardContext = ClipboardProvider::new()
        .map_err(|e| format!("Failed to initialize clipboard: {}", e))?;
    
    let original_clipboard = ctx.get_contents().unwrap_or_default();
    info!("Backed up original clipboard content");
    
    // Set our text to clipboard
    ctx.set_contents(text.to_string())
        .map_err(|e| format!("Failed to set clipboard content: {}", e))?;
    
    info!("Set text to clipboard, now sending Ctrl+V");
    
    // Get the injector instance for keyboard simulation
    let mut injector_guard = TEXT_INJECTOR.lock().unwrap();
    if let Some(injector) = injector_guard.as_mut() {
        // Add a longer delay to ensure the user has focused a text field
        thread::sleep(Duration::from_millis(200));
        
        // Try the clipboard approach first
        let clipboard_result = {
            // Send Ctrl+V with proper timing
            injector.key(Key::Control, Direction::Press)
                .and_then(|_| {
                    thread::sleep(Duration::from_millis(20));
                    injector.key(Key::Unicode('v'), Direction::Click)
                })
                .and_then(|_| {
                    thread::sleep(Duration::from_millis(20));
                    injector.key(Key::Control, Direction::Release)
                })
        };
        
        match clipboard_result {
            Ok(_) => {
                info!("Sent Ctrl+V key combination successfully");
                // Wait for the paste to complete
                thread::sleep(Duration::from_millis(150));
            }
            Err(e) => {
                warn!("Ctrl+V failed: {}, trying character-by-character method", e);
                
                // Fallback: type character by character
                info!("Using character-by-character fallback for: '{}'", text);
                for ch in text.chars() {
                    match ch {
                        '\n' => {
                            injector.key(Key::Return, Direction::Click)
                                .map_err(|e| format!("Failed to inject newline: {}", e))?;
                        }
                        '\t' => {
                            injector.key(Key::Tab, Direction::Click)
                                .map_err(|e| format!("Failed to inject tab: {}", e))?;
                        }
                        _ => {
                            let char_str = ch.to_string();
                            injector.text(&char_str)
                                .map_err(|e| format!("Failed to inject character '{}': {}", ch, e))?;
                        }
                    }
                    // Small delay between characters for Windows
                    thread::sleep(Duration::from_millis(10));
                }
                info!("Character-by-character injection completed");
            }
        }
        
        // Restore original clipboard content
        if !original_clipboard.is_empty() {
            if let Err(e) = ctx.set_contents(original_clipboard) {
                warn!("Failed to restore original clipboard: {}", e);
            } else {
                info!("Restored original clipboard content");
            }
        }
        
        info!("Clipboard-based text injection completed successfully");
        Ok(())
    } else {
        Err("Text injector not initialized for clipboard method".into())
    }
}