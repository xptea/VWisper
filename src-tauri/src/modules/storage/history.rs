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
            max_entries: 1000, // Keep last 1000 transcriptions
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
        
        // Ensure parent directory exists
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
        
        // Keep only the most recent entries
        if self.entries.len() > self.max_entries {
            self.entries.drain(0..self.entries.len() - self.max_entries);
        }
        
        // Sort by timestamp (newest first)
        self.entries.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    }

    pub fn get_recent_entries(&self, limit: usize) -> Vec<&TranscriptionEntry> {
        self.entries.iter().take(limit).collect()
    }

    pub fn get_entries_by_date_range(&self, start: DateTime<Utc>, end: DateTime<Utc>) -> Vec<&TranscriptionEntry> {
        self.entries
            .iter()
            .filter(|entry| entry.timestamp >= start && entry.timestamp <= end)
            .collect()
    }

    pub fn search_entries(&self, query: &str) -> Vec<&TranscriptionEntry> {
        let query_lower = query.to_lowercase();
        self.entries
            .iter()
            .filter(|entry| entry.transcribed_text.to_lowercase().contains(&query_lower))
            .collect()
    }

    pub fn delete_entry(&mut self, id: &str) -> bool {
        if let Some(pos) = self.entries.iter().position(|entry| entry.id == id) {
            self.entries.remove(pos);
            true
        } else {
            false
        }
    }

    pub fn clear_all(&mut self) {
        self.entries.clear();
    }

    pub fn get_total_entries(&self) -> usize {
        self.entries.len()
    }

    pub fn get_success_rate(&self) -> f64 {
        if self.entries.is_empty() {
            return 0.0;
        }
        
        let successful = self.entries.iter().filter(|entry| entry.success).count();
        (successful as f64) / (self.entries.len() as f64) * 100.0
    }

    pub fn get_average_processing_time(&self) -> u64 {
        if self.entries.is_empty() {
            return 0;
        }
        
        let total_time: u64 = self.entries.iter().map(|entry| entry.processing_time_ms).sum();
        total_time / self.entries.len() as u64
    }

    pub fn get_total_characters(&self) -> usize {
        self.entries.iter().map(|entry| entry.character_count).sum()
    }

    pub fn get_total_words(&self) -> usize {
        self.entries.iter().map(|entry| entry.word_count).sum()
    }
}

// Helper function to estimate word count from character count
pub fn estimate_word_count(text: &str) -> usize {
    if text.is_empty() {
        return 0;
    }
    
    // Split by whitespace and count non-empty words
    text.split_whitespace().count()
}

// Helper function to generate a unique ID for transcription entries
pub fn generate_entry_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    format!("txn_{}", timestamp)
}
