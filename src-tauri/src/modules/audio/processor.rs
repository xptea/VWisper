use crossbeam_channel::Receiver;
use std::thread;
use std::time::Duration;
use log::{info, error, debug, warn};
use crate::modules::core::text_injection::inject_text;
use super::{collect_audio_chunk, send_audio_visualization, is_global_recording};
use crate::modules::settings::AppConfig;
use reqwest::blocking::{Client, multipart};
use std::fs;
use tauri::{Emitter, Manager};
use std::sync::atomic::{AtomicBool, Ordering};
use once_cell::sync::Lazy;
use crate::constants::{WAVE_WIDTH_COMPACT, WAVE_HEIGHT};
use crate::modules::storage::{UsageStats, AnalyticsData, RecordingSession};
use uuid::Uuid;
use chrono::Utc;

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

/// Preprocess audio for optimal speech recognition quality
/// Applies normalization, noise reduction, and dynamic range optimization
fn preprocess_audio_for_speech(samples: &[f32]) -> Vec<f32> {
    if samples.is_empty() {
        return Vec::new();
    }
    
    let mut processed = samples.to_vec();
    
    // 1. Remove DC offset (center around zero)
    let mean = processed.iter().sum::<f32>() / processed.len() as f32;
    for sample in &mut processed {
        *sample -= mean;
    }
    
    // 2. Apply normalization with RMS-based scaling for consistent loudness
    let rms = (processed.iter().map(|&x| x * x).sum::<f32>() / processed.len() as f32).sqrt();
    if rms > 0.0 {
        let target_rms = 0.1; // Target RMS level for speech
        let scale = target_rms / rms;
        for sample in &mut processed {
            *sample *= scale;
        }
    }
    
    // 3. Simple high-pass filter to remove low-frequency noise (< 80 Hz)
    // This helps remove rumble and background noise common in recordings
    let alpha = 0.98; // High-pass filter coefficient
    let mut prev_input = 0.0;
    let mut prev_output = 0.0;
    
    for sample in &mut processed {
        let input = *sample;
        let output = alpha * (prev_output + input - prev_input);
        *sample = output;
        prev_input = input;
        prev_output = output;
    }
    
    // 4. Soft limiting to prevent clipping while maintaining dynamics
    for sample in &mut processed {
        *sample = sample.clamp(-0.95, 0.95);
    }
    
    processed
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
            let chunk_duration_ms = 100; 

            loop {
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
                
                // Convert to mono (audio from CPAL is typically interleaved if stereo)
                // For most microphones, input is already mono, but some setups might give stereo
                // We'll assume if we get pairs, it's stereo and average them
                let mono_chunk: Vec<f32> = chunk.chunks(2)
                    .map(|c| if c.len() == 2 { 0.5 * (c[0] + c[1]) } else { c[0] })
                    .collect();
                
                session_audio_mono.extend(mono_chunk);
                
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
                // Calculate audio duration
                let audio_duration_ms = (session_audio_mono.len() as f64 / sample_rate as f64 * 1000.0) as u64;
                let processing_start = std::time::Instant::now();
                
                // Emit processing started event
                if let Err(e) = app_handle.emit("transcription-started", ()) {
                    error!("Failed to emit transcription-started event: {}", e);
                }
                
                match transcribe_with_groq(&session_audio_mono, sample_rate) {
                    Ok(text) if !text.trim().is_empty() => {
                        let processing_duration = processing_start.elapsed().as_millis() as u64;
                        info!("Final transcript: {}", text);
                        
                        // Record successful session
                        record_session(audio_duration_ms, processing_duration, &text, true, None);
                        
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
                            // Play error sound if text injection fails
                            crate::modules::audio::sound::play_error_sound();
                        } else {
                            // Play ending sound after successful text injection
                            crate::modules::audio::sound::play_ending_sound();
                        }
                    }
                    Ok(_) => {
                        let processing_duration = processing_start.elapsed().as_millis() as u64;
                        info!("No transcript generated.");
                        
                        // Record empty session
                        record_session(audio_duration_ms, processing_duration, "", true, Some("Empty transcription".to_string()));
                        
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
                        let processing_duration = processing_start.elapsed().as_millis() as u64;
                        error!("Groq transcription failed: {}", e);
                        
                        // Record failed session
                        record_session(audio_duration_ms, processing_duration, "", false, Some(e.to_string()));
                        
                        // Play error sound for transcription failure
                        crate::modules::audio::sound::play_error_sound();
                        
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

    // Resample to 16 kHz mono as required by Groq (matching ffmpeg -ar 16000 -ac 1)
    let samples_16k = resample_to_16k(audio_mono, src_rate);

    // Apply audio preprocessing for better speech recognition quality
    let processed_samples = preprocess_audio_for_speech(&samples_16k);

    // Encode to WAV with exact specifications: 16kHz, mono (matching ffmpeg -ar 16000 -ac 1)
    // Using WAV format for reliability while we ensure optimal preprocessing
    let wav_bytes = {
        let mut cursor = std::io::Cursor::new(Vec::<u8>::new());
        {
            let spec = hound::WavSpec {
                channels: 1,           // mono (-ac 1)
                sample_rate: 16_000,   // 16kHz (-ar 16000)
                bits_per_sample: 16,   // 16-bit samples
                sample_format: hound::SampleFormat::Int,
            };
            let mut writer = hound::WavWriter::new(&mut cursor, spec)?;
            for &s in &processed_samples {
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

    // Build multipart request with WAV file (16kHz, mono as specified)
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

/// Record a transcription session for analytics
fn record_session(
    audio_duration_ms: u64,
    processing_duration_ms: u64,
    transcription: &str,
    success: bool,
    error_message: Option<String>
) {
    let session = RecordingSession {
        id: Uuid::new_v4().to_string(),
        timestamp: Utc::now(),
        duration_ms: processing_duration_ms,
        audio_length_ms: audio_duration_ms,
        transcription_length: transcription.len(),
        processing_time_ms: processing_duration_ms,
        success,
        error_message,
    };

    // Update usage stats
    let mut stats = UsageStats::load();
    stats.add_recording(session.clone());

    // Update analytics
    let mut analytics = AnalyticsData::load();
    analytics.update_with_recording(audio_duration_ms, transcription.len());

    info!("Recorded session: {} chars, {}ms duration, success: {}", 
        transcription.len(), audio_duration_ms, success);
}