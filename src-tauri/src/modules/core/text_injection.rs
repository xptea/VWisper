use enigo::{Enigo, Keyboard, Settings};
use std::sync::{Arc, Mutex};
use once_cell::sync::Lazy;
use log::{info, error, warn};
use std::thread;
use std::time::Duration;

#[cfg(any(target_os = "windows", target_os = "macos"))]
use clipboard::{ClipboardProvider, ClipboardContext};

#[cfg(any(target_os = "windows", target_os = "macos"))]
static TEXT_INJECTOR: Lazy<Arc<Mutex<Option<Enigo>>>> = Lazy::new(|| {
    Arc::new(Mutex::new(None))
});

pub fn init_text_injector() -> Result<(), Box<dyn std::error::Error>> {
    #[cfg(any(target_os = "windows", target_os = "macos"))]
    {
        // Balanced settings for reliable performance
        let settings = Settings::default();
        
        let enigo = Enigo::new(&settings).map_err(|e| format!("Failed to create Enigo instance: {}", e))?;
        
        let mut injector_guard = TEXT_INJECTOR.lock().unwrap();
        *injector_guard = Some(enigo);
        
        info!("Text injector initialized for {} (balanced clipboard mode)", std::env::consts::OS);
    }
    
    #[cfg(target_os = "linux")]
    {
        let settings = Settings::default();
        
        let enigo = Enigo::new(&settings).map_err(|e| format!("Failed to create Enigo instance: {}", e))?;
        
        let mut injector_guard = TEXT_INJECTOR.lock().unwrap();
        *injector_guard = Some(enigo);
        
        info!("Text injector initialized for {}", std::env::consts::OS);
    }
    
    Ok(())
}

pub fn inject_text(text: &str) -> Result<(), Box<dyn std::error::Error>> {
    #[cfg(any(target_os = "windows", target_os = "macos"))]
    {
        info!("Injecting text on {}: '{}'", std::env::consts::OS, text);
        
        // Use balanced clipboard method for both Windows and macOS
        return inject_text_via_clipboard(text);
    }
    
    #[cfg(target_os = "linux")]
    {
        info!("Injecting text on {}: '{}'", std::env::consts::OS, text);
        
        let mut injector_guard = TEXT_INJECTOR.lock().unwrap();
        
        if let Some(injector) = injector_guard.as_mut() {
            // Balanced delay for Linux
            thread::sleep(Duration::from_millis(50));
            
            // Try to inject the text directly
            match injector.text(text) {
                Ok(_) => {
                    info!("Direct text injection successful");
                    
                    // Balanced delay after injection
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

#[cfg(any(target_os = "windows", target_os = "macos"))]
fn inject_text_via_clipboard(text: &str) -> Result<(), Box<dyn std::error::Error>> {
    use enigo::{Key, Direction};
    
    info!("Using balanced clipboard method to inject text: '{}'", text);
    
    // Store current clipboard content to restore later
    let mut ctx: ClipboardContext = ClipboardProvider::new()
        .map_err(|e| format!("Failed to initialize clipboard: {}", e))?;
    
    let original_clipboard = ctx.get_contents().unwrap_or_default();
    
    // Set our text to clipboard
    ctx.set_contents(text.to_string())
        .map_err(|e| format!("Failed to set clipboard content: {}", e))?;
    
    info!("Set text to clipboard, now sending balanced paste");
    
    // Get the injector instance for keyboard simulation
    let mut injector_guard = TEXT_INJECTOR.lock().unwrap();
    if let Some(injector) = injector_guard.as_mut() {
        // Balanced focus delay
        #[cfg(target_os = "macos")]
        let focus_delay = Duration::from_millis(75); // Balanced for macOS
        
        #[cfg(target_os = "windows")]
        let focus_delay = Duration::from_millis(100); // Balanced for Windows
        
        thread::sleep(focus_delay);
        
        // Try the clipboard approach first
        let clipboard_result = {
            #[cfg(target_os = "macos")]
            {
                // Use Cmd+V on macOS with balanced timing
                injector.key(Key::Meta, Direction::Press)
                    .and_then(|_| {
                        thread::sleep(Duration::from_millis(15)); // Balanced delay
                        injector.key(Key::Unicode('v'), Direction::Click)
                    })
                    .and_then(|_| {
                        thread::sleep(Duration::from_millis(15)); // Balanced delay
                        injector.key(Key::Meta, Direction::Release)
                    })
            }
            
            #[cfg(target_os = "windows")]
            {
                // Use Ctrl+V on Windows with balanced timing
                injector.key(Key::Control, Direction::Press)
                    .and_then(|_| {
                        thread::sleep(Duration::from_millis(20)); // Balanced delay
                        injector.key(Key::Unicode('v'), Direction::Click)
                    })
                    .and_then(|_| {
                        thread::sleep(Duration::from_millis(20)); // Balanced delay
                        injector.key(Key::Control, Direction::Release)
                    })
            }
        };
        
        match clipboard_result {
            Ok(_) => {
                info!("Balanced paste successful");
                // Balanced wait time for paste completion
                #[cfg(target_os = "macos")]
                thread::sleep(Duration::from_millis(75)); // Balanced for macOS
                
                #[cfg(target_os = "windows")]
                thread::sleep(Duration::from_millis(100)); // Balanced for Windows
            }
            Err(e) => {
                warn!("Paste failed: {}, trying balanced character-by-character method", e);
                
                // Fallback: type character by character with balanced timing
                info!("Using balanced character-by-character fallback for: '{}'", text);
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
                    // Balanced delay between characters
                    #[cfg(target_os = "macos")]
                    thread::sleep(Duration::from_millis(8)); // Balanced for macOS
                    
                    #[cfg(target_os = "windows")]
                    thread::sleep(Duration::from_millis(10)); // Balanced for Windows
                }
                info!("Balanced character-by-character injection completed");
            }
        }
        
        // Restore original clipboard content
        if !original_clipboard.is_empty() {
            if let Err(e) = ctx.set_contents(original_clipboard) {
                warn!("Failed to restore original clipboard: {}", e);
            }
        }
        
        info!("Balanced clipboard-based text injection completed successfully");
        Ok(())
    } else {
        Err("Text injector not initialized for clipboard method".into())
    }
}