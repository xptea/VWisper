use enigo::{Enigo, KeyboardControllable};
use std::sync::{Arc, Mutex};
use once_cell::sync::Lazy;
use log::{info, error};

// Global text injector instance - only used on non-macOS platforms
// On macOS, Enigo cannot be safely sent between threads due to CGEventSource
#[cfg(not(target_os = "macos"))]
static TEXT_INJECTOR: Lazy<Arc<Mutex<Option<Enigo>>>> = Lazy::new(|| {
    Arc::new(Mutex::new(None))
});

pub fn init_text_injector() -> Result<(), Box<dyn std::error::Error>> {
    #[cfg(not(target_os = "macos"))]
    {
        let enigo = Enigo::new();
        
        let mut injector_guard = TEXT_INJECTOR.lock().unwrap();
        *injector_guard = Some(enigo);
        
        info!("Text injector initialized");
    }
    
    #[cfg(target_os = "macos")]
    {
        // On macOS, we don't initialize a global instance due to thread safety issues
        // Instead, we create a new instance for each injection
        info!("Text injector initialized (macOS mode - per-use instances)");
    }
    
    Ok(())
}

pub fn inject_text(text: &str) -> Result<(), Box<dyn std::error::Error>> {
    #[cfg(not(target_os = "macos"))]
    {
        let mut injector_guard = TEXT_INJECTOR.lock().unwrap();
        
        if let Some(injector) = injector_guard.as_mut() {
            info!("Injecting text: {}", text);
            injector.key_sequence(text);
            Ok(())
        } else {
            error!("Text injector not initialized");
            Err("Text injector not initialized".into())
        }
    }
    
    #[cfg(target_os = "macos")]
    {
        // On macOS, create a new Enigo instance for each injection
        // This avoids thread safety issues with CGEventSource
        info!("Injecting text (macOS): {}", text);
        let mut enigo = Enigo::new();
        enigo.key_sequence(text);
        Ok(())
    }
}