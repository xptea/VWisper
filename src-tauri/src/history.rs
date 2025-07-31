use std::sync::{Arc, Mutex};
use chrono::{DateTime, Utc};
use serde::{Serialize, Deserialize};
use std::fs;
use std::path::PathBuf;
use dirs::config_dir;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TranscriptionEntry {
    pub id: String,
    pub timestamp: DateTime<Utc>,
    pub text: String,
    pub round_trip_ms: Option<u64>,
    pub hold_time_ms: Option<u64>,
    pub status: String,
    pub wav_path: Option<String>,
}

#[derive(Clone, Default, Serialize, Deserialize)]
pub struct HistoryData {
    pub entries: Vec<TranscriptionEntry>,
}

#[derive(Clone, Default)]
pub struct History {
    pub entries: Arc<Mutex<Vec<TranscriptionEntry>>>,
}

fn history_path() -> PathBuf {
    let mut path = config_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("vwisper");
    fs::create_dir_all(&path).ok();
    path.push("history.json");
    path
}

impl History {
    pub fn new() -> Self {
        let entries = if let Ok(data) = fs::read_to_string(history_path()) {
            serde_json::from_str::<HistoryData>(&data).map(|d| d.entries).unwrap_or_default()
        } else {
            Vec::new()
        };
        Self {
            entries: Arc::new(Mutex::new(entries)),
        }
    }

    pub fn add_entry(&self, entry: TranscriptionEntry) {
        let mut entries = self.entries.lock().unwrap();
        entries.push(entry);
        let data = HistoryData {
            entries: entries.clone(),
        };
        let _ = fs::write(
            history_path(),
            serde_json::to_string_pretty(&data).unwrap_or_default(),
        );
    }

    pub fn get_entries(&self) -> Vec<TranscriptionEntry> {
        let entries = self.entries.lock().unwrap();
        entries.clone()
    }
}
