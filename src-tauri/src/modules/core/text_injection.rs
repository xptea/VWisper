use enigo::{Enigo, Keyboard, Settings};
use std::sync::{Arc, Mutex};
use once_cell::sync::Lazy;
use log::{info, error};

#[cfg(not(target_os = "macos"))]
static TEXT_INJECTOR: Lazy<Arc<Mutex<Option<Enigo>>>> = Lazy::new(|| {
    Arc::new(Mutex::new(None))
});

pub fn init_text_injector() -> Result<(), Box<dyn std::error::Error>> {
    #[cfg(not(target_os = "macos"))]
    {
        let enigo = Enigo::new(&Settings::default()).map_err(|e| format!("Failed to create Enigo instance: {}", e))?;
        
        let mut injector_guard = TEXT_INJECTOR.lock().unwrap();
        *injector_guard = Some(enigo);
        
        info!("Text injector initialized");
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
        let mut injector_guard = TEXT_INJECTOR.lock().unwrap();
        
        if let Some(injector) = injector_guard.as_mut() {
            info!("Injecting text: {}", text);
            injector.text(text).map_err(|e| format!("Failed to inject text: {}", e))?;
            Ok(())
        } else {
            error!("Text injector not initialized");
            Err("Text injector not initialized".into())
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