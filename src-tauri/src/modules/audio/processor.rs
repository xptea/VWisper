use crossbeam_channel::Receiver;
use std::thread;
use std::time::Duration;
use log::{info, error, debug, warn};
use crate::modules::core::text_injection::inject_text;
use super::{collect_audio_chunk, send_audio_visualization, is_global_recording};
use std::io::Cursor;
use crate::modules::settings::AppConfig;
use reqwest::blocking::{Client, multipart};
use std::fs;
use tauri::{Emitter, Manager};
use std::sync::atomic::{AtomicBool, Ordering};
use once_cell::sync::Lazy;
use crate::constants::{WAVE_WIDTH_COMPACT, WAVE_HEIGHT};

// Global flag to allow user-triggered cancellation of the current processing session
static CANCEL_PROCESSING: Lazy<AtomicBool> = Lazy::new(|| AtomicBool::new(false));

/// Request the currently running `AudioProcessor` thread (if any) to cancel immediately.
/// This simply flips an atomic flag that the processing thread inspects right after the
/// recording loop ends – before sending any audio to Groq or injecting text.
pub fn request_cancel_processing() {
    CANCEL_PROCESSING.store(true, Ordering::Release);
}

// Simple linear resampler – good enough for speech.
fn resample_to_16k(input: &[f32], src_rate: u32) -> Vec<f32> {
    if src_rate == 16_000 {
        return input.to_vec();
    }
    let ratio = 16_000f32 / src_rate as f32;
    let out_len = (input.len() as f32 * ratio).round() as usize;
    let mut out = Vec::with_capacity(out_len);
    for i in 0..out_len {
        let pos = i as f32 / ratio;
        let idx = pos.floor() as usize;
        let frac = pos - idx as f32;
        let s0 = input.get(idx).copied().unwrap_or(0.0);
        let s1 = input.get(idx + 1).copied().unwrap_or(s0);
        out.push(s0 + (s1 - s0) * frac);
    }
    out
}

pub struct AudioProcessor {
    is_processing: bool,
}

impl AudioProcessor {
    pub fn new() -> Self {
        Self {
            is_processing: false,
        }
    }
    
