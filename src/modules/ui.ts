import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { ConfigManager } from "../config";

const appWindow = getCurrentWindow();
const configManager = ConfigManager.getInstance();

export function showNotification(message: string) {
  const container = document.getElementById("notification-container");
  if (!container) return;

  const notification = document.createElement("div");
  notification.className = "notification";
  notification.innerText = message;

  container.appendChild(notification);

  // remove after animation (3s total: 0.3s in + 2.4s wait + 0.3s out)
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 3000);
}

export async function initializeUI() {
  // restore window size
  const savedWidth = configManager.get("windowWidth");
  const savedHeight = configManager.get("windowHeight");
  if (configManager.get("rememberWindowSize") && savedWidth && savedHeight) {
    appWindow.setSize(new LogicalSize(savedWidth, savedHeight));
  }

  // save window size on resize
  let resizeTimeout: number;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = window.setTimeout(async () => {
      if (configManager.get("rememberWindowSize")) {
        if (await appWindow.isMaximized()) return;
        configManager.set("windowWidth", window.innerWidth);
        configManager.set("windowHeight", window.innerHeight);
      }
    }, 500);
  });

  // apply square corners
  invoke("apply_square_corners");

  // animate entry
  if (configManager.get("openingAnimationEnabled")) {
    document.body.classList.add("animate-entry");
  } else {
    document.body.style.opacity = "1";
  }

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
        .forEach(
          (content) => ((content as HTMLElement).style.display = "none"),
        );

      const tabId = button.getAttribute("data-tab");
      const tabContent = document.getElementById(`tab-${tabId}`);
      if (tabContent) {
        tabContent.style.display = "block";
        configManager.set("lastTab", tabId || "general");
      }
    });
  });

  // restore last tab
  const lastTab = configManager.get("lastTab");
  if (lastTab) {
    const tabToActivate = document.querySelector(
      `.tab-btn[data-tab="${lastTab}"]`,
    ) as HTMLElement;
    if (tabToActivate) {
      tabToActivate.click();
    } else {
      // default to general if last tab not found
      (
        document.querySelector('.tab-btn[data-tab="general"]') as HTMLElement
      )?.click();
    }
  } else {
    (
      document.querySelector('.tab-btn[data-tab="general"]') as HTMLElement
    )?.click();
  }
}
