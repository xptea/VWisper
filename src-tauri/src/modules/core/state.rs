use std::sync::{Arc, Mutex};
use once_cell::sync::Lazy;

// Global state to track window visibility
static WINDOW_VISIBLE: Lazy<Arc<Mutex<bool>>> = Lazy::new(|| {
    Arc::new(Mutex::new(false))
});

pub fn set_window_visible(visible: bool) {
    let mut visible_guard = WINDOW_VISIBLE.lock().unwrap();
    *visible_guard = visible;
}

