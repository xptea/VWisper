use std::fs::File;
use std::io::Read;
use reqwest::blocking::Client;
use serde_json::Value;
use std::time::Instant;
use serde::{Serialize, Deserialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct TranscriptionResult {
    pub text: String,
    pub round_trip_ms: u64,
    pub status: String,
    pub error: Option<String>,
}

pub fn transcribe_audio(file_path: &str, api_key: &str) -> TranscriptionResult {
    let mut file = match File::open(file_path) {
        Ok(f) => f,
        Err(e) => {
            return TranscriptionResult {
                text: String::new(),
                round_trip_ms: 0,
                status: "error".to_string(),
                error: Some(e.to_string()),
            }
        }
    };
    let mut buffer = Vec::new();
    if let Err(e) = file.read_to_end(&mut buffer) {
        return TranscriptionResult {
            text: String::new(),
            round_trip_ms: 0,
            status: "error".to_string(),
            error: Some(e.to_string()),
        }
    }

    let client = Client::new();
    let url = "https://api.groq.com/openai/v1/audio/transcriptions";
    let form = match reqwest::blocking::multipart::Form::new()
        .file("file", file_path)
    {
        Ok(f) => f.text("model", "whisper-large-v3-turbo").text("response_format", "json"),
        Err(e) => {
            return TranscriptionResult {
                text: String::new(),
                round_trip_ms: 0,
                status: "error".to_string(),
                error: Some(e.to_string()),
            }
        }
    };

    let start = Instant::now();
    let resp = client.post(url)
        .multipart(form)
        .bearer_auth(api_key)
        .send();
    let duration = start.elapsed();
    let round_trip_ms = duration.as_millis() as u64;
    match resp {
        Ok(resp) => {
            let status = resp.status();
            let text = match resp.text() {
                Ok(t) => t,
                Err(e) => {
                    return TranscriptionResult {
                        text: String::new(),
                        round_trip_ms,
                        status: "error".to_string(),
                        error: Some(e.to_string()),
                    }
                }
            };
            if !status.is_success() {
                return TranscriptionResult {
                    text: String::new(),
                    round_trip_ms,
                    status: "error".to_string(),
                    error: Some(format!("Groq API error: {} - {}", status, text)),
                }
            }
            let v: Value = match serde_json::from_str(&text) {
                Ok(val) => val,
                Err(e) => {
                    return TranscriptionResult {
                        text: String::new(),
                        round_trip_ms,
                        status: "error".to_string(),
                        error: Some(e.to_string()),
                    }
                }
            };
            TranscriptionResult {
                text: v["text"].as_str().unwrap_or("").to_string(),
                round_trip_ms,
                status: "success".to_string(),
                error: None,
            }
        }
        Err(e) => TranscriptionResult {
            text: String::new(),
            round_trip_ms,
            status: "error".to_string(),
            error: Some(e.to_string()),
        },
    }
} 