    pub fn start_processing(&mut self, app_handle: tauri::AppHandle, receiver: Receiver<Vec<f32>>, sample_rate: u32) {
        if self.is_processing {
            return;
        }
        
        self.is_processing = true;
        debug!("Starting audio processing...");
        
        thread::spawn(move || {
            let mut session_audio_mono = Vec::new();
            let chunk_duration_ms = 100; // Visualisation refresh rate

            loop {
                // Check if we should continue processing
                if !is_global_recording() {
                    debug!("Recording stopped, ending audio processing");
                    break;
                }
                
                let chunk = collect_audio_chunk(&receiver, chunk_duration_ms, sample_rate);
                
                if chunk.is_empty() {
                    thread::sleep(Duration::from_millis(50));
                    continue;
                }
                
                send_audio_visualization(&app_handle, &chunk);
                
                // Convert to mono and collect
                session_audio_mono.extend(
                    chunk.chunks(2).map(|c| if c.len()==2 {0.5*(c[0]+c[1])} else {c[0]})
                );
                
                thread::sleep(Duration::from_millis(20));
            }
            
            // After recording ends, send entire session to Groq
            if CANCEL_PROCESSING.swap(false, Ordering::Acquire) {
                info!("Processing cancelled by user, discarding audio");

                // Notify the frontend that the transcription was cancelled
                if let Err(e) = app_handle.emit("transcription-cancelled", ()) {
                    error!("Failed to emit transcription-cancelled event: {}", e);
                }

                // Reset window size and hide it
                if let Some(window) = app_handle.get_webview_window("wave-window") {
                    // Tell the front-end to collapse the pill back to its compact state
                    let _ = window.emit("wave-reset", ());

                    // Resize to compact, wait for front-end collapse, then hide
                    if let Err(e) = window.set_size(tauri::Size::Physical(tauri::PhysicalSize { width: WAVE_WIDTH_COMPACT as u32, height: WAVE_HEIGHT as u32 })) {
                        error!("Failed to reset window size: {}", e);
                    }
                    std::thread::sleep(std::time::Duration::from_millis(400));
                    if let Err(e) = window.hide() {
                        error!("Failed to hide window: {}", e);
                    }
                }

                // Reset internal counter so the next session starts cleanly
                crate::modules::ui::commands::reset_wave_window_counter_internal();

                debug!("Audio processing thread cancelled");
                return;
            }

            if !session_audio_mono.is_empty() {
                // Emit processing started event
                if let Err(e) = app_handle.emit("transcription-started", ()) {
                    error!("Failed to emit transcription-started event: {}", e);
                }
                
                match transcribe_with_groq(&session_audio_mono, sample_rate) {
                    Ok(text) if !text.trim().is_empty() => {
                        info!("Final transcript: {}", text);
                        
                        // Emit transcription completed event
                        if let Err(e) = app_handle.emit("transcription-completed", &text) {
                            error!("Failed to emit transcription-completed event: {}", e);
                        }
                        
                        // Reset window size and hide after successful processing
                        if let Some(window) = app_handle.get_webview_window("wave-window") {
                            // Tell the front-end to collapse the pill back to its compact state
                            let _ = window.emit("wave-reset", ());

                            // Resize to compact, wait for front-end collapse, then hide
                            if let Err(e) = window.set_size(tauri::Size::Physical(tauri::PhysicalSize { width: WAVE_WIDTH_COMPACT as u32, height: WAVE_HEIGHT as u32 })) {
                                error!("Failed to reset window size: {}", e);
                            }
                            std::thread::sleep(std::time::Duration::from_millis(400));
                            if let Err(e) = window.hide() {
                                error!("Failed to hide window: {}", e);
                            }
                        }
                        
                        // Reset window counter
                        crate::modules::ui::commands::reset_wave_window_counter_internal();
                        
                        if let Err(e) = inject_text(&text) {
                            error!("Failed to inject text: {}", e);
                        }
                    }
                    Ok(_) => {
                        info!("No transcript generated.");
                        // Emit transcription completed with empty text
                        if let Err(e) = app_handle.emit("transcription-completed", "") {
                            error!("Failed to emit transcription-completed event: {}", e);
                        }
                        
                        // Reset window size and hide after empty processing
                        if let Some(window) = app_handle.get_webview_window("wave-window") {
                            // Tell the front-end to collapse the pill back to its compact state
                            let _ = window.emit("wave-reset", ());

                            // Resize to compact, wait for front-end collapse, then hide
                            if let Err(e) = window.set_size(tauri::Size::Physical(tauri::PhysicalSize { width: WAVE_WIDTH_COMPACT as u32, height: WAVE_HEIGHT as u32 })) {
                                error!("Failed to reset window size: {}", e);
                            }
                            std::thread::sleep(std::time::Duration::from_millis(400));
                            if let Err(e) = window.hide() {
                                error!("Failed to hide window: {}", e);
                            }
                        }
                        
                        // Reset window counter
                        crate::modules::ui::commands::reset_wave_window_counter_internal();
                    }
                    Err(e) => {
                        error!("Groq transcription failed: {}", e);
                        // Emit transcription error event
                        if let Err(e) = app_handle.emit("transcription-error", e.to_string()) {
                            error!("Failed to emit transcription-error event: {}", e);
                        }
                        
                        // Reset window size and hide after error
                        if let Some(window) = app_handle.get_webview_window("wave-window") {
                            // Tell the front-end to collapse the pill back to its compact state
                            let _ = window.emit("wave-reset", ());

                            // Resize to compact, wait for front-end collapse, then hide
                            if let Err(e) = window.set_size(tauri::Size::Physical(tauri::PhysicalSize { width: WAVE_WIDTH_COMPACT as u32, height: WAVE_HEIGHT as u32 })) {
                                error!("Failed to reset window size: {}", e);
                            }
                            std::thread::sleep(std::time::Duration::from_millis(400));
                            if let Err(e) = window.hide() {
                                error!("Failed to hide window: {}", e);
                            }
                        }
                        
                        // Reset window counter
                        crate::modules::ui::commands::reset_wave_window_counter_internal();
                    }
                }
            } else {
                // No audio captured – still reset window and notify frontend so UI collapses.
                warn!("No audio captured in session – collapsing window");

                // Inform frontend that processing is done without result
                if let Err(e) = app_handle.emit("transcription-completed", "") {
                    error!("Failed to emit empty transcription-completed event: {}", e);
                }

                if let Some(window) = app_handle.get_webview_window("wave-window") {
                    // Tell the front-end to collapse the pill back to its compact state
                    let _ = window.emit("wave-reset", ());

                    // Resize to compact, wait for front-end collapse, then hide
                    if let Err(e) = window.set_size(tauri::Size::Physical(tauri::PhysicalSize { width: WAVE_WIDTH_COMPACT as u32, height: WAVE_HEIGHT as u32 })) {
                        error!("Failed to reset window size: {}", e);
                    }
                    std::thread::sleep(std::time::Duration::from_millis(400));
                    if let Err(e) = window.hide() {
                        error!("Failed to hide window: {}", e);
                    }
                }

                crate::modules::ui::commands::reset_wave_window_counter_internal();
            }

            debug!("Audio processing thread ended");
        });
    }
    
