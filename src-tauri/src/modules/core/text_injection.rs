use enigo::{Enigo, KeyboardControllable};
use std::sync::{Arc, Mutex};
use once_cell::sync::Lazy;
use log::{info, error};

// Global text injector instance
static TEXT_INJECTOR: Lazy<Arc<Mutex<Option<Enigo>>>> = Lazy::new(|| {
    Arc::new(Mutex::new(None))
});

pub fn init_text_injector() -> Result<(), Box<dyn std::error::Error>> {
    let enigo = Enigo::new();
    
    let mut injector_guard = TEXT_INJECTOR.lock().unwrap();
    *injector_guard = Some(enigo);
    
    info!("Text injector initialized");
    Ok(())
}

pub fn inject_text(text: &str) -> Result<(), Box<dyn std::error::Error>> {
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