import { getCurrentWindow } from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import {
  mkdir,
  writeFile,
  exists,
  BaseDirectory,
  writeTextFile,
  readDir,
  readFile,
} from "@tauri-apps/plugin-fs";
import { fetch } from "@tauri-apps/plugin-http";
import { unzipSync } from "fflate";
import { platform } from "@tauri-apps/plugin-os";
import { Command } from "@tauri-apps/plugin-shell";
import { appLocalDataDir, join } from "@tauri-apps/api/path";
import { ConfigManager } from "./config";

const appWindow = getCurrentWindow();
const configManager = ConfigManager.getInstance();

// logging setup
(async () => {
  try {
    const appDir = await appLocalDataDir();
    const logsDir = await join(appDir, "logs");

    if (!(await exists(logsDir))) {
      await mkdir(logsDir, { recursive: true });
    }

    const date = new Date();
    const timestamp = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}_${String(date.getHours()).padStart(2, "0")}-${String(date.getMinutes()).padStart(2, "0")}-${String(date.getSeconds()).padStart(2, "0")}`;
    const filename = `splash-log-${timestamp}.txt`;
    const logPath = await join(logsDir, filename);

    // Initial log file creation
    await writeTextFile(
      logPath,
      `Splash Log started: ${new Date().toISOString()}\n`,
    );

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
        await invoke("log_to_console", { message: line });
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

    console.log(`Splash logging initialized to ${logPath}`);
  } catch (e) {
    console.error("Failed to initialize splash logging:", e);
  }
})();

// apply square corners
invoke("apply_square_corners");

// animate entry
window.addEventListener("DOMContentLoaded", () => {
  if (configManager.get("openingAnimationEnabled")) {
    document.querySelector(".container")?.classList.add("animate-entry");
  } else {
    const container = document.querySelector(".container") as HTMLElement;
    if (container) {
      container.style.opacity = "1";
    }
  }
});

// close the pre-existing hidden main window to ensure a fresh animation on launch
WebviewWindow.getByLabel("main").then((w) => w?.close());

// set version info
getVersion().then((version) => {
  const appNameEl = document.getElementById("app-name");
  if (appNameEl) appNameEl.innerText = "nullstrap";

  const appVersionEl = document.getElementById("app-version");
  if (appVersionEl) appVersionEl.innerText = `Version ${version}`;

  const titleHeader = document.getElementById("title-header");
  if (titleHeader) {
    titleHeader.innerText = `nullstrap | v${version}`;
  }
});

// basic window controls
document
  .getElementById("minimize")
  ?.addEventListener("click", () => appWindow.minimize());
document
  .getElementById("close")
  ?.addEventListener("click", () => appWindow.close());

async function launchMainApp() {
  try {
    let mainWindow = null;
    try {
      mainWindow = await WebviewWindow.getByLabel("main");
    } catch (e) {
      console.warn("Error finding main window:", e);
    }

    if (mainWindow) {
      try {
        await mainWindow.show();
        await mainWindow.setFocus();
        return;
      } catch (e) {
        console.warn("Could not show existing window, creating new one:", e);
      }
    }

    const configManager = ConfigManager.getInstance();
    const width = configManager.get("windowWidth");
    const height = configManager.get("windowHeight");

    const newWindow = new WebviewWindow("main", {
      url: "index.html",
      decorations: false,
      transparent: true,
      title: "nullstrap",
      width,
      height,
      visible: true,
    });

    newWindow.once("tauri://created", () => {
      newWindow.setFocus();
    });

    newWindow.once("tauri://error", (e) => {
      console.error("Error creating new window:", e);
    });
  } catch (error) {
    console.error("Failed to switch to main window:", error);
  }
}

async function getLatestRobloxVersionHash(
  binaryTypeOverride?: string,
): Promise<string | null> {
  try {
    const binaryType =
      binaryTypeOverride ||
      (platform() === "macos" ? "MacPlayer" : "WindowsPlayer");
    const response = await fetch(
      `https://clientsettings.roblox.com/v2/client-version/${binaryType}/channel/LIVE`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": "YourTauriRobloxDownloader/1.0",
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }

    const data = (await response.json()) as any;

    // extract the hash – this is what rdd needs
    const hash = data?.clientVersionUpload;
    if (typeof hash === "string" && hash.startsWith("version-")) {
      return hash; // e.g. "version-89d89cb2d6b649be"
    }

    throw new Error("clientVersionUpload not found or invalid");
  } catch (err) {
    console.error("Error getting latest Roblox hash:", err);
    return null; // Handle fallback or show error to user
  }
}

