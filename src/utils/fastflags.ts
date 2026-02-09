import { appLocalDataDir, join, homeDir } from "@tauri-apps/api/path";
import { invoke } from "@tauri-apps/api/core";
import {
  exists,
  mkdir,
  readTextFile,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
import { platform } from "@tauri-apps/plugin-os";
import { ConfigManager } from "./config";

const configManager = ConfigManager.getInstance();

function processFlags(flags: any): Record<string, string> {
  const processed: Record<string, string> = {};
  if (!flags) return processed;
  
  for (const [key, value] of Object.entries(flags)) {
    if (typeof value === "boolean") {
      processed[key] = value ? "True" : "False";
    } else {
      processed[key] = String(value);
    }
  }
  return processed;
}

export async function saveFastFlagsToDisk() {
  const currentPlatform = platform();
  console.log(`[FastFlags] Saving flags for ${currentPlatform}`);
  const flagsRoblox = processFlags(configManager.get("fastFlags"));
  const flagsStudio = processFlags(configManager.get("fastFlagsStudio"));

  if (currentPlatform === "linux") {
    const home = await homeDir();
    const configPath = await join(
      home,
      ".var",
      "app",
      "org.vinegarhq.Sober",
      "config",
      "sober",
      "config.json",
    );

    let config: any = {};
    if (await exists(configPath)) {
      try {
        const content = await readTextFile(configPath);
        config = JSON.parse(content);
      } catch (e) {
        console.warn("Failed to parse existing Sober config", e);
      }
    } else {
      const configDir = await join(
        home,
        ".var",
        "app",
        "org.vinegarhq.Sober",
        "config",
        "sober",
      );
      await mkdir(configDir, { recursive: true });
    }

    const soberSettings = configManager.get("sober");
    Object.assign(config, soberSettings || {});
    config.fflags = flagsRoblox;

    await writeTextFile(configPath, JSON.stringify(config, null, 2));

  } else {
    try {
      await invoke("save_fast_flags", { 
        flagsJson: JSON.stringify(flagsRoblox), 
        mode: "player" 
      });
    } catch (e) {
      console.warn("Backend failed to save player fast flags", e);
    }
    
    try {
      await invoke("save_fast_flags", { 
        flagsJson: JSON.stringify(flagsStudio), 
        mode: "studio" 
      });
    } catch (e) {
      console.log("No Studio installation to apply flags to.");
    }
  }
}
