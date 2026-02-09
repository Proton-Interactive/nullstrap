import { appLocalDataDir, join } from "@tauri-apps/api/path";
import {
  exists,
  mkdir,
  readDir,
  remove,
  writeFile,
} from "@tauri-apps/plugin-fs";
import { Command } from "@tauri-apps/plugin-shell";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { platform } from "@tauri-apps/plugin-os";
import { openPath } from "@tauri-apps/plugin-opener";

import { unzip } from "fflate";
import { ConfigManager } from "../../config";
import { showNotification } from "../ui";
import { saveFastFlagsToDisk } from "./fastflags";
import { applySkyboxToDisk } from "./skybox";
import { setActivity } from "../discordRpc";

const currentPlatform = platform();
const configManager = ConfigManager.getInstance();

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

// setup launcher ui
export function setupLauncherUI() {
  console.log("[Launcher] Setting up launcher UI");
  document.getElementById("btn-save")?.addEventListener("click", async () => {
    configManager.saveConfig();
    try {
      await saveFastFlagsToDisk();
      await applySkyboxToDisk();
      if (configManager.get("showNotifications"))
        showNotification("settings saved successfully!");
    } catch (e) {
      console.error("failed to save ClientAppSettings.json", e);
      if (configManager.get("showNotifications"))
        showNotification("error saving settings: " + e);
    }
  });

  document.getElementById("btn-launch")?.addEventListener("click", async () => {
    configManager.saveConfig();
    try {
      await saveFastFlagsToDisk();
      await applySkyboxToDisk();

      const showNotifications = configManager.get("showNotifications");

      if (currentPlatform === "linux") {
        if (showNotifications) showNotification("Launching Sober...");
        if (configManager.get("discordRpcEnabled")) {
          setActivity("Launching Roblox", "Preparing to play");
        }
        const command = Command.create("flatpak", [
          "run",
          "org.vinegarhq.Sober",
        ]);
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
        const autoUpdate = configManager.get("autoUpdate");
        if (!autoUpdate) {
          throw new Error(
            "Auto-download is disabled. Please enable it in settings to download Roblox.",
          );
        }
        if (showNotifications) showNotification("downloading roblox...");
        const zipUrl =
          currentPlatform === "macos"
            ? `https://setup.rbxcdn.com/mac/${latestVersion}-RobloxPlayer.zip`
            : `https://setup.rbxcdn.com/${latestVersion}-RobloxApp.zip`;
        const response = await tauriFetch(zipUrl);
        if (!response.ok) {
          throw new Error(`failed to download roblox: ${response.statusText}`);
        }
        const buffer = await response.arrayBuffer();
        const uint8Array = new Uint8Array(buffer);

        if (showNotifications) showNotification("extracting roblox...");
        await new Promise<void>((resolve, reject) => {
          unzip(uint8Array, (err, unzipped) => {
            if (err) return reject(err);
            (async () => {
              try {
                for (const [relativePath, content] of Object.entries(
                  unzipped,
                )) {
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

        if (currentPlatform !== "windows") {
          if (showNotifications) showNotification("setting permissions...");
          const chmod = Command.create("chmod", ["+x", exePath]);
          await chmod.execute();
        }
      }

      if (showNotifications) showNotification("launching roblox...");
      if (currentPlatform === "windows") {
        const cpuLimit = configManager.get("cpuCoreLimit");
        if (cpuLimit > 0) {
          const mask = (1 << cpuLimit) - 1;
          const command = Command.create("cmd", [
            "/C",
            "start",
            "/affinity",
            mask.toString(16),
            exePath,
          ]);
          await command.spawn();
        } else {
          await openPath(exePath);
        }
      } else {
        const appBundle = await join(newVersionPath, "RobloxPlayer.app");
        const command = Command.create("open", ["-a", appBundle]);
        await command.spawn();
      }

      // const closeOnLaunch = configManager.get("closeOnLaunch");
      // const minimizeOnLaunch = configManager.get("minimizeOnLaunch");
      // if (closeOnLaunch) {
      //   await currentWindow.close();
      // } else if (minimizeOnLaunch) {
      //   await currentWindow.minimize();
      // }
    } catch (e) {
      console.error("failed to save/launch", e);
      if (configManager.get("showNotifications"))
        showNotification("error saving settings: " + e);
    }
  });

  // open install folder button
  document
    .getElementById("btn-open-install-folder")
    ?.addEventListener("click", async () => {
      try {
        const appDir = await appLocalDataDir();
        console.log(`opening install folder at: ${appDir}`);

        if (!(await exists(appDir))) {
          console.log("directory missing, creating...");
          await mkdir(appDir, { recursive: true });
        }

        const command = Command.create("open", [appDir]);
        if (currentPlatform === "windows") {
          await Command.create("cmd", ["/C", "start", "", appDir]).spawn();
        } else {
          await command.spawn();
        }
      } catch (e) {
        console.error("failed to open install folder:", e);
      }
    });

  // clear cache button
  document
    .getElementById("btn-clear-cache")
    ?.addEventListener("click", async () => {
      // logic for clearing cache can be moved here or imported
    });
}