async function getProgressWindow() {
  let w = await WebviewWindow.getByLabel("progress");
  if (!w) {
    w = new WebviewWindow("progress", {
      url: "progress.html",
      width: 400,
      height: 150,
      decorations: false,
      center: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      transparent: true,
      title: "",
    });
  }
  return w;
}

async function updateProgress(title: string, status: string, percent: number) {
  await getProgressWindow();
  await emit("progress-update", { title, status, percent });
}

async function hideProgress() {
  await emit("progress-close");
}

async function launchSober() {
  await updateProgress("Checking", "Checking for Flatpak...", 0);
  try {
    const flatpakCheck = await Command.create("flatpak", ["--version"]);
    const output = await flatpakCheck.execute();
    if (output.code !== 0) throw new Error("Flatpak check failed");
  } catch (e) {
    await updateProgress("Error", "Flatpak is not installed.", 0);
    setTimeout(hideProgress, 3000);
    return;
  }

  await updateProgress("Checking", "Checking Sober...", 20);
  try {
    const infoCmd = await Command.create("flatpak", [
      "info",
      "org.vinegarhq.Sober",
    ]);
    const infoOut = await infoCmd.execute();

    if (infoOut.code !== 0) {
      await updateProgress(
        "Installing",
        "Installing Sober (this may take a while)...",
        30,
      );
      const installCmd = await Command.create("flatpak", [
        "install",
        "-y",
        "flathub",
        "org.vinegarhq.Sober",
      ]);
      const installOut = await installCmd.execute();
      if (installOut.code !== 0) {
        throw new Error(`Install failed with code ${installOut.code}`);
      }
    }
  } catch (e) {
    console.error(e);
    await updateProgress("Error", "Failed to install Sober.", 0);
    setTimeout(hideProgress, 3000);
    return;
  }

  await updateProgress("Launching", "Starting Sober...", 100);
  const runCmd = await Command.create("flatpak", [
    "run",
    "org.vinegarhq.Sober",
  ]);
  await runCmd.spawn();
  setTimeout(hideProgress, 2000);
}

// launch roblox
async function launchVinegar() {
  try {
    const flatpakCheck = Command.create("flatpak", ["--version"]);
    const output = await flatpakCheck.execute();
    if (output.code !== 0) {
      alert("Flatpak is not installed. Please install Flatpak and try again.");
      return;
    }

    const infoCmd = Command.create("flatpak", [
      "info",
      "org.vinegarhq.Vinegar",
    ]);
    const infoOut = await infoCmd.execute();

    if (infoOut.code !== 0) {
      const installConfirm = confirm(
        "Vinegar (Roblox Studio for Linux) is not installed. Would you like to install it via Flatpak?",
      );
      if (installConfirm) {
        await updateProgress("Installing", "Installing Vinegar...", 50);
        const installCmd = Command.create("flatpak", [
          "install",
          "flathub",
          "org.vinegarhq.Vinegar",
          "-y",
        ]);
        const installOut = await installCmd.execute();
        if (installOut.code !== 0) {
          throw new Error("Failed to install Vinegar");
        }
      } else {
        return;
      }
    }

    await updateProgress("Launching", "Starting Vinegar...", 100);
    const runCmd = Command.create("flatpak", ["run", "org.vinegarhq.Vinegar"]);
    runCmd.spawn();
    setTimeout(hideProgress, 1000);
  } catch (e) {
    console.error("Failed to launch Vinegar:", e);
    alert("Failed to launch Vinegar: " + e);
    hideProgress();
  }
}

