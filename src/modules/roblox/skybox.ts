import { appLocalDataDir, join } from "@tauri-apps/api/path";
import {
  exists,
  mkdir,
  readDir,
  writeFile,
  readFile,
} from "@tauri-apps/plugin-fs";
import { platform } from "@tauri-apps/plugin-os";
import { unzip } from "fflate";
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

export async function setupSkyboxUI() {
  const savedSkybox = configManager.get("currentSkybox");
  const skyboxSelect = document.getElementById(
    "skybox-select",
  ) as HTMLSelectElement;

  // Import Logic
  const btnImport = document.getElementById("btn-import-skybox");
  const fileInput = document.getElementById(
    "file-import-skybox",
  ) as HTMLInputElement;

  if (btnImport && fileInput && skyboxSelect) {
    btnImport.addEventListener("click", () => {
      fileInput.click();
    });

    fileInput.addEventListener("change", async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const arrayBuffer = await file.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);

        unzip(data, async (err, unzipped) => {
          if (err) {
            showNotification("Failed to unzip skybox: " + err);
            return;
          }

          const appDir = await appLocalDataDir();
          const customSkyboxDir = await join(appDir, "custom-skybox");
          if (!(await exists(customSkyboxDir))) {
            await mkdir(customSkyboxDir, { recursive: true });
          }

          const suffixes = ["bk", "dn", "ft", "lf", "rt", "up"];
          let foundCount = 0;

          for (const [filename, content] of Object.entries(unzipped)) {
            for (const suffix of suffixes) {
              if (
                filename.toLowerCase().includes(suffix) &&
                (filename.toLowerCase().endsWith(".png") ||
                  filename.toLowerCase().endsWith(".jpg") ||
                  filename.toLowerCase().endsWith(".jpeg") ||
                  filename.toLowerCase().endsWith(".tex"))
              ) {
                const dest = await join(
                  customSkyboxDir,
                  `sky512_${suffix}.tex`,
                );
                await writeFile(dest, content);
                foundCount++;
                break;
              }
            }
          }

          if (foundCount < 6) {
            showNotification(
              "Warning: Could not find all 6 skybox textures (bk, dn, ft, lf, rt, up) in zip.",
            );
          } else {
            showNotification("Custom skybox imported successfully!");
          }

          // Add 'custom' option if it doesn't exist
          let customOption = skyboxSelect.querySelector(
            'option[value="custom"]',
          );
          if (!customOption) {
            customOption = document.createElement("option");
            (customOption as HTMLOptionElement).value = "custom";
            customOption.textContent = "Custom (Imported)";
            skyboxSelect.appendChild(customOption);
            // Re-setup dropdowns to reflect new option
            setupCustomDropdowns();
          }

          skyboxSelect.value = "custom";
          // Trigger change event manually to update custom dropdown UI if needed
          skyboxSelect.dispatchEvent(new Event("change"));
          configManager.set("currentSkybox", "custom");
        });
      } catch (e) {
        showNotification("Error importing skybox: " + e);
      }
    });
  }

  if (skyboxSelect) {
    // Check if we have a custom skybox saved on disk to add the option
    try {
      const appDir = await appLocalDataDir();
      const customSkyboxDir = await join(appDir, "custom-skybox");
      if (await exists(customSkyboxDir)) {
        const customOption = document.createElement("option");
        customOption.value = "custom";
        customOption.textContent = "Custom (Imported)";
        skyboxSelect.appendChild(customOption);
      }
    } catch (e) {
      console.warn("Failed to check for custom skybox", e);
    }

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
              data = new Uint8Array(buffer);
            }

            if (data) {
              const destPath = await join(skyDir, filename);
              await writeFile(destPath, data);
            }
          }
        }
      }
    }
  } catch (e) {
    console.error("Failed to apply skybox:", e);
    showNotification("Failed to apply skybox: " + e);
  }
}
