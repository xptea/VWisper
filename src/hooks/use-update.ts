import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface UpdateInfo {
  current_version: string;
  latest_version: string;
  has_update: boolean;
  download_url?: string;
}

export interface UpdateResult {
  success: boolean;
  message: string;
}

export function useUpdate() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const checkForUpdates = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<UpdateInfo>("check_for_updates");
      setUpdateInfo(result);
    } catch (err) {
      setError(err as string);
    } finally {
      setLoading(false);
    }
  };

  const downloadAndInstallUpdate = async (downloadUrl: string) => {
    setDownloading(true);
    setError(null);
    try {
      const result = await invoke<UpdateResult>("download_and_install_update", {
        downloadUrl,
      });
      return result;
    } catch (err) {
      setError(err as string);
      throw err;
    } finally {
      setDownloading(false);
    }
  };

  useEffect(() => {
    checkForUpdates();
  }, []);

  return {
    updateInfo,
    loading,
    error,
    downloading,
    checkForUpdates,
    downloadAndInstallUpdate,
  };
} 