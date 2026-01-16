import { localDataDir, join, homeDir, tempDir } from "@tauri-apps/api/path";
import {
  exists,
  readTextFile,
  writeTextFile,
  remove,
} from "@tauri-apps/plugin-fs";
import { platform } from "@tauri-apps/plugin-os";
import { ConfigManager, SoberSettings } from "../config";
import { Snowfall } from "../snowfall";
import { showNotification } from "./ui";
const currentPlatform = platform();
const configManager = ConfigManager.getInstance();

async function setFpsCap(unlocked: boolean) {
  try {
    const filenames = [
      "GlobalBasicSettings_13.xml",
      "GlobalBasicSettings_13_Studio.xml",
    ];

    for (const filename of filenames) {
      let settingsPath = "";

      if (currentPlatform === "windows") {
        const localAppData = await localDataDir();
        settingsPath = await join(localAppData, "Roblox", filename);
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
          filename,
        );
      } else if (currentPlatform === "macos") {
        const home = await homeDir();
        settingsPath = await join(home, "Library", "Roblox", filename);
      }

      if (!settingsPath || !(await exists(settingsPath))) {
        continue;
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
    }
  } catch (e) {
    console.error("Error setting FPS cap:", e);
  }
}

export function setupSettingsUI() {
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

  if (currentPlatform === "macos") {
    const desc = document.getElementById("fps-unlock-desc");
    if (desc) {
      desc.textContent += " ( Might not work on some MacBooks with vSync )";
    }
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

    if (
      currentSober.discord_rpc_enabled &&
      configManager.get("discordRpcEnabled")
    ) {
      configManager.set("discordRpcEnabled", false);
      showNotification(
        "Built-in Discord RPC disabled to prevent conflicts with Sober RPC.",
      );
    }

    soberKeys.forEach((key) => {
      const el = document.getElementById(`sober-${key}`) as HTMLInputElement;
      if (el) {
        el.checked = currentSober[key] as boolean;
        el.addEventListener("change", (e) => {
          const isChecked = (e.target as HTMLInputElement).checked;
          const settings = configManager.get("sober");
          // @ts-ignore
          settings[key] = isChecked;
          configManager.set("sober", settings);

          if (key === "discord_rpc_enabled" && isChecked) {
            const builtInRpcToggle = document.getElementById(
              "discord-rpc-toggle",
            ) as HTMLInputElement;

            if (configManager.get("discordRpcEnabled")) {
              configManager.set("discordRpcEnabled", false);
              if (builtInRpcToggle) {
                builtInRpcToggle.checked = false;
                builtInRpcToggle.dispatchEvent(new Event("change"));
              }
              showNotification(
                "Built-in Discord RPC disabled to prevent conflicts with Sober RPC.",
              );
            }
          }
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

  // Files section logic (Clear Cache)
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

  // Bootstrapper Settings Logic
  const closeOnLaunchToggle = document.getElementById(
    "close-on-launch-toggle",
  ) as HTMLInputElement;

  if (closeOnLaunchToggle) {
    const isEnabled = configManager.get("closeOnLaunch");
    closeOnLaunchToggle.checked = isEnabled;

    closeOnLaunchToggle.addEventListener("change", (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      configManager.set("closeOnLaunch", checked);
    });
  }

  const minimizeOnLaunchToggle = document.getElementById(
    "minimize-on-launch-toggle",
  ) as HTMLInputElement;

  if (minimizeOnLaunchToggle) {
    const isEnabled = configManager.get("minimizeOnLaunch");
    minimizeOnLaunchToggle.checked = isEnabled;

    minimizeOnLaunchToggle.addEventListener("change", (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      configManager.set("minimizeOnLaunch", checked);
    });
  }

  const rememberWindowSizeToggle = document.getElementById(
    "remember-window-size-toggle",
  ) as HTMLInputElement;

  if (rememberWindowSizeToggle) {
    const isEnabled = configManager.get("rememberWindowSize");
    rememberWindowSizeToggle.checked = isEnabled;

    rememberWindowSizeToggle.addEventListener("change", (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      configManager.set("rememberWindowSize", checked);
    });
  }

  const autoUpdateToggle = document.getElementById(
    "auto-update-toggle",
  ) as HTMLInputElement;

  if (autoUpdateToggle) {
    const isEnabled = configManager.get("autoUpdate");
    autoUpdateToggle.checked = isEnabled;

    autoUpdateToggle.addEventListener("change", (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      configManager.set("autoUpdate", checked);
    });
  }

  const showNotificationsToggle = document.getElementById(
    "show-notifications-toggle",
  ) as HTMLInputElement;

  if (showNotificationsToggle) {
    const isEnabled = configManager.get("showNotifications");
    showNotificationsToggle.checked = isEnabled;

    showNotificationsToggle.addEventListener("change", (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      configManager.set("showNotifications", checked);
    });
  }
}