async function launchRoblox() {
  if (platform() === "linux") {
    const flatpakCheck = Command.create("flatpak", ["--version"]);
    const output = await flatpakCheck.execute();
    if (output.code !== 0) {
      alert("Flatpak is not installed. Please install Flatpak and try again.");
      return;
    }
    return launchSober();
  }

  if (platform() !== "windows" && platform() !== "macos") {
    alert(
      "This feature is currently only available on Windows, macOS, and Linux.",
    );
    return;
  }

  await updateProgress(
    "Checking Version",
    "Fetching latest Roblox version...",
    0,
  );
  const hash = await getLatestRobloxVersionHash();

  if (!hash) {
    // ui feedback: "couldn't fetch latest version – check internet?"
    console.error("Could not get version hash");
    await updateProgress("Error", "Could not get version hash", 0);
    setTimeout(hideProgress, 3000);
    return;
  }

  const versionDir = `rblx-versions/${hash}`;
  let executableRelPath = `${versionDir}/RobloxPlayerBeta.exe`;

  if (platform() === "macos") {
    executableRelPath = `${versionDir}/RobloxPlayer.app`;
  }

  // check if already installed
  const isInstalled = await exists(executableRelPath, {
    baseDir: BaseDirectory.AppLocalData,
  });

  if (isInstalled) {
    console.log("Version already installed, launching...");
    await updateProgress("Launching", "Starting Roblox...", 100);
    await launchExecutable(hash);
    return;
  }

  console.log(`Starting download for ${hash}...`);
  await updateProgress("Downloading", `Starting download for ${hash}...`, 0);

  // ensure version directory exists
  await mkdir(versionDir, {
    baseDir: BaseDirectory.AppLocalData,
    recursive: true,
  });

  let filesToDownload: Record<string, string> = {};

  if (platform() === "macos") {
    filesToDownload = {
      "RobloxPlayer.zip": "",
    };
  } else {
    filesToDownload = {
      "RobloxApp.zip": "",
      "shaders.zip": "shaders/",
      "ssl.zip": "ssl/",
      "WebView2.zip": "",
      "WebView2RuntimeInstaller.zip": "WebView2RuntimeInstaller/",
      "content-avatar.zip": "content/avatar/",
      "content-configs.zip": "content/configs/",
      "content-fonts.zip": "content/fonts/",
      "content-sky.zip": "content/sky/",
      "content-sounds.zip": "content/sounds/",
      "content-textures2.zip": "content/textures/",
      "content-models.zip": "content/models/",
      "content-platform-fonts.zip": "PlatformContent/pc/fonts/",
      "content-platform-dictionaries.zip":
        "PlatformContent/pc/shared_compression_dictionaries/",
      "content-terrain.zip": "PlatformContent/pc/terrain/",
      "content-textures3.zip": "PlatformContent/pc/textures/",
      "extracontent-luapackages.zip": "ExtraContent/LuaPackages/",
      "extracontent-translations.zip": "ExtraContent/translations/",
      "extracontent-models.zip": "ExtraContent/models/",
      "extracontent-textures.zip": "ExtraContent/textures/",
      "extracontent-places.zip": "ExtraContent/places/",
    };
  }

  const totalFiles = Object.keys(filesToDownload).length;
  let processedFiles = 0;

  for (const [filename, extractPath] of Object.entries(filesToDownload)) {
    let url = `https://setup.rbxcdn.com/${hash}-${filename}`;
    if (platform() === "macos") {
      url = `https://setup.rbxcdn.com/mac/${hash}-${filename}`;
    }

    console.log(`Downloading ${filename}...`);

    const percent = Math.floor((processedFiles / totalFiles) * 100);
    await updateProgress("Downloading", `Downloading ${filename}...`, percent);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`Failed to download ${filename}: ${response.status}`);

        // fail fast if core zip fails
        if (
          filename === "RobloxApp.zip" ||
          (platform() === "macos" && filename === "RobloxPlayer.zip")
        ) {
          await updateProgress(
            "Error",
            `Critical download failed: ${filename}`,
            0,
          );
          throw new Error(`critical file ${filename} failed to download`);
        }

        // increment anyway to continue for non-critical files
        processedFiles++;
        continue;
      }

      const arrayBuffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // unzip
      await updateProgress("Installing", `Extracting ${filename}...`, percent);
      const unzipped = unzipSync(uint8Array);

      for (const [rawFilename, fileData] of Object.entries(unzipped)) {
        const innerFilename = rawFilename.replace(/\\/g, "/");

        if (!innerFilename || innerFilename === ".") continue;

        // Ignore dotfiles
        if (innerFilename.split("/").pop()?.startsWith(".")) continue;

        const finalPath = extractPath
          ? `${extractPath}${innerFilename}`
          : innerFilename;

        try {
          if (finalPath.endsWith("/")) {
            await mkdir(`${versionDir}/${finalPath}`, {
              baseDir: BaseDirectory.AppLocalData,
              recursive: true,
            });
            continue;
          }

          const destination = `${versionDir}/${finalPath}`;

          // ensure parent exists
          const lastSlash = destination.lastIndexOf("/");
          if (lastSlash !== -1) {
            const parent = destination.substring(0, lastSlash);
            await mkdir(parent, {
              baseDir: BaseDirectory.AppLocalData,
              recursive: true,
            });
          }

          await writeFile(destination, fileData, {
            baseDir: BaseDirectory.AppLocalData,
          });
        } catch (innerErr) {
          console.warn(`Failed to extract ${innerFilename}:`, innerErr);
        }
      }
    } catch (e) {
      console.error(`Error processing ${filename}:`, e);
    }
    processedFiles++;
  }

  console.log("Download and extraction complete.");
  await updateProgress("Launching", "Starting Roblox...", 100);
  await launchExecutable(hash);
}

