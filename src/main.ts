import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { Snowfall } from "./snowfall";
import { ConfigManager, FastFlags, SoberSettings } from "./config";
import { openPath } from "@tauri-apps/plugin-opener";
import { setupCustomDropdowns } from "./dropdown";
import {
  appLocalDataDir,
  join,
  tempDir,
  localDataDir,
  homeDir,
} from "@tauri-apps/api/path";
import {
  remove,
  exists,
  writeTextFile,
  mkdir,
  readDir,
  writeFile,
  readTextFile,
} from "@tauri-apps/plugin-fs";
import { unzip } from "fflate";
import { Command } from "@tauri-apps/plugin-shell";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { platform } from "@tauri-apps/plugin-os";

const appWindow = getCurrentWindow();
const currentPlatform = platform();

const configManager = ConfigManager.getInstance();

// Logging setup
(async () => {
  try {
    const appDir = await appLocalDataDir();
    const logsDir = await join(appDir, "logs");

    if (!(await exists(logsDir))) {
      await mkdir(logsDir, { recursive: true });
    }

    const date = new Date();
    const timestamp = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}_${String(date.getHours()).padStart(2, "0")}-${String(date.getMinutes()).padStart(2, "0")}-${String(date.getSeconds()).padStart(2, "0")}`;
    const filename = `log-${timestamp}.txt`;
    const logPath = await join(logsDir, filename);

    // Initial log file creation
    await writeTextFile(logPath, `Log started: ${new Date().toISOString()}\n`);

    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    const logToFile = async (level: string, ...args: any[]) => {
      try {
        const msg = args
          .map((arg) =>
            typeof arg === "object" ? JSON.stringify(arg) : String(arg),
          )
          .join(" ");
        const line = `[${new Date().toISOString()}] [${level}] ${msg}\n`;
        await writeTextFile(logPath, line, { append: true });
      } catch (err) {
        // Prevent infinite loop if logging fails
      }
    };

    console.log = (...args) => {
      originalLog.apply(console, args);
      logToFile("INFO", ...args);
    };

    console.warn = (...args) => {
      originalWarn.apply(console, args);
      logToFile("WARN", ...args);
    };

    console.error = (...args) => {
      originalError.apply(console, args);
      logToFile("ERROR", ...args);
    };

    console.log(`Logging initialized to ${logPath}`);
  } catch (e) {
    console.error("Failed to initialize logging:", e);
  }
})();

// Restore window size
const savedWidth = configManager.get("windowWidth");
const savedHeight = configManager.get("windowHeight");
if (savedWidth && savedHeight) {
  appWindow.setSize(new LogicalSize(savedWidth, savedHeight));
}

// Save window size on resize
let resizeTimeout: number;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = window.setTimeout(async () => {
    if (await appWindow.isMaximized()) return;
    configManager.set("windowWidth", window.innerWidth);
    configManager.set("windowHeight", window.innerHeight);
  }, 500);
});

// apply square corners
invoke("apply_square_corners");

// animate entry
window.addEventListener("DOMContentLoaded", () => {
  if (configManager.get("openingAnimationEnabled")) {
    document.body.classList.add("animate-entry");
  } else {
    document.body.style.opacity = "1";
  }
});

// set version in title
getVersion().then((version) => {
  const titleHeader = document.getElementById("title-header");
  if (titleHeader) {
    titleHeader.innerText = `nullstrap | v${version}`;
  }
});

// titlebar controls
document
  .getElementById("titlebar-minimize")
  ?.addEventListener("click", () => appWindow.minimize());
document
  .getElementById("titlebar-maximize")
  ?.addEventListener("click", () => appWindow.toggleMaximize());
document
  .getElementById("titlebar-close")
  ?.addEventListener("click", () => appWindow.close());

// close button
document
  .getElementById("btn-close")
  ?.addEventListener("click", () => appWindow.close());

// tab switching logic
const tabs = document.querySelectorAll(".tab-btn");
tabs.forEach((button) => {
  button.addEventListener("click", () => {
    document
      .querySelectorAll(".tab-btn")
      .forEach((btn) => btn.classList.remove("active"));
    button.classList.add("active");

    document
      .querySelectorAll(".tab-content")
      .forEach((content) => ((content as HTMLElement).style.display = "none"));

    const tabId = button.getAttribute("data-tab");
    if (tabId) {
      configManager.set("lastTab", tabId);
      const tabContent = document.getElementById("tab-" + tabId);
      if (tabContent) {
        tabContent.style.display = "block";
      }
    }
  });
});

// Restore last tab
const lastTab = configManager.get("lastTab");
const tabToActivate = document.querySelector(
  `.tab-btn[data-tab="${lastTab}"]`,
) as HTMLElement;
if (tabToActivate) {
  tabToActivate.click();
} else if (tabs.length > 0) {
  (tabs[0] as HTMLElement).click();
}

// Snowfall logic
const snowfall = new Snowfall();
const snowfallToggle = document.getElementById(
  "snowfall-toggle",
) as HTMLInputElement;

if (snowfallToggle) {
  // Load saved setting
  const isEnabled = configManager.get("snowfallEnabled");

  snowfallToggle.checked = isEnabled;
  snowfall.toggle(isEnabled);

  // Listener
  snowfallToggle.addEventListener("change", (e) => {
    const checked = (e.target as HTMLInputElement).checked;
    snowfall.toggle(checked);
    configManager.set("snowfallEnabled", checked);
  });
}

// Opening Animation logic
const openingAnimationToggle = document.getElementById(
  "opening-animation-toggle",
) as HTMLInputElement;

if (openingAnimationToggle) {
  const isEnabled = configManager.get("openingAnimationEnabled");
  openingAnimationToggle.checked = isEnabled;

  openingAnimationToggle.addEventListener("change", (e) => {
    const checked = (e.target as HTMLInputElement).checked;
    configManager.set("openingAnimationEnabled", checked);
  });
}

// FPS Unlocker logic
const fpsUnlockToggle = document.getElementById(
  "fps-unlock-toggle",
) as HTMLInputElement;

async function setFpsCap(unlocked: boolean) {
  try {
    let settingsPath = "";

    if (currentPlatform === "windows") {
      const localAppData = await localDataDir();
      settingsPath = await join(
        localAppData,
        "Roblox",
        "GlobalBasicSettings_13.xml",
      );
    } else if (currentPlatform === "linux") {
      const home = await homeDir();
      settingsPath = await join(
        home,
        ".var",
        "app",
        "org.vinegarhq.Sober",
        "data",
        "sober",
        "appData",
        "GlobalBasicSettings_13.xml",
      );
    } else if (currentPlatform === "macos") {
      const home = await homeDir();
      settingsPath = await join(
        home,
        "Library",
        "Roblox",
        "GlobalBasicSettings_13.xml",
      );
    }

    if (!settingsPath || !(await exists(settingsPath))) {
      return;
    }

    let content = await readTextFile(settingsPath);
    const targetValue = unlocked ? "9999" : "60";
    const regex = /<int name="FramerateCap">(\d+)<\/int>/;

    if (regex.test(content)) {
      content = content.replace(
        regex,
        `<int name="FramerateCap">${targetValue}</int>`,
      );
    } else {
      const endTag = "</Settings>";
      if (content.includes(endTag)) {
        content = content.replace(
          endTag,
          `\t<int name="FramerateCap">${targetValue}</int>\r\n${endTag}`,
        );
      }
    }

    await writeTextFile(settingsPath, content);
  } catch (e) {
    console.error("Error setting FPS cap:", e);
  }
}

if (fpsUnlockToggle) {
  const isEnabled = configManager.get("unlockedFramerate");
  fpsUnlockToggle.checked = isEnabled;
  setFpsCap(isEnabled);

  fpsUnlockToggle.addEventListener("change", (e) => {
    const checked = (e.target as HTMLInputElement).checked;
    configManager.set("unlockedFramerate", checked);
    setFpsCap(checked);
  });
}

// Sober Settings Logic
if (currentPlatform === "linux") {
  const soberSection = document.getElementById("sober-section");
  if (soberSection) soberSection.style.display = "block";

  const soberKeys: (keyof SoberSettings)[] = [
    "allow_gamepad_permission",
    "bring_back_oof",
    "close_on_leave",
    "discord_rpc_enabled",
    "discord_rpc_show_join_button",
    "enable_gamemode",
    "enable_hidpi",
    "server_location_indicator_enabled",
    "use_console_experience",
    "use_libsecret",
    "use_opengl",
  ];

  const currentSober = configManager.get("sober");

  soberKeys.forEach((key) => {
    const el = document.getElementById(`sober-${key}`) as HTMLInputElement;
    if (el) {
      el.checked = currentSober[key];
      el.addEventListener("change", (e) => {
        const settings = configManager.get("sober");
        // @ts-ignore
        settings[key] = (e.target as HTMLInputElement).checked;
        configManager.set("sober", settings);
      });
    }
  });

  const touchMode = document.getElementById(
    "sober-touch_mode",
  ) as HTMLSelectElement;
  if (touchMode) {
    touchMode.value = currentSober.touch_mode;
    touchMode.addEventListener("change", () => {
      const settings = configManager.get("sober");
      settings.touch_mode = touchMode.value;
      configManager.set("sober", settings);
    });
  }

  const graphicsMode = document.getElementById(
    "sober-graphics_optimization_mode",
  ) as HTMLSelectElement;
  if (graphicsMode) {
    graphicsMode.value = currentSober.graphics_optimization_mode;
    graphicsMode.addEventListener("change", () => {
      const settings = configManager.get("sober");
      settings.graphics_optimization_mode = graphicsMode.value;
      configManager.set("sober", settings);
    });
  }
}

// Files section logic
document
  .getElementById("btn-open-install-folder")
  ?.addEventListener("click", async () => {
    try {
      const dir = await appLocalDataDir();
      await openPath(dir);
    } catch (e) {
      console.error("Failed to open install folder", e);
    }
  });

document
  .getElementById("btn-clear-cache")
  ?.addEventListener("click", async () => {
    try {
      const temp = await tempDir();
      const robloxTemp = await join(temp, "Roblox");
      if (await exists(robloxTemp)) {
        await remove(robloxTemp, { recursive: true });
        alert("Roblox cache (Temp/Roblox) cleared successfully.");
      } else {
        alert("No Roblox cache found in Temp folder.");
      }
    } catch (e) {
      console.error("Failed to clear cache", e);
      alert("Failed to clear cache. Check console for details.");
    }
  });

function showNotification(message: string) {
  const container = document.getElementById("notification-container");
  if (!container) return;

  const notification = document.createElement("div");
  notification.className = "notification";
  notification.innerText = message;

  container.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 3000);
}

// Fast Flags Logic
const currentFastFlags = configManager.get("fastFlags");
const ffKeys = Object.keys(currentFastFlags) as (keyof FastFlags)[];

ffKeys.forEach((key) => {
  const element = document.getElementById(`ff-${key}`);
  if (!element) return;

  const value = currentFastFlags[key];

  if (typeof value === "boolean") {
    const checkbox = element as HTMLInputElement;
    checkbox.checked = value;
    checkbox.addEventListener("change", (e) => {
      const flags = configManager.get("fastFlags");
      // @ts-ignore
      flags[key] = (e.target as HTMLInputElement).checked;
      configManager.set("fastFlags", flags);
    });
  } else if (typeof value === "number") {
    const input = element as HTMLInputElement;
    input.value = value.toString();
    input.addEventListener("input", (e) => {
      const val = parseInt((e.target as HTMLInputElement).value);
      if (!isNaN(val)) {
        const flags = configManager.get("fastFlags");
        // @ts-ignore
        flags[key] = val;
        configManager.set("fastFlags", flags);
      }
    });
  }
});

async function saveFastFlagsToDisk() {
  const flags = configManager.get("fastFlags");
  const processedFlags: Record<string, string> = {};

  for (const [key, value] of Object.entries(flags)) {
    if (typeof value === "boolean") {
      processedFlags[key] = value ? "True" : "False";
    } else {
      processedFlags[key] = String(value);
    }
  }

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
    config.fflags = processedFlags;

    await writeTextFile(configPath, JSON.stringify(config, null, 2));
  } else {
    const appDir = await appLocalDataDir();
    const versionsDir = await join(appDir, "rblx-versions");

    if (!(await exists(versionsDir))) {
      throw new Error(
        "Versions directory not found. Please launch Roblox first.",
      );
    }

    const entries = await readDir(versionsDir);
    let saved = false;

    for (const entry of entries) {
      if (entry.isDirectory) {
        const versionPath = await join(versionsDir, entry.name);

        const clientSettingsDir = await join(versionPath, "ClientSettings");
        if (!(await exists(clientSettingsDir))) {
          await mkdir(clientSettingsDir, { recursive: true });
        }

        const filePath = await join(
          clientSettingsDir,
          "ClientAppSettings.json",
        );
        await writeTextFile(filePath, JSON.stringify(processedFlags, null, 2));
        saved = true;
      }
    }

    if (!saved) {
      throw new Error("No installed Roblox versions found to patch.");
    }
  }
}

async function getLatestRobloxVersion(): Promise<string> {
  const binaryType =
    currentPlatform === "macos" ? "MacPlayer" : "WindowsPlayer";
  const response = await tauriFetch(
    `https://clientsettings.roblox.com/v2/client-version/${binaryType}`,
    {
      method: "GET",
      headers: {
        "User-Agent": "Roblox/WinInet",
      },
    },
  );
  if (!response.ok) throw new Error("Failed to fetch version info");
  const data = (await response.json()) as any;
  return data.clientVersionUpload;
}

