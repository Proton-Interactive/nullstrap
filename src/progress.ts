import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";

const appWindow = getCurrentWindow();

invoke("apply_square_corners");

interface ProgressPayload {
  title?: string;
  status?: string;
  percent?: number;
}

document.addEventListener("DOMContentLoaded", () => {
  listen<ProgressPayload>("progress-update", (event) => {
    const { title, status, percent } = event.payload;

    const titleEl = document.getElementById("progress-title");
    const statusEl = document.getElementById("progress-status");
    const barEl = document.getElementById("progress-bar");

    if (titleEl && title) titleEl.innerText = title;
    if (statusEl && status) statusEl.innerText = status;
    if (barEl && percent !== undefined) {
      barEl.style.width = `${percent}%`;
    }
  });

  listen("progress-close", () => {
    appWindow.close();
  });

  document
    .getElementById("minimize")
    ?.addEventListener("click", () => appWindow.minimize());

  document
    .getElementById("close")
    ?.addEventListener("click", () => appWindow.close());
});
