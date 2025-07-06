use cpal::traits::{DeviceTrait, HostTrait};
use cpal::{Device, Host, SupportedStreamConfig};
use serde::{Deserialize, Serialize};
use std::fmt;
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioDeviceInfo {
    pub name: String,
    pub display_name: String,
    pub is_default: bool,
    pub sample_rate: u32,
    pub channels: u16,
}

impl fmt::Display for AudioDeviceInfo {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "{}{}", 
            self.display_name, 
            if self.is_default { " (Default)" } else { "" }
        )
    }
}

fn friendly_name(raw: &str) -> String {
    let lower = raw.to_lowercase();
    if lower == "default" {
        "Default Device".to_string()
    } else if lower == "pulse" {
        "PulseAudio".to_string()
    } else if lower.starts_with("hw:") {
        // Try to extract CARD name
        if let Some(card_part) = raw.split("CARD=").nth(1) {
            let card_name = card_part.split([',', ']']).next().unwrap_or(card_part);
            card_name.to_string()
        } else {
            raw.to_string()
        }
    } else {
        raw.to_string()
    }
}

pub struct AudioDeviceManager {
    host: Host,
}

impl AudioDeviceManager {
    pub fn new() -> Self {
        Self {
            host: cpal::default_host(),
        }
    }
    
    pub fn get_input_devices(&self) -> Result<Vec<AudioDeviceInfo>, Box<dyn std::error::Error>> {
        let mut devices = Vec::new();
        let default_device = self.host.default_input_device();
        let default_name = default_device.as_ref()
            .and_then(|d| d.name().ok())
            .unwrap_or_default();
        
        for device in self.host.input_devices()? {
            if let Ok(name) = device.name() {
                let is_default = name == default_name;
                
                // Get device config
                let config = device.default_input_config()
                    .unwrap_or_else(|_| {
                        // Fallback config
                        SupportedStreamConfig::new(
                            2, // stereo
                            cpal::SampleRate(44100),
                            cpal::SupportedBufferSize::Range { min: 512, max: 2048 },
                            cpal::SampleFormat::F32,
                        )
                    });
                
                devices.push(AudioDeviceInfo {
                    name: name.clone(),
                    display_name: friendly_name(&name),
                    is_default,
                    sample_rate: config.sample_rate().0,
                    channels: config.channels(),
                });
            }
        }
        
        // Deduplicate display names by appending index if necessary
        let mut counts = HashMap::<String, usize>::new();
        for device in &mut devices {
            let entry = counts.entry(device.display_name.clone()).or_insert(0);
            *entry += 1;
            if *entry > 1 {
                device.display_name = format!("{} ({})", device.display_name, *entry - 1);
            }
        }
        
        Ok(devices)
    }
    
    pub fn get_device_by_name(&self, name: &str) -> Result<Option<Device>, Box<dyn std::error::Error>> {
        for device in self.host.input_devices()? {
            if let Ok(device_name) = device.name() {
                if device_name == name {
                    return Ok(Some(device));
                }
            }
        }
        Ok(None)
    }
} 