// Footer Buttons
document.getElementById("btn-save")?.addEventListener("click", async () => {
  configManager.saveConfig();
  try {
    await saveFastFlagsToDisk();
    await applySkyboxToDisk();
    showNotification("Settings saved successfully!");
  } catch (e) {
    console.error("Failed to save ClientAppSettings.json", e);
    showNotification("Error saving settings: " + e);
  }
});

document.getElementById("btn-launch")?.addEventListener("click", async () => {
  configManager.saveConfig();
  try {
    await saveFastFlagsToDisk();
    await applySkyboxToDisk();

    if (currentPlatform === "linux") {
      showNotification("Launching Sober...");
      const command = Command.create("flatpak", ["run", "org.vinegarhq.Sober"]);
      await command.spawn();
      return;
    }

    const latestVersion = await getLatestRobloxVersion();
    const appDir = await appLocalDataDir();
    const versionsDir = await join(appDir, "rblx-versions");

    // Cleanup old versions
    if (await exists(versionsDir)) {
      const entries = await readDir(versionsDir);
      for (const entry of entries) {
        if (entry.isDirectory && entry.name !== latestVersion) {
          await remove(await join(versionsDir, entry.name), {
            recursive: true,
          });
        }
      }
    }

    // Ensure directory for latest version exists
    const newVersionPath = await join(versionsDir, latestVersion);
    if (!(await exists(newVersionPath))) {
      await mkdir(newVersionPath, { recursive: true });
    }

    // Re-save to ensure files in new dir
    await saveFastFlagsToDisk();
    await applySkyboxToDisk();

    let exePath = "";
    if (currentPlatform === "windows") {
      exePath = await join(newVersionPath, "RobloxPlayerBeta.exe");
    } else {
      exePath = await join(
        newVersionPath,
        "RobloxPlayer.app",
        "Contents",
        "MacOS",
        "RobloxPlayer",
      );
    }

    if (!(await exists(exePath))) {
      showNotification("Downloading Roblox...");
      const zipUrl =
        currentPlatform === "macos"
          ? `https://setup.rbxcdn.com/mac/${latestVersion}-RobloxPlayer.zip`
          : `https://setup.rbxcdn.com/${latestVersion}-RobloxApp.zip`;
      const response = await tauriFetch(zipUrl);
      if (!response.ok) {
        throw new Error(`Failed to download Roblox: ${response.statusText}`);
      }
      const buffer = await response.arrayBuffer();
      const data = new Uint8Array(buffer);

      showNotification("Extracting Roblox...");
      await new Promise<void>((resolve, reject) => {
        unzip(data, (err, unzipped) => {
          if (err) return reject(err);
          (async () => {
            try {
              for (const [relativePath, content] of Object.entries(unzipped)) {
                const filePath = await join(newVersionPath, relativePath);
                if (relativePath.endsWith("/")) {
                  await mkdir(filePath, { recursive: true });
                } else {
                  const parts = relativePath.split("/");
                  if (parts.length > 1) {
                    const dirPath = await join(
                      newVersionPath,
                      parts.slice(0, -1).join("/"),
                    );
                    await mkdir(dirPath, { recursive: true });
                  }
                  await writeFile(filePath, content);
                }
              }
              resolve();
            } catch (e) {
              reject(e);
            }
          })();
        });
      });
    }

    showNotification("Launching Roblox...");
    let command;
    if (currentPlatform === "windows") {
      command = Command.create("cmd", ["/C", "start", "", exePath]);
    } else {
      const appBundle = await join(newVersionPath, "RobloxPlayer.app");
      command = Command.create("open", ["-a", appBundle]);
    }
    await command.spawn();
  } catch (e) {
    console.error("Failed to save/launch", e);
    showNotification("Error saving settings: " + e);
  }
});