async function launchExecutable(
  hash: string,
  options: {
    execName?: string;
    appName?: string;
    dllName?: string;
    args?: string[];
  } = {},
) {
  const {
    execName = "RobloxPlayerBeta.exe",
    appName = "RobloxPlayer.app",
    dllName = "RobloxPlayerBeta.dll",
    args = ["--app"],
  } = options;

  try {
    const appLocalData = await appLocalDataDir();
    const versionDir = await join(appLocalData, "rblx-versions", hash);

    let command: Command<string>;

    if (platform() === "macos") {
      const appPath = await join(versionDir, appName);
      const binaryName = appName.replace(".app", "");
      const binaryPath = await join(appPath, "Contents", "MacOS", binaryName);

      console.log("Setting permissions for:", appPath);
      const chmod = Command.create("chmod", ["-R", "755", appPath]);
      await chmod.execute();

      if (!(await exists(binaryPath))) {
        throw new Error(`Executable not found at ${binaryPath}`);
      }

      console.log("Removing quarantine attribute for:", appPath);
      const xattr = Command.create("xattr", [
        "-d",
        "-r",
        "com.apple.quarantine",
        appPath,
      ]);
      try {
        await xattr.execute();
      } catch (e) {
        console.warn("Failed to remove quarantine attribute:", e);
      }

      console.log("Launching app at:", appPath);
      // open -a "path/to/RobloxPlayer.app" --args --app
      command = Command.create("open", ["-a", appPath, "--args", "--app"]);
    } else {
      const exePath = await join(versionDir, execName);

      console.log("Launching executable at:", exePath);
      console.log("Working directory:", versionDir);

      // ensure appsettings.xml exists
      // this file is required for the portable executable to find its content folder
      const relativeAppSettingsPath = `rblx-versions/${hash}/AppSettings.xml`;
      if (
        !(await exists(relativeAppSettingsPath, {
          baseDir: BaseDirectory.AppLocalData,
        }))
      ) {
        console.log("Creating AppSettings.xml...");
        const appSettingsContent = `<?xml version="1.0" encoding="UTF-8"?>
<Settings>
	<ContentFolder>content</ContentFolder>
	<BaseUrl>http://www.roblox.com</BaseUrl>
</Settings>`;
        await writeFile(
          relativeAppSettingsPath,
          new TextEncoder().encode(appSettingsContent),
          {
            baseDir: BaseDirectory.AppLocalData,
          },
        );
      }

      // validate critical files
      const relativeVersionDir = `rblx-versions/${hash}`;
      const criticalFiles = [execName, dllName, "WebView2Loader.dll"];
      const missingFiles = [];

      for (const file of criticalFiles) {
        if (
          !(await exists(`${relativeVersionDir}/${file}`, {
            baseDir: BaseDirectory.AppLocalData,
          }))
        ) {
          missingFiles.push(file);
        }
      }

      if (missingFiles.length > 0) {
        console.error("Missing critical files:", missingFiles);
        await updateProgress(
          "Error",
          `Missing files: ${missingFiles.join(", ")}`,
          100,
        );
        return;
      }

      // added --app argument to ensure it launches the gui
      command = Command.create("cmd", ["/C", "start", "", execName, ...args], {
        cwd: versionDir,
      });
    }

    command.on("close", (data: any) => {
      console.log(
        `command finished with code ${data.code} and signal ${data.signal}`,
      );
    });
    command.on("error", (error: any) =>
      console.error(`command error: "${error}"`),
    );
    command.stdout.on("data", (line: any) =>
      console.log(`command stdout: "${line}"`),
    );
    command.stderr.on("data", (line: any) =>
      console.log(`command stderr: "${line}"`),
    );

    await command.spawn();
    // close progress
    setTimeout(hideProgress, 2000);
  } catch (e) {
    console.error("Failed to launch:", e);
    await updateProgress("Error", "Failed to launch Roblox", 100);
    setTimeout(hideProgress, 3000);
  }
}

