use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use chrono::{DateTime, Utc, Local};
use log::{info, error};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyStats {
    pub date: String, // YYYY-MM-DD format
    pub recordings: u64,
    pub duration_ms: u64,
    pub characters_transcribed: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalyticsData {
    pub daily_stats: Vec<DailyStats>,
    pub weekly_average: f64,
    pub monthly_total: u64,
    pub most_active_day: String,
    pub peak_usage_hour: u8,
}

impl Default for AnalyticsData {
    fn default() -> Self {
        Self {
            daily_stats: Vec::new(),
            weekly_average: 0.0,
            monthly_total: 0,
            most_active_day: "Monday".to_string(),
            peak_usage_hour: 9,
        }
    }
}

impl AnalyticsData {
    pub fn load() -> Self {
        match Self::load_from_file() {
            Ok(analytics) => {
                info!("Loaded analytics data from file");
                analytics
            }
            Err(_) => {
                info!("Creating new analytics data");
                Self::default()
            }
        }
    }

    pub fn update_with_recording(&mut self, duration_ms: u64, characters: usize) {
        let today = Local::now().format("%Y-%m-%d").to_string();
        
        // Update or create today's stats
        if let Some(daily_stat) = self.daily_stats.iter_mut().find(|stat| stat.date == today) {
            daily_stat.recordings += 1;
            daily_stat.duration_ms += duration_ms;
            daily_stat.characters_transcribed += characters as u64;
        } else {
            self.daily_stats.push(DailyStats {
                date: today,
                recordings: 1,
                duration_ms,
                characters_transcribed: characters as u64,
            });
        }

        // Keep only last 30 days
        self.daily_stats.sort_by(|a, b| a.date.cmp(&b.date));
        if self.daily_stats.len() > 30 {
            self.daily_stats = self.daily_stats.split_off(self.daily_stats.len() - 30);
        }

        self.calculate_analytics();
        
        if let Err(e) = self.save() {
            error!("Failed to save analytics data: {}", e);
        }
    }

    fn calculate_analytics(&mut self) {
        if self.daily_stats.is_empty() {
            return;
        }

        // Calculate weekly average
        let last_7_days = if self.daily_stats.len() >= 7 {
            &self.daily_stats[self.daily_stats.len() - 7..]
        } else {
            &self.daily_stats
        };
        
        let total_recordings: u64 = last_7_days.iter().map(|day| day.recordings).sum();
        self.weekly_average = total_recordings as f64 / last_7_days.len() as f64;

        // Calculate monthly total
        self.monthly_total = self.daily_stats.iter().map(|day| day.recordings).sum();

        // Find most active day (simplified - just find day with most recordings)
        if let Some(most_active) = self.daily_stats.iter().max_by_key(|day| day.recordings) {
            self.most_active_day = most_active.date.clone();
        }
    }

    pub fn save(&self) -> Result<(), Box<dyn std::error::Error>> {
        let analytics_path = Self::get_analytics_path()?;
        
        // Ensure parent directory exists
        if let Some(parent) = analytics_path.parent() {
            fs::create_dir_all(parent)?;
        }
        
        let analytics_json = serde_json::to_string_pretty(self)?;
        fs::write(&analytics_path, analytics_json)?;
        
        info!("Analytics data saved to: {:?}", analytics_path);
        Ok(())
    }

    fn load_from_file() -> Result<Self, Box<dyn std::error::Error>> {
        let analytics_path = Self::get_analytics_path()?;
        
        if !analytics_path.exists() {
            return Err("Analytics file does not exist".into());
        }
        
        let analytics_content = fs::read_to_string(&analytics_path)?;
        let analytics: AnalyticsData = serde_json::from_str(&analytics_content)?;
        
        Ok(analytics)
    }

    fn get_analytics_path() -> Result<PathBuf, Box<dyn std::error::Error>> {
        let mut data_dir = dirs::data_dir()
            .ok_or("Failed to get data directory")?;
        
        data_dir.push("vwisper");
        data_dir.push("analytics.json");
        
        Ok(data_dir)
    }
}