    pub fn stop_processing(&mut self) {
        self.is_processing = false;
        debug!("Audio processing stopped");
    }
}

fn transcribe_with_groq(audio_mono: &[f32], src_rate: u32) -> Result<String, Box<dyn std::error::Error>> {
    if audio_mono.is_empty() {
        return Ok(String::new());
    }

    // Resample to 16 kHz mono as required by Groq
    let samples_16k = resample_to_16k(audio_mono, src_rate);

    // Encode to WAV in-memory
    let wav_bytes = {
        let mut cursor = Cursor::new(Vec::<u8>::new());
        {
            let spec = hound::WavSpec {
                channels: 1,
                sample_rate: 16_000,
                bits_per_sample: 16,
                sample_format: hound::SampleFormat::Int,
            };
            let mut writer = hound::WavWriter::new(&mut cursor, spec)?;
            for &s in &samples_16k {
                let v = (s.clamp(-1.0, 1.0) * i16::MAX as f32) as i16;
                writer.write_sample(v)?;
            }
            writer.finalize()?;
        }
        cursor.into_inner()
    };

    // Retrieve API key (env var takes precedence)
    let api_key = std::env::var("GROQ_API_KEY").ok()
        .or_else(|| AppConfig::load().groq_api_key)
        .ok_or("Groq API key not configured")?;

    // Build multipart request
    let part = multipart::Part::bytes(wav_bytes)
        .file_name("audio.wav")
        .mime_str("audio/wav")?;

    let form = multipart::Form::new()
        .part("file", part)
        .text("model", "distil-whisper-large-v3-en")
        .text("response_format", "text")
        .text("language", "en");

    let client = Client::new();
    let start = std::time::Instant::now();
    let resp = client
        .post("https://api.groq.com/openai/v1/audio/transcriptions")
        .bearer_auth(api_key)
        .multipart(form)
        .send()?;

    let elapsed = start.elapsed();

    if let Err(e) = resp.error_for_status_ref() {
        error!("Groq STT HTTP error after {:?}: {}", elapsed, e);
        return Err(e.into());
    }

    info!("Groq STT round-trip: {:?}", elapsed);

    Ok(resp.text()?)
} 