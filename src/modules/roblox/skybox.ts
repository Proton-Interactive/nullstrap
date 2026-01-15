import { appLocalDataDir, join } from "@tauri-apps/api/path";
import { exists, mkdir, readDir, writeFile } from "@tauri-apps/plugin-fs";
import { platform } from "@tauri-apps/plugin-os";
import { ConfigManager } from "../../config";
import { setupCustomDropdowns } from "../../dropdown";
import { showNotification } from "../ui";

const currentPlatform = platform();
const configManager = ConfigManager.getInstance();

const skyboxTextures = import.meta.glob(
  "/src/assets/skyboxes/**/*.{png,jpg,jpeg,tex}",
  {
    query: "?url",
    import: "default",
    eager: true,
  },
);

export function setupSkyboxUI() {
  const savedSkybox = configManager.get("currentSkybox");
  const skyboxSelect = document.getElementById(
    "skybox-select",
  ) as HTMLSelectElement;

  if (skyboxSelect) {
    if (savedSkybox) {
      skyboxSelect.value = savedSkybox;
    }
    skyboxSelect.addEventListener("change", () => {
      configManager.set("currentSkybox", skyboxSelect.value);
    });

    if (currentPlatform === "linux") {
      const disclaimer = document.getElementById("skybox-disclaimer");
      if (disclaimer) {
        disclaimer.style.display = "block";
      }
    }
  }

  setupCustomDropdowns();
}

export async function applySkyboxToDisk() {
  if (currentPlatform === "linux") return; // Not supported on Sober

  const selected = configManager.get("currentSkybox");
  const suffixes = ["bk", "dn", "ft", "lf", "rt", "up"];

  try {
    const appDir = await appLocalDataDir();
    const versionsDir = await join(appDir, "rblx-versions");

    if (!(await exists(versionsDir))) {
      return;
    }

    const entries = await readDir(versionsDir);

    for (const entry of entries) {
      if (entry.isDirectory) {
        const versionPath = await join(versionsDir, entry.name);

        let skyDir = "";
        if (currentPlatform === "windows") {
          skyDir = await join(
            versionPath,
            "PlatformContent",
            "pc",
            "textures",
            "sky",
          );
        } else if (currentPlatform === "macos") {
          // MacOS: RobloxPlayer.app/Contents/Resources/PlatformContent/pc/textures/sky
          skyDir = await join(
            versionPath,
            "RobloxPlayer.app",
            "Contents",
            "Resources",
            "PlatformContent",
            "pc",
            "textures",
            "sky",
          );
        }

        if (skyDir) {
          if (!(await exists(skyDir))) {
            await mkdir(skyDir, { recursive: true });
          }

          for (const suffix of suffixes) {
            const filename = `sky512_${suffix}.tex`;
            // Vite glob keys are absolute from project root
            const key = `/src/assets/skyboxes/${selected}/${filename}`;
            // @ts-ignore
            const assetUrl = skyboxTextures[key] as string;

            if (!assetUrl) {
              console.warn(`Texture not found in build: ${key}`);
              continue;
            }

            const response = await fetch(assetUrl);
            if (!response.ok) throw new Error(`Failed to fetch ${filename}`);
            const blob = await response.blob();
            const buffer = await blob.arrayBuffer();
            const data = new Uint8Array(buffer);

            const destPath = await join(skyDir, filename);
            await writeFile(destPath, data);
          }
        }
      }
    }
  } catch (e) {
    console.error("Failed to apply skybox:", e);
    showNotification("Failed to apply skybox: " + e);
  }
}
