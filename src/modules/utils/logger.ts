import { invoke } from "@tauri-apps/api/core";
import { appLocalDataDir, join } from "@tauri-apps/api/path";
import { exists, mkdir, writeTextFile } from "@tauri-apps/plugin-fs";

export async function initializeLogging() {
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

    console.log(`Logging initialized to ${logPath}`);
  } catch (e) {
    console.error("Failed to initialize logging:", e);
  }
}