// Fast Flag Editor Logic
const ffEditorModal = document.getElementById("ff-editor-modal");
const ffJsonEditor = document.getElementById(
  "ff-json-editor",
) as HTMLTextAreaElement;

function closeFfEditor() {
  if (ffEditorModal) {
    ffEditorModal.style.display = "none";
  }
}

document.getElementById("btn-open-ff-editor")?.addEventListener("click", () => {
  if (ffEditorModal && ffJsonEditor) {
    const flags = configManager.get("fastFlags");
    ffJsonEditor.value = JSON.stringify(flags, null, 2);
    ffEditorModal.style.display = "flex";
  }
});

document
  .getElementById("btn-close-ff-editor")
  ?.addEventListener("click", closeFfEditor);
document
  .getElementById("ff-editor-overlay")
  ?.addEventListener("click", closeFfEditor);

document.getElementById("btn-save-ff-editor")?.addEventListener("click", () => {
  try {
    const newFlags = JSON.parse(ffJsonEditor.value);
    if (typeof newFlags !== "object" || newFlags === null) {
      throw new Error("Config must be an object");
    }

    configManager.set("fastFlags", newFlags);

    // Refresh UI inputs
    const keys = Object.keys(newFlags) as (keyof FastFlags)[];
    keys.forEach((key) => {
      const element = document.getElementById(`ff-${key}`);
      if (!element) return;

      const val = newFlags[key];
      if (typeof val === "boolean") {
        (element as HTMLInputElement).checked = val;
      } else {
        (element as HTMLInputElement).value = String(val);
      }
    });

    closeFfEditor();
    showNotification("Fast Flags configuration updated.");
  } catch (e) {
    alert("Invalid JSON: " + e);
  }
});

// Skybox Manager Logic
const skyboxTextures = import.meta.glob("/src/assets/SkyboxPack/*/*.tex", {
  query: "?url",
  import: "default",
  eager: true,
});

// Restore saved skybox selection
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
}

setupCustomDropdowns();

// Prevent scroll wheel from changing number input values
document.addEventListener("wheel", () => {
  if (
    document.activeElement instanceof HTMLInputElement &&
    document.activeElement.type === "number"
  ) {
    document.activeElement.blur();
  }
});

async function applySkyboxToDisk() {
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
            const key = `/src/assets/SkyboxPack/${selected}/${filename}`;
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
