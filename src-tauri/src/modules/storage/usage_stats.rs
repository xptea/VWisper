use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use chrono::{DateTime, Utc};
use log::{info, error};

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
        let now = Utc::now();
        Self {
            total_recordings: 0,
            total_duration_ms: 0,
            total_processing_time_ms: 0,
            successful_recordings: 0,
            failed_recordings: 0,
            total_characters_transcribed: 0,
            first_use: now,
            last_use: now,
            sessions: Vec::new(),
        }
    }
}

impl UsageStats {
    pub fn load() -> Self {
        match Self::load_from_file() {
            Ok(stats) => {
                info!("Loaded usage stats from file");
                stats
            }
            Err(e) => {
                info!("Creating new usage stats file: {}", e);
                Self::default()
            }
        }
    }

    pub fn add_recording(&mut self, session: RecordingSession) {
        self.total_recordings += 1;
        self.total_duration_ms += session.audio_length_ms;
        self.total_processing_time_ms += session.processing_time_ms;
        self.total_characters_transcribed += session.transcription_length as u64;
        self.last_use = session.timestamp;

        if session.success {
            self.successful_recordings += 1;
        } else {
            self.failed_recordings += 1;
        }

        // Keep only last 100 sessions to prevent file bloat
        self.sessions.push(session);
        if self.sessions.len() > 100 {
            self.sessions.remove(0);
        }

        // Save after each recording
        if let Err(e) = self.save() {
            error!("Failed to save usage stats: {}", e);
        }
    }

    pub fn get_average_duration(&self) -> u64 {
        if self.total_recordings > 0 {
            self.total_duration_ms / self.total_recordings
        } else {
            0
        }
    }

    pub fn get_average_processing_time(&self) -> u64 {
        if self.total_recordings > 0 {
            self.total_processing_time_ms / self.total_recordings
        } else {
            0
        }
    }

    pub fn get_success_rate(&self) -> f64 {
        if self.total_recordings > 0 {
            (self.successful_recordings as f64 / self.total_recordings as f64) * 100.0
        } else {
            0.0
        }
    }

    pub fn get_total_duration_formatted(&self) -> String {
        let total_seconds = self.total_duration_ms / 1000;
        let hours = total_seconds / 3600;
        let minutes = (total_seconds % 3600) / 60;
        let seconds = total_seconds % 60;

        if hours > 0 {
            format!("{}h {}m {}s", hours, minutes, seconds)
        } else if minutes > 0 {
            format!("{}m {}s", minutes, seconds)
        } else {
            format!("{}s", seconds)
        }
    }

    pub fn save(&self) -> Result<(), Box<dyn std::error::Error>> {
        let stats_path = Self::get_stats_path()?;
        
        // Ensure parent directory exists
        if let Some(parent) = stats_path.parent() {
            fs::create_dir_all(parent)?;
        }
        
        let stats_json = serde_json::to_string_pretty(self)?;
        fs::write(&stats_path, stats_json)?;
        
        info!("Usage stats saved to: {:?}", stats_path);
        Ok(())
    }

    fn load_from_file() -> Result<Self, Box<dyn std::error::Error>> {
        let stats_path = Self::get_stats_path()?;
        
        if !stats_path.exists() {
            return Err("Usage stats file does not exist".into());
        }
        
        let stats_content = fs::read_to_string(&stats_path)?;
        let stats: UsageStats = serde_json::from_str(&stats_content)?;
        
        Ok(stats)
    }

    fn get_stats_path() -> Result<PathBuf, Box<dyn std::error::Error>> {
        let mut data_dir = dirs::data_dir()
            .ok_or("Failed to get data directory")?;
        
        data_dir.push("vwisper");
        data_dir.push("usage_stats.json");
        
        Ok(data_dir)
    }
}
