import { platform } from "@tauri-apps/plugin-os";
import { invoke } from "@tauri-apps/api/core";
import { ConfigManager } from "./config";
import { showNotification } from "./ui";
import { saveFastFlagsToDisk } from "./fastflags";
import { applySkyboxToDisk } from "./skybox";
import { setActivity } from "./discordRpc";

const configManager = ConfigManager.getInstance();

export async function launchRoblox() {
    console.log("[Launcher] Launch initiated");
    configManager.saveConfig(); 
    try {
      const currentPlatform = platform();
      const showNotifications = configManager.get("showNotifications");

      if (currentPlatform === "linux") {
        if (showNotifications) showNotification("launching sober...");
        if (configManager.get("discordRpcEnabled")) {
          setActivity("Launching Roblox", "Preparing to play");
        }
        await invoke("launch_roblox_executable", { path: "sober" });
        return;
      }

      // Windows/Mac: Use unified Rust backend for installation/updates
      if (showNotifications) showNotification("verifying roblox...");
      const exePath = await invoke<string>("ensure_roblox_installed");
      
      console.log(`[Launcher] Roblox verified at: ${exePath}`);

      // Apply mods now that we are sure the directory exists and is populated
      if (showNotifications) showNotification("applying mods...");
      
      try {
        await saveFastFlagsToDisk();
        await applySkyboxToDisk();
      } catch (modError) {
        console.warn("[Launcher] Mod application failed, but continuing launch:", modError);
      }

      // Discord RPC
      if (configManager.get("discordRpcEnabled")) {
          setActivity("Launching Roblox", "Preparing to play");
      }

      // Launch it!
      if (showNotifications) showNotification("launching roblox...");
      await invoke("launch_roblox_executable", { path: exePath });

    } catch (e) {
      console.error("failed to launch", e);
      if (configManager.get("showNotifications"))
        showNotification("error: " + e);
        throw e;
    }
}


function unixPathSplit(path: string) {
    return path.split('/');
}
