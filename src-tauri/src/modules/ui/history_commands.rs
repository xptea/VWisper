use crate::modules::storage::usage_stats::{RecordingSession, UsageStats};
use crate::modules::storage::history::TranscriptionHistory;
use chrono::{DateTime, Utc};
use serde_json;
use tauri::AppHandle;

// All history commands have been removed as they are not used in the frontend
// The main history functionality is handled by get_transcription_history and delete_transcription_entry in commands.rs
