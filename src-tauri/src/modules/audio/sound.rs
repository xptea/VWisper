use log::{info, error};
use std::path::PathBuf;

/// Play a sound file using the system's audio capabilities
pub fn play_sound(sound_name: &str) -> Result<(), Box<dyn std::error::Error>> {
    let sound_path = get_sound_path(sound_name)?;
    
    info!("Playing sound: {}", sound_path.display());
    
    #[cfg(target_os = "macos")]
    {
        play_sound_macos(&sound_path)
    }
    
    #[cfg(target_os = "linux")]
    {
        play_sound_linux(&sound_path)
    }
    
    #[cfg(target_os = "windows")]
    {
        play_sound_windows(&sound_path)
    }
}

fn get_sound_path(sound_name: &str) -> Result<PathBuf, Box<dyn std::error::Error>> {
    // Try multiple possible locations for the sound files
    let possible_paths = vec![
        // Development mode - relative to project root
        PathBuf::from("src-tauri/sounds").join(sound_name),
        PathBuf::from("sounds").join(sound_name),
        // Development mode - relative to working directory
        PathBuf::from("../sounds").join(sound_name),
        PathBuf::from("../../sounds").join(sound_name),
        // Production mode - relative to executable
        {
            let mut exe_path = std::env::current_exe()
                .unwrap_or_else(|_| PathBuf::from("."));
            exe_path.pop(); // Remove executable name
            exe_path.push("sounds");
            exe_path.push(sound_name);
            exe_path
        },
    ];
    
    for path in possible_paths {
        if path.exists() {
            info!("Found sound file at: {}", path.display());
            return Ok(path);
        }
    }
    
    Err(format!("Sound file '{}' not found in any expected location", sound_name).into())
}

#[cfg(target_os = "macos")]
fn play_sound_macos(sound_path: &PathBuf) -> Result<(), Box<dyn std::error::Error>> {
    use std::process::Command;
    
    let output = Command::new("afplay")
        .arg(sound_path)
        .output()
        .map_err(|e| format!("Failed to execute afplay: {}", e))?;
    
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("afplay failed: {}", stderr).into());
    }
    
    Ok(())
}

#[cfg(target_os = "linux")]
fn play_sound_linux(sound_path: &PathBuf) -> Result<(), Box<dyn std::error::Error>> {
    use std::process::Command;
    
    // Try paplay (PulseAudio) first, then aplay (ALSA)
    let players = ["paplay", "aplay"];
    
    for player in &players {
        match Command::new(player).arg(sound_path).output() {
            Ok(output) if output.status.success() => return Ok(()),
            Ok(output) => {
                let stderr = String::from_utf8_lossy(&output.stderr);
                error!("{} failed: {}", player, stderr);
            }
            Err(e) => {
                error!("Failed to execute {}: {}", player, e);
            }
        }
    }
    
    Err("No audio player found (tried paplay, aplay)".into())
}

#[cfg(target_os = "windows")]
fn play_sound_windows(sound_path: &PathBuf) -> Result<(), Box<dyn std::error::Error>> {
    use std::process::Command;
    
    let sound_path_str = sound_path.to_string_lossy();
    
    let output = Command::new("powershell")
        .args(&[
            "-Command",
            &format!(
                "(New-Object Media.SoundPlayer '{}').PlaySync()",
                sound_path_str
            ),
        ])
        .output()
        .map_err(|e| format!("Failed to execute powershell: {}", e))?;
    
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("PowerShell sound playback failed: {}", stderr).into());
    }
    
    Ok(())
}

/// Play the start recording sound
pub fn play_start_sound() {
    std::thread::spawn(|| {
        if let Err(e) = play_sound("start.wav") {
            error!("Failed to play start sound: {}", e);
        }
    });
}

/// Play the end recording sound (after text injection)
pub fn play_ending_sound() {
    std::thread::spawn(|| {
        if let Err(e) = play_sound("ending.wav") {
            error!("Failed to play ending sound: {}", e);
        }
    });
}

/// Play the error sound
pub fn play_error_sound() {
    std::thread::spawn(|| {
        if let Err(e) = play_sound("error.wav") {
            error!("Failed to play error sound: {}", e);
        }
    });
}
