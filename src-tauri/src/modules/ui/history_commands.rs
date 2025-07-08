use tauri::command;
use log::{error, info};

use crate::modules::{
    storage::{UsageStats, RecordingSession},
    settings::AppConfig,
};

#[command]
pub fn get_transcription_history(limit: Option<usize>) -> Result<Vec<RecordingSession>, String> {
    // Check if history saving is enabled
    let config = AppConfig::load();
    if !config.save_history {
        return Ok(vec![]);
    }

    let stats = UsageStats::load();
    let limit = limit.unwrap_or(50); // Default to 50 entries
    
    let mut sessions = stats.sessions.clone();
    // Sort by timestamp (newest first)
    sessions.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    // Limit results
    sessions.truncate(limit);
    
    Ok(sessions)
}

#[command]
pub fn search_transcription_history(query: String, limit: Option<usize>) -> Result<Vec<RecordingSession>, String> {
    // Check if history saving is enabled
    let config = AppConfig::load();
    if !config.save_history {
        return Ok(vec![]);
    }

    let stats = UsageStats::load();
    let limit = limit.unwrap_or(50);
    let query_lower = query.to_lowercase();
    
    let mut filtered_sessions: Vec<RecordingSession> = stats.sessions
        .into_iter()
        .filter(|session| session.transcribed_text.to_lowercase().contains(&query_lower))
        .collect();
    
    // Sort by timestamp (newest first)
    filtered_sessions.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    // Limit results
    filtered_sessions.truncate(limit);
    
    Ok(filtered_sessions)
}

#[command]
pub fn delete_transcription_entry(entry_id: String) -> Result<bool, String> {
    let mut stats = UsageStats::load();
    
    if let Some(pos) = stats.sessions.iter().position(|session| session.id == entry_id) {
        let removed_session = stats.sessions.remove(pos);
        
        // Update the aggregate stats
        stats.total_recordings = stats.total_recordings.saturating_sub(1);
        if removed_session.success {
            stats.successful_recordings = stats.successful_recordings.saturating_sub(1);
        } else {
            stats.failed_recordings = stats.failed_recordings.saturating_sub(1);
        }
        stats.total_duration_ms = stats.total_duration_ms.saturating_sub(removed_session.audio_length_ms);
        stats.total_processing_time_ms = stats.total_processing_time_ms.saturating_sub(removed_session.processing_time_ms);
        stats.total_characters_transcribed = stats.total_characters_transcribed.saturating_sub(removed_session.transcription_length as u64);
        
        if let Err(e) = stats.save() {
            error!("Failed to save usage stats after deletion: {}", e);
            return Err(format!("Failed to save: {}", e));
        }
        
        info!("Deleted transcription entry: {}", entry_id);
        Ok(true)
    } else {
        Ok(false)
    }
}

#[command]
pub fn clear_transcription_history() -> Result<(), String> {
    let mut stats = UsageStats::load();
    
    stats.sessions.clear();
    
    // Reset aggregate stats
    stats.total_recordings = 0;
    stats.successful_recordings = 0;
    stats.failed_recordings = 0;
    stats.total_duration_ms = 0;
    stats.total_processing_time_ms = 0;
    stats.total_characters_transcribed = 0;
    
    if let Err(e) = stats.save() {
        error!("Failed to save usage stats after clearing: {}", e);
        return Err(format!("Failed to save: {}", e));
    }
    
    info!("Cleared all transcription history");
    Ok(())
}

#[command]
pub fn get_history_stats() -> Result<serde_json::Value, String> {
    let stats = UsageStats::load();
    
    let total_entries = stats.sessions.len();
    let success_rate = if total_entries > 0 {
        (stats.sessions.iter().filter(|s| s.success).count() as f64) / (total_entries as f64) * 100.0
    } else {
        0.0
    };
    
    let average_processing_time_ms = if total_entries > 0 {
        stats.sessions.iter().map(|s| s.processing_time_ms).sum::<u64>() / total_entries as u64
    } else {
        0
    };
    
    let total_characters = stats.sessions.iter().map(|s| s.transcription_length).sum::<usize>();
    
    // Estimate total words (average word length ~5.7 characters including spaces)
    let total_words = (total_characters as f64 / 5.7).round() as usize;
    
    Ok(serde_json::json!({
        "total_entries": total_entries,
        "success_rate": success_rate,
        "average_processing_time_ms": average_processing_time_ms,
        "total_characters": total_characters,
        "total_words": total_words,
    }))
}

#[command]
pub fn get_history_entries_by_date(
    start_date: String,
    end_date: String,
) -> Result<Vec<RecordingSession>, String> {
    use chrono::DateTime;
    
    let stats = UsageStats::load();
    
    let start = DateTime::parse_from_rfc3339(&start_date)
        .map_err(|e| format!("Invalid start date format: {}", e))?
        .with_timezone(&chrono::Utc);
    
    let end = DateTime::parse_from_rfc3339(&end_date)
        .map_err(|e| format!("Invalid end date format: {}", e))?
        .with_timezone(&chrono::Utc);
    
    let filtered_sessions: Vec<RecordingSession> = stats.sessions
        .into_iter()
        .filter(|session| session.timestamp >= start && session.timestamp <= end)
        .collect();
    
    Ok(filtered_sessions)
}

#[command]
pub fn reload_transcription_history() -> Result<(), String> {
    // Just a notification that history was reloaded
    // The actual loading happens when other commands are called
    info!("Transcription history reloaded from usage stats");
    Ok(())
}
