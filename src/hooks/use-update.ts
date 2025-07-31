import { useState, useEffect, useRef } from "react";
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

class UpdateManager {
  private static instance: UpdateManager;
  private checkInProgress = false;
  private lastCheckTime = 0;
  private readonly CHECK_COOLDOWN = 5000; // 5 seconds cooldown
  private cachedUpdateInfo: UpdateInfo | null = null;

  private constructor() {}

  static getInstance(): UpdateManager {
    if (!UpdateManager.instance) {
      UpdateManager.instance = new UpdateManager();
    }
    return UpdateManager.instance;
  }

  async checkForUpdates(): Promise<UpdateInfo> {
    const now = Date.now();
    
    if (this.checkInProgress) {
      if (this.cachedUpdateInfo) {
        return this.cachedUpdateInfo;
      }
      throw new Error("Update check already in progress");
    }
    
    if (now - this.lastCheckTime < this.CHECK_COOLDOWN && this.cachedUpdateInfo) {
      return this.cachedUpdateInfo;
    }
    
    this.checkInProgress = true;
    this.lastCheckTime = now;
    
    try {
      const result = await invoke<UpdateInfo>("check_for_updates");
      this.cachedUpdateInfo = result;
      return result;
    } catch (err) {
      throw err;
    } finally {
      this.checkInProgress = false;
    }
  }

  getCachedUpdateInfo(): UpdateInfo | null {
    return this.cachedUpdateInfo;
  }
}

const updateManager = UpdateManager.getInstance();

export function useUpdate() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const hasCheckedRef = useRef(false);

  const checkForUpdates = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await updateManager.checkForUpdates();
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
    if (!hasCheckedRef.current) {
      hasCheckedRef.current = true;
      const cached = updateManager.getCachedUpdateInfo();
      if (cached) {
        setUpdateInfo(cached);
      } else {
        checkForUpdates();
      }
    }
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