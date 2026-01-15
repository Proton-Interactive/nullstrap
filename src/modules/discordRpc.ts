import { invoke } from "@tauri-apps/api/core";

let monitoringInterval: number | null = null;

export async function start(clientId: string) {
  try {
    await invoke("plugin:drpc|spawn_thread", { id: clientId });
    console.log("[discord rpc] successfully started with client id:", clientId);
  } catch (error) {
    console.error("[discord rpc] failed to start:", error);
  }
}

export async function startMonitoring() {
  if (monitoringInterval) return;
  console.log("[discord rpc] starting monitoring for roblox process");
  monitoringInterval = setInterval(async () => {
    try {
      const isRunning = await invoke("is_roblox_running");
      if (isRunning) {
        await setActivity("Playing Roblox", "Using nullstrap");
      }
    } catch (error) {
      console.error("[discord rpc] error during monitoring:", error);
    }
  }, 5000);
}

export async function stopMonitoring() {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
    console.log("[discord rpc] stopped monitoring");
  }
}

export async function setActivity(details: string, state: string) {
  try {
    const activity = {
      details,
      state,
      timestamps: { start: Date.now() },
      assets: {
        large_image: "nullstrap_icon",
        large_text: "nullstrap",
        small_image: "roblox_icon",
        small_text: "Roblox",
      },
      buttons: [
        { label: "Download nullstrap", url: "https://github.com/Proton-Interactive/nullstrap" },
      ],
    };
    await invoke("plugin:drpc|set_activity", {
      activityJson: JSON.stringify(activity),
    });
    console.log(
      "[discord rpc] activity set successfully - details:",
      details,
      "state:",
      state,
    );
  } catch (error) {
    console.error("[discord rpc] failed to set activity:", error);
  }
}

export async function clearActivity() {
  try {
    await invoke("plugin:drpc|clear_activity");
    console.log("[discord rpc] activity cleared successfully");
  } catch (error) {
    console.error("[discord rpc] failed to clear activity:", error);
  }
}

export async function destroy() {
  try {
    await invoke("plugin:drpc|destroy_thread");
    console.log("[discord rpc] destroyed successfully");
  } catch (error) {
    console.error("[discord rpc] failed to destroy:", error);
  }
}
