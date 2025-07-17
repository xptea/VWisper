use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use chrono::{DateTime, Utc};
use log::{error, info};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptionEntry {
    pub id: String,
    pub timestamp: DateTime<Utc>,
    pub transcribed_text: String,
    pub duration_ms: u64,
    pub success: bool,
    pub processing_time_ms: u64,
    pub character_count: usize,
    pub word_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptionHistory {
    pub entries: Vec<TranscriptionEntry>,
    pub max_entries: usize,
}

impl Default for TranscriptionHistory {
    fn default() -> Self {
        Self {
            entries: Vec::new(),
            max_entries: 1000,
        }
    }
}

impl TranscriptionHistory {
    pub fn load() -> Self {
        match Self::load_from_file() {
            Ok(history) => history,
            Err(_) => {
                info!("Creating new transcription history");
                Self::default()
            }
        }
    }

    fn load_from_file() -> Result<Self, Box<dyn std::error::Error>> {
        let history_path = Self::get_history_path()?;
        let content = fs::read_to_string(history_path)?;
        let history: TranscriptionHistory = serde_json::from_str(&content)?;
        Ok(history)
    }

    pub fn save(&self) -> Result<(), Box<dyn std::error::Error>> {
        let history_path = Self::get_history_path()?;
        
        if let Some(parent) = history_path.parent() {
            fs::create_dir_all(parent)?;
        }
        
        let content = serde_json::to_string_pretty(self)?;
        fs::write(history_path, content)?;
        Ok(())
    }

    fn get_history_path() -> Result<PathBuf, Box<dyn std::error::Error>> {
        let app_dir = dirs::data_dir()
            .ok_or("Failed to find data directory")?
            .join("VWisper");
        
        Ok(app_dir.join("transcription_history.json"))
    }

    pub fn add_entry(&mut self, entry: TranscriptionEntry) {
        self.entries.push(entry);
        
        if self.entries.len() > self.max_entries {
            self.entries.drain(0..self.entries.len() - self.max_entries);
        }
        
        self.entries.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    }

    pub fn get_recent_entries(&self, limit: usize) -> Vec<&TranscriptionEntry> {
        self.entries.iter().take(limit).collect()
    }

    pub fn delete_entry(&mut self, id: &str) -> bool {
        if let Some(pos) = self.entries.iter().position(|entry| entry.id == id) {
            self.entries.remove(pos);
            true
        } else {
            false
        }
    }
}

pub fn estimate_word_count(text: &str) -> usize {
    if text.is_empty() {
        return 0;
    }
    
    text.split_whitespace().count()
}


