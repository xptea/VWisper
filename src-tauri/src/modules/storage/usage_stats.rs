use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use chrono::{DateTime, Utc};
use log::{error, info};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordingSession {
    pub id: String,
    pub timestamp: DateTime<Utc>,
    pub duration_ms: u64,
    pub audio_length_ms: u64,
    pub transcription_length: usize,
    pub transcribed_text: String,
    pub processing_time_ms: u64,
    pub success: bool,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageStats {
    pub total_recordings: u64,
    pub total_duration_ms: u64,
    pub total_processing_time_ms: u64,
    pub successful_recordings: u64,
    pub failed_recordings: u64,
    pub total_characters_transcribed: u64,
    pub first_use: DateTime<Utc>,
    pub last_use: DateTime<Utc>,
    pub sessions: Vec<RecordingSession>,
}

impl Default for UsageStats {
    fn default() -> Self {
        Self {
            total_recordings: 0,
            total_duration_ms: 0,
            total_processing_time_ms: 0,
            successful_recordings: 0,
            failed_recordings: 0,
            total_characters_transcribed: 0,
            first_use: Utc::now(),
            last_use: Utc::now(),
            sessions: Vec::new(),
        }
    }
}

impl UsageStats {
    pub fn load() -> Self {
        match Self::load_from_file() {
            Ok(stats) => stats,
            Err(_) => {
                info!("Creating new usage stats");
                Self::default()
            }
        }
    }

    fn load_from_file() -> Result<Self, Box<dyn std::error::Error>> {
        let stats_path = Self::get_stats_path()?;
        let content = fs::read_to_string(stats_path)?;
        let stats: UsageStats = serde_json::from_str(&content)?;
        Ok(stats)
    }

    pub fn add_recording(&mut self, session: RecordingSession) {
        self.total_recordings += 1;
        self.total_duration_ms += session.duration_ms;
        self.total_processing_time_ms += session.processing_time_ms;
        self.total_characters_transcribed += session.transcription_length as u64;
        
        if session.success {
            self.successful_recordings += 1;
        } else {
            self.failed_recordings += 1;
        }
        
        self.last_use = session.timestamp;
        
        self.sessions.push(session);
        
        if self.sessions.len() > 1000 {
            self.sessions.drain(0..self.sessions.len() - 1000);
        }
    }

    pub fn save(&self) -> Result<(), Box<dyn std::error::Error>> {
        let stats_path = Self::get_stats_path()?;
        
        if let Some(parent) = stats_path.parent() {
            fs::create_dir_all(parent)?;
        }
        
        let content = serde_json::to_string_pretty(self)?;
        fs::write(stats_path, content)?;
        Ok(())
    }

    fn get_stats_path() -> Result<PathBuf, Box<dyn std::error::Error>> {
        let app_dir = dirs::data_dir()
            .ok_or("Failed to find data directory")?
            .join("VWisper");
        
        Ok(app_dir.join("usage_stats.json"))
    }
}

