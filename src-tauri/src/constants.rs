// Constants used across UI and audio modules for the floating wave window

// Compact (recording) pill size - increased for macOS to prevent cutoff
#[cfg(target_os = "macos")]
pub const WAVE_WIDTH_COMPACT: i32 = 240;  // Increased from 220 to 240
#[cfg(not(target_os = "macos"))]
pub const WAVE_WIDTH_COMPACT: i32 = 200;

// Height is the same for compact and expanded
pub const WAVE_HEIGHT: i32 = 80;

// Expanded (processing) pill width - increased for macOS to prevent cutoff
#[cfg(target_os = "macos")]
pub const WAVE_WIDTH_EXPANDED: i32 = 290;  // Increased from 270 to 290
#[cfg(not(target_os = "macos"))]
pub const WAVE_WIDTH_EXPANDED: i32 = 250; 