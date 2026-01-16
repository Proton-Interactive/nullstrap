import { appLocalDataDir, join, homeDir } from "@tauri-apps/api/path";
import {
  exists,
  mkdir,
  readDir,
  readTextFile,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
import { platform } from "@tauri-apps/plugin-os";
import { ConfigManager, FastFlags } from "../../config";

const currentPlatform = platform();
const configManager = ConfigManager.getInstance();

export function setupFastFlagsUI() {
  // tab logic
  const tabRoblox = document.getElementById("btn-ff-tab-roblox");
  const tabStudio = document.getElementById("btn-ff-tab-studio");
  const contentRoblox = document.getElementById("ff-content-roblox");
  const contentStudio = document.getElementById("ff-content-studio");

  // platform-specific ui tweaks
  const metalRowStudio = document
    .getElementById("ff-studio-FFlagDebugGraphicsPreferMetal")
    ?.closest(".setting-row") as HTMLElement | null;
  const metalRowRoblox = document
    .getElementById("ff-roblox-FFlagDebugGraphicsPreferMetal")
    ?.closest(".setting-row") as HTMLElement | null;

  if (currentPlatform !== "macos") {
    if (metalRowStudio) metalRowStudio.style.display = "none";
    if (metalRowRoblox) metalRowRoblox.style.display = "none";
  }

  if (tabRoblox && tabStudio && contentRoblox && contentStudio) {
    tabRoblox.addEventListener("click", () => {
      contentRoblox.style.display = "block";
      contentStudio.style.display = "none";
      tabRoblox.style.background = "rgba(255, 255, 255, 0.1)";
      tabStudio.style.background = "transparent";
    });

    tabStudio.addEventListener("click", () => {
      contentRoblox.style.display = "none";
      contentStudio.style.display = "block";
      tabStudio.style.background = "rgba(255, 255, 255, 0.1)";
      tabRoblox.style.background = "transparent";
    });
  }

  // bind ui controls
  bindFastFlags("roblox");
  bindFastFlags("studio");

  // json editor logic
  setupJsonEditor();
}

function bindFastFlags(context: "roblox" | "studio") {
  const configKey = context === "roblox" ? "fastFlags" : "fastFlagsStudio";
  const currentFlags = configManager.get(configKey);
  const ffKeys = Object.keys(currentFlags) as (keyof FastFlags)[];

  ffKeys.forEach((key) => {
    const element = document.getElementById(`ff-${context}-${key}`);
    if (!element) return;

    const value = currentFlags[key];

    if (typeof value === "boolean") {
      const checkbox = element as HTMLInputElement;
      checkbox.checked = value;

      // remove existing listeners to avoid duplicates if re-bound
      const newCheckbox = checkbox.cloneNode(true) as HTMLInputElement;
      checkbox.parentNode?.replaceChild(newCheckbox, checkbox);

      newCheckbox.addEventListener("change", (e) => {
        const flags = configManager.get(configKey);
        const isChecked = (e.target as HTMLInputElement).checked;
        // @ts-ignore
        flags[key] = isChecked;

        // exclusive graphics flags logic
        if (isChecked) {
          const graphicsFlags = [
            "FFlagDebugGraphicsPreferD3D11",
            "FFlagDebugGraphicsPreferVulkan",
            "FFlagDebugGraphicsPreferOpenGL",
            "FFlagDebugGraphicsPreferMetal",
          ];

          if (graphicsFlags.includes(key as string)) {
            graphicsFlags.forEach((gKey) => {
              if (gKey !== key) {
                // @ts-ignore
                flags[gKey] = false;
                const el = document.getElementById(
                  `ff-${context}-${gKey}`,
                ) as HTMLInputElement;
                if (el) el.checked = false;
              }
            });
          }
        }

        configManager.set(configKey, flags);
      });
    } else if (typeof value === "number") {
      const input = element as HTMLInputElement;
      input.value = value.toString();

      const newInput = input.cloneNode(true) as HTMLInputElement;
      input.parentNode?.replaceChild(newInput, input);

      newInput.addEventListener("input", (e) => {
        const val = parseInt((e.target as HTMLInputElement).value);
        if (!isNaN(val)) {
          const flags = configManager.get(configKey);
          // @ts-ignore
          flags[key] = val;
          configManager.set(configKey, flags);
        }
      });
    }
  });
}

function setupJsonEditor() {
  const ffEditorModal = document.getElementById("ff-editor-modal");
  const ffJsonEditor = document.getElementById(
    "ff-json-editor",
  ) as HTMLTextAreaElement;
  let currentContext: "roblox" | "studio" = "roblox";

  function closeFfEditor() {
    if (ffEditorModal) {
      ffEditorModal.style.display = "none";
    }
  }

  function openEditor(context: "roblox" | "studio") {
    if (ffEditorModal && ffJsonEditor) {
      currentContext = context;
      const configKey = context === "roblox" ? "fastFlags" : "fastFlagsStudio";
      const flags = configManager.get(configKey);
      ffJsonEditor.value = JSON.stringify(flags, null, 2);
      ffEditorModal.style.display = "flex";
    }
  }

  document
    .getElementById("btn-open-ff-editor-roblox")
    ?.addEventListener("click", () => openEditor("roblox"));

  document
    .getElementById("btn-open-ff-editor-studio")
    ?.addEventListener("click", () => openEditor("studio"));

  document
    .getElementById("btn-close-ff-editor")
    ?.addEventListener("click", closeFfEditor);
  document
    .getElementById("ff-editor-overlay")
    ?.addEventListener("click", closeFfEditor);

  document
    .getElementById("btn-save-ff-editor")
    ?.addEventListener("click", () => {
      try {
        if (ffJsonEditor) {
          const newFlags = JSON.parse(ffJsonEditor.value);
          const configKey =
            currentContext === "roblox" ? "fastFlags" : "fastFlagsStudio";
          configManager.set(configKey, newFlags);
          closeFfEditor();

          // re-bind ui to reflect changes from json
          bindFastFlags(currentContext);
        }
      } catch (e) {
        alert("Invalid JSON: " + e);
      }
    });
}

function processFlags(flags: any): Record<string, string> {
  const processed: Record<string, string> = {};
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
  const flagsRoblox = processFlags(configManager.get("fastFlags"));
  const flagsStudio = processFlags(configManager.get("fastFlagsStudio"));

  // linux (sober) logic
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
    Object.assign(config, soberSettings);
    config.fflags = flagsRoblox;

    await writeTextFile(configPath, JSON.stringify(config, null, 2));

    // note: vinegar (linux studio) configuration is separate and typically uses toml.
    // Supporting it requires writing to ~/.var/app/org.vinegarhq.Vinegar/config/vinegar/config.toml
    // Implementing basic support would require a TOML parser/writer or simple append, which is complex without a library.
    // Skipping Vinegar flag injection for now.
  } else {
    // windows / macos logic
    const appDir = await appLocalDataDir();
    const versionsDir = await join(appDir, "rblx-versions");

    if (!(await exists(versionsDir))) {
      throw new Error(
        "Versions directory not found. Please launch Roblox or Studio first.",
      );
    }

    const entries = await readDir(versionsDir);
    let saved = false;

    for (const entry of entries) {
      if (entry.isDirectory) {
        const versionPath = await join(versionsDir, entry.name);

        // determine if this is player or studio
        const isPlayerWindows = await exists(
          await join(versionPath, "RobloxPlayerBeta.exe"),
        );
        const isStudioWindows = await exists(
          await join(versionPath, "RobloxStudioBeta.exe"),
        );
        const isPlayerMac = await exists(
          await join(versionPath, "RobloxPlayer.app"),
        );
        const isStudioMac = await exists(
          await join(versionPath, "RobloxStudio.app"),
        );

        const isPlayer = isPlayerWindows || isPlayerMac;
        const isStudio = isStudioWindows || isStudioMac;

        if (!isPlayer && !isStudio) continue;

        let clientSettingsDir: string;

        if (currentPlatform === "macos") {
          const appName = isStudio ? "RobloxStudio.app" : "RobloxPlayer.app";
          clientSettingsDir = await join(
            versionPath,
            appName,
            "Contents",
            "MacOS",
            "ClientSettings",
          );
        } else {
          clientSettingsDir = await join(versionPath, "ClientSettings");
        }

        if (!(await exists(clientSettingsDir))) {
          await mkdir(clientSettingsDir, { recursive: true });
        }

        const filePath = await join(
          clientSettingsDir,
          "ClientAppSettings.json",
        );

        const flagsToWrite = isStudio ? flagsStudio : flagsRoblox;
        await writeTextFile(filePath, JSON.stringify(flagsToWrite, null, 2));
        saved = true;
      }
    }

    if (!saved) {
      throw new Error("No installed Roblox or Studio versions found to patch.");
    }
  }
}
