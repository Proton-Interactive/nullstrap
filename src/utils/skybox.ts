import { appLocalDataDir, join } from "@tauri-apps/api/path";
import {
  exists,
  readFile,
} from "@tauri-apps/plugin-fs";
import { platform } from "@tauri-apps/plugin-os";
import { invoke } from "@tauri-apps/api/core";
import { ConfigManager } from "./config";
import { showNotification } from "./ui";

const configManager = ConfigManager.getInstance();

const skyboxTextures = import.meta.glob(
  "/src/assets/skyboxes*.{png,jpg,jpeg,tex}",
  {
    query: "?url",
    import: "default",
    eager: true,
  },
);

export async function applySkyboxToDisk() {
  const currentPlatform = platform();
  console.log(`[Skybox] Applying skybox for ${currentPlatform}`);
  if (currentPlatform === "linux") return;

  let selected = configManager.get("currentSkybox");
  if (!selected) selected = "default";
  
  if (selected.includes('/') || selected.includes('\\')) {
      const parts = selected.split(/[/\\]/);
      selected = parts[parts.length - 1]; 
  }

  const suffixes = ["bk", "dn", "ft", "lf", "rt", "up"];

  try {
    const appDir = await appLocalDataDir();

    for (const suffix of suffixes) {
      const filename = `sky512_${suffix}.tex`;
      let data: Uint8Array | null = null;

      if (selected === "custom") {
        const customSkyboxDir = await join(appDir, "custom-skybox");
        const srcPath = await join(customSkyboxDir, filename);
        if (await exists(srcPath)) {
          data = await readFile(srcPath);
        } else {
          console.warn(`Custom texture not found: ${filename}`);
          continue;
        }
      } else {
        const targetPath = `/src/assets/skyboxes/${selected}/${filename}`;
        let assetUrl = skyboxTextures[targetPath] as string;
        
        if (!assetUrl) {
            const key = Object.keys(skyboxTextures).find(k => 
                k.toLowerCase().includes(`/skyboxes/${selected.toLowerCase()}/`) && 
                k.toLowerCase().endsWith(filename.toLowerCase())
            );
            if (key) assetUrl = skyboxTextures[key] as string;
        }

        if (!assetUrl) {
          console.warn(`Texture not found in build: ${targetPath}`);
          continue;
        }

        const response = await fetch(assetUrl);
        if (!response.ok) throw new Error(`Failed to fetch ${filename}`);
        const blob = await response.blob();
        const buffer = await blob.arrayBuffer();
        data = new Uint8Array(buffer);
      }

      if (data) {
        await invoke("apply_skybox_texture", { 
          filename, 
          data: Array.from(data) 
        });
      }
    }
  } catch (e) {
    console.error("Failed to apply skybox:", e);
    showNotification("Failed to apply skybox: " + e);
  }
}

