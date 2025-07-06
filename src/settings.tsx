import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import React from 'react';
import ReactDOM from 'react-dom/client';

interface AudioDevice {
  name: string;
  display_name: string;
  is_default: boolean;
  sample_rate: number;
  channels: number;
}

const Settings = () => {
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [modelDir, setModelDir] = useState<string>("");
  const [apiKey, setApiKey] = useState<string>("");
  const [status, setStatus] = useState<{ msg: string; ok: boolean } | null>(null);

  const showStatus = (msg: string, ok: boolean) => {
    setStatus({ msg, ok });
    setTimeout(() => setStatus(null), 4000);
  };

  const refreshDevices = async () => {
    try {
      const devs: AudioDevice[] = await invoke("get_audio_devices");
      setDevices(devs);
      if (!selectedDevice) {
        const def = devs.find((d) => d.is_default);
        if (def) setSelectedDevice(def.name);
      }
    } catch (e) {
      console.error(e);
      showStatus("Failed to load devices", false);
    }
  };

  const refreshModels = async () => {
    try {
      const mods: string[] = await invoke("list_available_models");
      setModels(mods);
      const current: string | null = await invoke("get_current_preferred_model");
      if (current) setSelectedModel(current);
      else if (mods.length) setSelectedModel(mods[0]);
    } catch (e) {
      console.error(e);
      showStatus("Failed to load models", false);
    }
  };

  const loadModelDir = async () => {
    try {
      const dir: string = await invoke("get_models_directory");
      setModelDir(dir);
    } catch (e) {
      console.error(e);
    }
  };

  const loadApiKey = async () => {
    try {
      const key: string | null = await invoke("get_current_groq_api_key");
      if (key) setApiKey(key);
    } catch (_) {}
  };

  useEffect(() => {
    refreshDevices();
    refreshModels();
    loadModelDir();
    loadApiKey();
  }, []);

  const saveSettings = async () => {
    if (!selectedDevice) {
      showStatus("Select audio device", false);
      return;
    }
    try {
      await invoke("set_audio_device", { deviceName: selectedDevice });
      if (selectedModel) await invoke("set_preferred_model", { modelName: selectedModel });
      if (apiKey.trim()) await invoke("set_groq_api_key", { apiKey: apiKey.trim() });
      showStatus("Settings saved", true);
    } catch (e: any) {
      console.error(e);
      showStatus("Failed to save: " + (e?.message ?? e), false);
    }
  };

  return (
    <div className="container">
      <h1>VWisper Settings</h1>
      {status && (
        <div className={"status " + (status.ok ? "success" : "error")}>{status.msg}</div>
      )}

      {/* Devices */}
      <div className="setting-group">
        <label className="setting-label">Audio Input Device</label>
        <button className="button" onClick={refreshDevices} style={{ marginBottom: 8 }}>
          Refresh Devices
        </button>
        <div className="device-list">
          {devices.map((d) => (
            <div
              key={d.name}
              className={"device-item " + (d.name === selectedDevice ? "selected" : "")}
              onClick={() => setSelectedDevice(d.name)}
            >
              <div className="device-name">{d.display_name || d.name}</div>
              <div className="device-info">
                {d.sample_rate} Hz, {d.channels} ch {d.is_default ? " (Default)" : ""}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Model */}
      <div className="setting-group">
        <label className="setting-label">Whisper Model</label>
        <select
          className="setting-input"
          value={selectedModel ?? ""}
          onChange={(e) => setSelectedModel(e.target.value)}
        >
          {models.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <div style={{ fontSize: 12, marginTop: 4 }}>Model dir: {modelDir}</div>
      </div>

      {/* API key */}
      <div className="setting-group">
        <label className="setting-label">Groq API Key</label>
        <input
          type="password"
          className="setting-input"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Enter Groq API key"
        />
      </div>

      <button className="button" onClick={saveSettings} style={{ width: "100%" }}>
        Save Settings
      </button>
    </div>
  );
};

export default Settings;

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Settings />
  </React.StrictMode>
); 