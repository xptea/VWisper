use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{Device, Stream, SampleFormat};
use crossbeam_channel::{Receiver, Sender, unbounded};
use std::sync::{Arc, Mutex};
use once_cell::sync::Lazy;
use log::{info, error, warn, debug};
use tauri::Emitter;

// Global audio state - no Stream stored here
static AUDIO_STATE: Lazy<Arc<Mutex<AudioState>>> = Lazy::new(|| {
    Arc::new(Mutex::new(AudioState::new()))
});

pub struct AudioState {
    audio_sender: Option<Sender<Vec<f32>>>,
    audio_receiver: Option<Receiver<Vec<f32>>>,
    is_recording: bool,
    sample_rate: u32,
}

impl AudioState {
    fn new() -> Self {
        let (sender, receiver) = unbounded();
        Self {
            audio_sender: Some(sender),
            audio_receiver: Some(receiver),
            is_recording: false,
            sample_rate: 44100,
        }
    }
}

// Store active stream in thread-local storage
thread_local! {
    static ACTIVE_STREAM: std::cell::RefCell<Option<Stream>> = std::cell::RefCell::new(None);
}

/// Pick a usable default input device even when the system default host (often JACK) is unavailable.
/// On many Linux systems the default CPAL host is JACK, which fails if the JACK server is not running.
/// This helper tries the current default host first and then falls back to PulseAudio and ALSA before
/// finally trying every other available host. The first host that reports a default input device is
/// returned.
fn select_default_input_device() -> Option<cpal::Device> {
    use cpal::{available_hosts, host_from_id};

    // Helper that tries to extract a usable input device from a host.
    let first_input_of_host = |host: &cpal::Host| -> Option<cpal::Device> {
        // Preferred: the default device for that host.
        if let Some(dev) = host.default_input_device() {
            return Some(dev);
        }
        // Otherwise, take the first enumerated input device.
        if let Ok(mut devices) = host.input_devices() {
            return devices.next();
        }
        None
    };

    // 1. Start with CPAL's global default host.
    let default_host = cpal::default_host();
    if let Some(dev) = first_input_of_host(&default_host) {
        return Some(dev);
    }

    // 2. Iterate through *all* hosts (in the order returned by CPAL) and pick the first with a device.
    for id in available_hosts() {
        // Skip the host we already tried above to avoid repeating work.
        if id == default_host.id() {
            continue;
        }
        if let Ok(host) = host_from_id(id) {
            if let Some(dev) = first_input_of_host(&host) {
                return Some(dev);
            }
        }
    }

    // 3. If nothing worked, give up.
    None
}



pub fn init_audio_recorder(device: Option<Device>) -> Result<(), Box<dyn std::error::Error>> {
    // Resolve the device we should use.
    let device = match device {
        Some(d) => d,
        None => select_default_input_device().ok_or("No input device available")?,
    };
    
    debug!("Audio recorder initialized with device: {}", device.name().unwrap_or_default());
    
    let config = device.default_input_config()?.config();
    let sample_rate = config.sample_rate.0;
    
    // Update global state
    let mut state = AUDIO_STATE.lock().unwrap();
    state.sample_rate = sample_rate;
    
    debug!("Audio recorder initialized successfully");
    Ok(())
}

pub fn start_global_recording() -> Result<(), Box<dyn std::error::Error>> {
    {
        let state = AUDIO_STATE.lock().unwrap();
        if state.is_recording {
            warn!("Already recording");
            return Ok(());
        }
    }

    // Clone sender before moving into thread
    let sender = {
        let state = AUDIO_STATE.lock().unwrap();
        state.audio_sender.as_ref().ok_or("Audio sender unavailable")?.clone()
    };

    // Spawn background thread that owns the stream (Stream is !Send)
    std::thread::spawn(move || {
        if let Err(e) = record_thread_worker(sender) {
            error!("Recording thread error: {}", e);
        }
    });

    let mut state = AUDIO_STATE.lock().unwrap();
    state.is_recording = true;
    debug!("Audio recording thread spawned");
    Ok(())
}

