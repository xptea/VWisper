use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use log::info;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub sample_rate: u32,
    pub volume_threshold: f32,
    pub processing_duration_ms: u64,
    pub groq_api_key: Option<String>,
    pub shortcut_enabled: bool,
    pub auto_start: bool,
    pub theme: String,
    pub save_history: bool,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            sample_rate: 16000,
            volume_threshold: 0.005,
            processing_duration_ms: 0,
            groq_api_key: None,
            shortcut_enabled: true,
            auto_start: false,
            theme: "system".to_string(),
            save_history: true,
        }
    }
}

impl AppConfig {
    pub fn load() -> Self {
        match Self::load_from_file() {
            Ok(config) => {
                info!("Loaded configuration from file");
                config
            }
            Err(_) => {
                // Don't log error for missing config file, it's expected on first run
                info!("Using default configuration");
                Self::default()
            }
        }
    }
    
    pub fn save(&self) -> Result<(), Box<dyn std::error::Error>> {
        let config_path = Self::get_config_path()?;
        
        // Ensure parent directory exists
        if let Some(parent) = config_path.parent() {
            fs::create_dir_all(parent)?;
        }
        
        let config_json = serde_json::to_string_pretty(self)?;
        fs::write(&config_path, config_json)?;
        
        info!("Configuration saved to: {:?}", config_path);
        Ok(())
    }
    
    fn load_from_file() -> Result<Self, Box<dyn std::error::Error>> {
        let config_path = Self::get_config_path()?;
        
        if !config_path.exists() {
            return Err("Configuration file does not exist".into());
        }
        
        let config_content = fs::read_to_string(&config_path)?;
        let config: AppConfig = serde_json::from_str(&config_content)?;
        
        Ok(config)
    }
    
    fn get_config_path() -> Result<PathBuf, Box<dyn std::error::Error>> {
        let mut config_dir = dirs::config_dir()
            .ok_or("Failed to get config directory")?;
        
        config_dir.push("vwisper");
        config_dir.push("config.json");
        
        Ok(config_dir)
    }
} 