// launch studio
async function launchStudio() {
  if (platform() === "linux") {
    return launchVinegar();
  }

  if (platform() !== "windows" && platform() !== "macos") {
    alert("Studio is currently only available on Windows, macOS, and Linux.");
    return;
  }

  await updateProgress(
    "Checking Version",
    "Fetching latest Roblox Studio version...",
    0,
  );

  const binaryType = platform() === "macos" ? "MacStudio" : "WindowsStudio64";
  const hash = await getLatestRobloxVersionHash(binaryType);

  if (!hash) {
    console.error("Could not get version hash");
    await updateProgress("Error", "Could not get version hash", 0);
    setTimeout(hideProgress, 3000);
    return;
  }

  const versionDir = `rblx-versions/${hash}`;
  let executableRelPath = `${versionDir}/RobloxStudioBeta.exe`;

  if (platform() === "macos") {
    executableRelPath = `${versionDir}/RobloxStudio.app`;
  }

  // check if already installed
  const isInstalled = await exists(executableRelPath, {
    baseDir: BaseDirectory.AppLocalData,
  });

  if (isInstalled) {
    console.log("Version already installed, launching...");
    await updateProgress("Launching", "Starting Roblox Studio...", 100);
    await launchExecutable(hash, {
      execName: "RobloxStudioBeta.exe",
      appName: "RobloxStudio.app",
      dllName: "RobloxStudioBeta.exe",
      args: [],
    });
    return;
  }

  console.log(`Starting download for ${hash}...`);
  await updateProgress("Downloading", `Starting download for ${hash}...`, 0);

  // ensure version directory exists
  await mkdir(versionDir, {
    baseDir: BaseDirectory.AppLocalData,
    recursive: true,
  });

  let filesToDownload: Record<string, string> = {};

  if (platform() === "macos") {
    filesToDownload = {
      "RobloxStudio.zip": "",
    };
  } else {
    filesToDownload = {
      "RobloxStudio.zip": "",
      "Libraries.zip": "",
      "redist.zip": "",
      "shaders.zip": "shaders/",
      "ssl.zip": "ssl/",
      "WebView2.zip": "",
      "WebView2RuntimeInstaller.zip": "WebView2RuntimeInstaller/",
      "content-avatar.zip": "content/avatar/",
      "content-configs.zip": "content/configs/",
      "content-fonts.zip": "content/fonts/",
      "content-sky.zip": "content/sky/",
      "content-sounds.zip": "content/sounds/",
      "content-textures2.zip": "content/textures/",
      "content-models.zip": "content/models/",
      "content-platform-fonts.zip": "PlatformContent/pc/fonts/",
      "content-platform-dictionaries.zip":
        "PlatformContent/pc/shared_compression_dictionaries/",
      "content-terrain.zip": "PlatformContent/pc/terrain/",
      "content-textures3.zip": "PlatformContent/pc/textures/",
      "extracontent-luapackages.zip": "ExtraContent/LuaPackages/",
      "extracontent-translations.zip": "ExtraContent/translations/",
      "extracontent-models.zip": "ExtraContent/models/",
      "extracontent-textures.zip": "ExtraContent/textures/",
      "BuiltInPlugins.zip": "BuiltInPlugins/",
      "Plugins.zip": "Plugins/",
      "StudioFonts.zip": "StudioFonts/",
    };
  }

  const totalFiles = Object.keys(filesToDownload).length;
  let processedFiles = 0;

  for (const [filename, extractPath] of Object.entries(filesToDownload)) {
    let url = `https://setup.rbxcdn.com/${hash}-${filename}`;
    if (platform() === "macos") {
      url = `https://setup.rbxcdn.com/mac/${hash}-${filename}`;
    }

    console.log(`Downloading ${filename}...`);

    const percent = Math.floor((processedFiles / totalFiles) * 100);
    await updateProgress("Downloading", `Downloading ${filename}...`, percent);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`Failed to download ${filename}: ${response.status}`);

        if (
          filename === "RobloxStudio.zip" ||
          (platform() === "macos" && filename === "RobloxStudio.zip")
        ) {
          await updateProgress(
            "Error",
            `Critical download failed: ${filename}`,
            0,
          );
          throw new Error(`critical file ${filename} failed to download`);
        }
        processedFiles++;
        continue;
      }

      const arrayBuffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      await updateProgress("Installing", `Extracting ${filename}...`, percent);
      const unzipped = unzipSync(uint8Array);

      for (const [rawFilename, fileData] of Object.entries(unzipped)) {
        const innerFilename = rawFilename.replace(/\\/g, "/");
        if (!innerFilename || innerFilename === ".") continue;
        if (innerFilename.split("/").pop()?.startsWith(".")) continue;

        const finalPath = extractPath
          ? `${extractPath}${innerFilename}`
          : innerFilename;

        try {
          if (finalPath.endsWith("/")) {
            await mkdir(`${versionDir}/${finalPath}`, {
              baseDir: BaseDirectory.AppLocalData,
              recursive: true,
            });
            continue;
          }

          const destination = `${versionDir}/${finalPath}`;
          const lastSlash = destination.lastIndexOf("/");
          if (lastSlash !== -1) {
            const parent = destination.substring(0, lastSlash);
            await mkdir(parent, {
              baseDir: BaseDirectory.AppLocalData,
              recursive: true,
            });
          }

          await writeFile(destination, fileData, {
            baseDir: BaseDirectory.AppLocalData,
          });
        } catch (innerErr) {
          console.warn(`Failed to extract ${innerFilename}:`, innerErr);
        }
      }
    } catch (e) {
      console.error(`Error processing ${filename}:`, e);
    }
    processedFiles++;
  }

  // Flatten DLLs for Windows Studio to ensure Qt/Plugins are found
  if (platform() === "windows") {
    try {
      console.log("Checking for nested DLLs...");
      const entries = await readDir(versionDir, {
        baseDir: BaseDirectory.AppLocalData,
      });

      for (const entry of entries) {
        if (entry.isDirectory) {
          const subDir = `${versionDir}/${entry.name}`;
          const subEntries = await readDir(subDir, {
            baseDir: BaseDirectory.AppLocalData,
          });

          for (const subEntry of subEntries) {
            if (subEntry.name.endsWith(".dll")) {
              console.log(`Moving ${subEntry.name} from ${entry.name} to root`);
              // Read content
              const oldPath = `${subDir}/${subEntry.name}`;
              const newPath = `${versionDir}/${subEntry.name}`;

              // We use rename/copy if available, but fs plugin might need read/write
              // Since we are using standard fs commands via capabilities, let's try rename if available or read/write
              // The `fs` plugin doesn't have `rename` exposed in the imports I see.
              // I'll use read/write as it's safe.
              const content = await readFile(oldPath, {
                baseDir: BaseDirectory.AppLocalData,
              });
              await writeFile(newPath, content, {
                baseDir: BaseDirectory.AppLocalData,
              });
              // Optional: remove old file
              // await remove(oldPath, { baseDir: BaseDirectory.AppLocalData });
            }
          }
        }
      }
    } catch (e) {
      console.warn("Failed to flatten DLLs:", e);
    }
  }

  console.log("Download and extraction complete.");
  await updateProgress("Launching", "Starting Roblox Studio...", 100);
  await launchExecutable(hash, {
    execName: "RobloxStudioBeta.exe",
    appName: "RobloxStudio.app",
    dllName: "RobloxStudioBeta.exe",
    args: [],
  });
}

// launch button logic
document.getElementById("launch-btn")?.addEventListener("click", launchRoblox);

// settings button logic
document
  .getElementById("settings-btn")
  ?.addEventListener("click", launchMainApp);

// studio button logic
document.getElementById("studio-btn")?.addEventListener("click", launchStudio);

// create folders
(async () => {
  try {
    await mkdir("rblx-versions/", {
      baseDir: BaseDirectory.AppLocalData,
      recursive: true,
    });

    await mkdir("scripts/", {
      baseDir: BaseDirectory.AppLocalData,
      recursive: true,
    });

    await mkdir("logs/", {
      baseDir: BaseDirectory.AppLocalData,
      recursive: true,
    });
  } catch (e) {
    console.error("Failed to create directories:", e);
  }
})();
