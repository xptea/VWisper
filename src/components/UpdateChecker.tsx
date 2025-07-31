import { useEffect } from "react";
import { useUpdate } from "@/hooks/use-update";
import { toast } from "sonner";

export function UpdateChecker() {
  const { updateInfo, downloadAndInstallUpdate } = useUpdate();

  useEffect(() => {
    if (updateInfo?.has_update && updateInfo.download_url) {
      toast.info(
        <div className="space-y-2">
          <div className="font-medium">Update Available</div>
          <div className="text-sm">
            Version {updateInfo.latest_version} is now available. You're currently on version {updateInfo.current_version}.
          </div>
          <button
            onClick={async () => {
              try {
                await downloadAndInstallUpdate(updateInfo.download_url!);
                toast.success("Update installer started. The application will close and the installer will handle the update.");
              } catch (error) {
                toast.error("Failed to start update installer");
              }
            }}
            className="bg-primary text-primary-foreground px-3 py-1 rounded text-sm hover:bg-primary/90"
          >
            Download & Install
          </button>
        </div>,
        {
          duration: 10000,
          action: {
            label: "Dismiss",
            onClick: () => {},
          },
        }
      );
    }
  }, [updateInfo, downloadAndInstallUpdate]);

  return null;
} 