fn record_thread_worker(sender: Sender<Vec<f32>>) -> Result<(), Box<dyn std::error::Error>> {
    // Select a working input device each time the thread starts.
    let device = select_default_input_device().ok_or("No input device available")?;
    let config = device.default_input_config()?.config();
    info!("Recording with device: {} | {:?}", device.name().unwrap_or_default(), config);

    let stream = build_input_stream(&device, &config, sender)?;
    stream.play()?;

    // Keep stream alive while recording flag is true
    loop {
        std::thread::sleep(std::time::Duration::from_millis(200));
        if !is_global_recording() {
            break;
        }
    }
    Ok(())
}

fn build_input_stream(device: &Device, config: &cpal::StreamConfig, sender: Sender<Vec<f32>>) -> Result<Stream, Box<dyn std::error::Error>> {
    match device.default_input_config()?.sample_format() {
        SampleFormat::F32 => Ok(device.build_input_stream(
            config,
            move |data: &[f32], _| {
                let _ = sender.send(data.to_vec());
            },
            |err| error!("Audio error: {}", err),
            None,
        )?),
        SampleFormat::I16 => Ok(device.build_input_stream(
            config,
            move |data: &[i16], _| {
                let float_data: Vec<f32> = data.iter().map(|&s| s as f32 / i16::MAX as f32).collect();
                let _ = sender.send(float_data);
            },
            |err| error!("Audio error: {}", err),
            None,
        )?),
        SampleFormat::U16 => Ok(device.build_input_stream(
            config,
            move |data: &[u16], _| {
                let float_data: Vec<f32> = data.iter().map(|&s| (s as f32 - 32768.0) / 32768.0).collect();
                let _ = sender.send(float_data);
            },
            |err| error!("Audio error: {}", err),
            None,
        )?),
        _ => Err("Unsupported sample format".into()),
    }
}

pub fn stop_global_recording() {
    let mut state = AUDIO_STATE.lock().unwrap();
    if !state.is_recording {
        return;
    }
    
    state.is_recording = false;
    debug!("Audio recording stopped");
}

pub fn is_global_recording() -> bool {
    let state = AUDIO_STATE.lock().unwrap();
    state.is_recording
}

pub fn get_global_audio_receiver() -> Option<Receiver<Vec<f32>>> {
    let state = AUDIO_STATE.lock().unwrap();
    state.audio_receiver.as_ref().map(|r| r.clone())
}

pub fn get_global_sample_rate() -> u32 {
    let state = AUDIO_STATE.lock().unwrap();
    state.sample_rate
}

pub fn collect_audio_chunk(receiver: &Receiver<Vec<f32>>, duration_ms: u64, _sample_rate: u32) -> Vec<f32> {
    let mut audio_buffer = Vec::new();
    
    let start_time = std::time::Instant::now();
    while start_time.elapsed().as_millis() < duration_ms as u128 {
        if let Ok(chunk) = receiver.try_recv() {
            audio_buffer.extend(chunk);
            // For visualization, we don't need too much data
            if audio_buffer.len() >= 2048 {
                break;
            }
        } else {
            std::thread::sleep(std::time::Duration::from_millis(10));
        }
    }
    
    audio_buffer
}

pub fn send_audio_visualization(app_handle: &tauri::AppHandle, audio_data: &[f32]) {
    if audio_data.is_empty() {
        return;
    }
    
    // Sample 12 points for visualization with boosted sensitivity
    let step = (audio_data.len() / 12).max(1);
    let mut samples: Vec<f32> = audio_data.iter()
        .step_by(step)
        .take(12)
        .map(|&x| (x.abs() * 10.0).min(1.0)) // Boost amplitude ×10 and clamp
        .collect();

    // If overall volume is low, still show small idle bars for subtle feedback
    if samples.iter().all(|&v| v < 0.02) {
        samples.iter_mut().for_each(|v| *v *= 2.0);
    }

    let volume = audio_data.iter().map(|&x| x.abs()).sum::<f32>() / audio_data.len() as f32 * 10.0;
    
    let audio_payload = serde_json::json!({
        "samples": samples,
        "volume": volume
    });
    
    // Broadcast event; `emit` targets all windows in Tauri v2
    if let Err(e) = app_handle.emit("audio-data", audio_payload) {
        error!("Failed to emit audio data: {}", e);
    } else {
        // debug log removed to reduce noisy audio logs
    }
} 