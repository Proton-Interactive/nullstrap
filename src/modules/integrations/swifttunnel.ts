import { openPath } from "@tauri-apps/plugin-opener";
import { tempDir, join } from "@tauri-apps/api/path";
import { writeTextFile, writeFile } from "@tauri-apps/plugin-fs";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { Command } from "@tauri-apps/plugin-shell";
import { platform } from "@tauri-apps/plugin-os";
import { ConfigManager } from "../../config";
import { showNotification } from "../ui";
import {
  start,
  setActivity,
  clearActivity,
  destroy,
  stopMonitoring,
} from "../discordRpc";

const currentPlatform = platform();
const configManager = ConfigManager.getInstance();

let vpnCheckInterval: number | null = null;

async function checkVpnStatus(silent = false) {
  const statusText = document.getElementById("st-vpn-status-text");
  const statusIndicator = document.getElementById("st-vpn-status-indicator");
  if (!statusText || !statusIndicator) return;

  if (currentPlatform !== "windows") {
    statusText.innerText = "N/A";
    statusText.style.color = "#888";
    statusIndicator.style.backgroundColor = "#444";
    statusIndicator.style.boxShadow = "none";
    return;
  }

  if (!silent) {
    statusText.innerText = "CHECKING...";
    statusText.style.color = "#aaa";
    statusIndicator.style.backgroundColor = "#aaa";
    statusIndicator.style.boxShadow = "none";
  }

  try {
    const command = Command.create("cmd", [
      "/C",
      "powershell",
      "-NoProfile",
      "-Command",
      "if (Get-NetAdapter | Where-Object { $_.InterfaceDescription -like '*WireGuard*' -and $_.Status -eq 'Up' }) { Write-Host 'ONLINE' } else { Write-Host 'OFFLINE' }",
    ]);

    const output = await command.execute();
    const stdout = output.stdout.trim();

    if (stdout.includes("ONLINE")) {
      statusText.innerText = "ONLINE";
      statusText.style.color = "#55ff55";
      statusIndicator.style.backgroundColor = "#55ff55";
      statusIndicator.style.boxShadow = "0 0 8px #55ff55";
    } else {
      statusText.innerText = "OFFLINE";
      statusText.style.color = "#ff5555";
      statusIndicator.style.backgroundColor = "#ff5555";
      statusIndicator.style.boxShadow = "0 0 5px #ff5555";
    }
  } catch (e) {
    console.error("VPN check error:", e);
    statusText.innerText = "ERROR";
    statusText.style.color = "#ff5555";
  }
}

function updateVpnLoop(enabled: boolean) {
  if (enabled) {
    if (!vpnCheckInterval) {
      checkVpnStatus(true);
      vpnCheckInterval = window.setInterval(() => checkVpnStatus(true), 5000);
    }
  } else {
    if (vpnCheckInterval) {
      window.clearInterval(vpnCheckInterval);
      vpnCheckInterval = null;
    }
  }
}

export function setupSwiftTunnelUI() {
  // Sign Up Button
  document.getElementById("btn-st-signup")?.addEventListener("click", () => {
    openPath("https://swifttunnel.net/signup");
  });

  // Ping Test Button
  document
    .getElementById("btn-st-ping")
    ?.addEventListener("click", async () => {
      if (currentPlatform !== "windows") {
        showNotification("Ping test is currently Windows only.");
        return;
      }

      try {
        const temp = await tempDir();
        const batPath = await join(temp, "swifttunnel-ping-test.bat");

        // Embedded PowerShell script for ping testing
        const batContent = `@echo off
:: SwiftTunnel Ping Test Launcher
:: This runs the PowerShell ping test script

:: Check if PowerShell script exists in same folder
if exist "%~dp0swifttunnel-ping-test.ps1" (
    powershell -ExecutionPolicy Bypass -File "%~dp0swifttunnel-ping-test.ps1"
    exit /b
)

:: If no PS1 file, run embedded PowerShell (parallel ping, 5x each, take minimum)
powershell -ExecutionPolicy Bypass -Command ^
"$servers = @(^
    @{Name='Singapore'; IP='54.255.205.216'; Region='sg'},^
    @{Name='Singapore 02'; IP='51.79.128.67'; Region='sg'},^
    @{Name='Singapore 03'; IP='45.32.115.254'; Region='sg'},^
    @{Name='Singapore 04'; IP='136.110.4.82'; Region='sg'},^
    @{Name='Mumbai'; IP='3.111.230.152'; Region='mumbai'},^
    @{Name='Mumbai 02'; IP='148.113.44.43'; Region='mumbai'},^
    @{Name='Mumbai 03'; IP='65.20.84.67'; Region='mumbai'},^
    @{Name='Mumbai 04'; IP='35.200.146.148'; Region='mumbai'},^
    @{Name='Tokyo'; IP='52.193.224.66'; Region='tokyo'},^
    @{Name='Tokyo 02'; IP='45.32.253.124'; Region='tokyo'},^
    @{Name='Sydney'; IP='54.153.235.165'; Region='sydney'},^
    @{Name='Sydney 02'; IP='35.189.22.159'; Region='sydney'},^
    @{Name='Sydney 03'; IP='139.180.166.16'; Region='sydney'},^
    @{Name='Germany 01'; IP='63.181.160.158'; Region='eu'},^
    @{Name='Germany 02'; IP='34.185.130.207'; Region='eu'},^
    @{Name='Germany 03'; IP='95.179.254.160'; Region='eu'},^
    @{Name='Paris 02'; IP='34.155.132.129'; Region='eu'},^
    @{Name='America 01'; IP='54.225.245.114'; Region='us'},^
    @{Name='America 02'; IP='34.73.186.185'; Region='us'},^
    @{Name='Brazil'; IP='34.39.249.193'; Region='brazil'},^
    @{Name='Middle East'; IP='34.18.83.201'; Region='me'}^
);^
$bestPings = @{}; $bestNames = @{};^
Clear-Host;^
Write-Host '';^
Write-Host '  ==========================================================' -ForegroundColor Green;^
Write-Host '   SwiftTunnel VPN - Server Ping Test' -ForegroundColor Green;^
Write-Host '   Find the best server for your Roblox region' -ForegroundColor Green;^
Write-Host '  ==========================================================' -ForegroundColor Green;^
Write-Host '';^
Write-Host '  Testing all 21 servers in parallel (5 pings each)...';^
Write-Host '  This will take about 10 seconds.';^
Write-Host '';^
$jobs = @();^
foreach ($s in $servers) {^
    $jobs += Start-Job -ScriptBlock {^
        param($n, $i, $r)^
        try {^
            $p = Test-Connection -ComputerName $i -Count 5 -ErrorAction Stop;^
            $m = ($p ^| Measure-Object -Property ResponseTime -Minimum).Minimum;^
            return @{Name=$n; IP=$i; Region=$r; Ms=[int]$m; OK=$true}^
        } catch {^
            return @{Name=$n; IP=$i; Region=$r; Ms=0; OK=$false}^
        }^
    } -ArgumentList $s.Name, $s.IP, $s.Region^
};^
$results = $jobs ^| Wait-Job ^| Receive-Job;^
$jobs ^| Remove-Job;^
Write-Host '  ----------------------------------------------------------';^
Write-Host '   SERVER              IP                  BEST PING';^
Write-Host '  ----------------------------------------------------------';^
foreach ($s in $servers) {^
    $r = $results ^| Where-Object { $_.IP -eq $s.IP };^
    if ($r) {^
        $np = $r.Name.PadRight(18); $ip = $r.IP.PadRight(20);^
        if ($r.OK) {^
            Write-Host ('   ' + $np + ' ' + $ip + ' ') -NoNewline;^
            Write-Host ($r.Ms.ToString() + ' ms') -ForegroundColor Green;^
            if (-not $bestPings.ContainsKey($r.Region) -or $r.Ms -lt $bestPings[$r.Region]) {^
                $bestPings[$r.Region] = $r.Ms; $bestNames[$r.Region] = $r.Name^
            }^
        } else {^
            Write-Host ('   ' + $np + ' ' + $ip + ' ') -NoNewline;^
            Write-Host 'TIMEOUT' -ForegroundColor Red^
        }^
    }^
};^
Write-Host '  ----------------------------------------------------------';^
Write-Host '';^
Write-Host '  ==========================================================' -ForegroundColor Cyan;^
Write-Host '   ROBLOX REGION RECOMMENDATIONS' -ForegroundColor Cyan;^
Write-Host '  ==========================================================' -ForegroundColor Cyan;^
Write-Host '';^
Write-Host '  ----------------------------------------------------------';^
Write-Host '   IF PLAYING ON...         USE THIS VPN          YOUR PING';^
Write-Host '  ----------------------------------------------------------';^
$rm = @{sg='Singapore Roblox';tokyo='Japan Roblox';mumbai='India Roblox';sydney='Australia Roblox';eu='Europe Roblox';us='US East Roblox';brazil='Brazil Roblox';me='Middle East Roblox'};^
foreach ($r in @('sg','tokyo','mumbai','sydney','eu','us','brazil','me')) {^
    $label = $rm[$r].PadRight(24);^
    if ($bestPings.ContainsKey($r)) {^
        Write-Host ('   ' + $label + ' ' + $bestNames[$r].PadRight(22) + ' ') -NoNewline;^
        Write-Host ($bestPings[$r].ToString() + ' ms') -ForegroundColor Green^
    } else {^
        Write-Host ('   ' + $label + ' [No response]           ---') -ForegroundColor Red^
    }^
};^
Write-Host '  ----------------------------------------------------------';^
Write-Host '';^
Write-Host '  ==========================================================' -ForegroundColor Yellow;^
Write-Host '   PING QUALITY: 0-50ms=Excellent, 50-100ms=Good, 100-150ms=OK' -ForegroundColor Yellow;^
Write-Host '  ==========================================================' -ForegroundColor Yellow;^
Write-Host '';^
Read-Host '  Press Enter to exit'"`;

        await writeTextFile(batPath, batContent);
        await openPath(batPath);
      } catch (e) {
        console.error(e);
        showNotification("Error running ping test: " + e);
      }
    });

  // Install WireGuard Button
  document
    .getElementById("btn-st-install")
    ?.addEventListener("click", async () => {
      if (currentPlatform !== "windows") {
        showNotification("WireGuard installer is for Windows only.");
        return;
      }

      const proceed = window.confirm(
        "This will download and install WireGuard on your system. Do you want to proceed?",
      );
      if (!proceed) return;

      showNotification("Downloading WireGuard installer...");
      try {
        const url =
          "https://download.wireguard.com/windows-client/wireguard-installer.exe";
        const temp = await tempDir();
        const installerPath = await join(temp, "wireguard-installer.exe");

        const response = await tauriFetch(url);
        if (!response.ok)
          throw new Error("Download failed with status " + response.status);

        const buffer = await response.arrayBuffer();
        await writeFile(installerPath, new Uint8Array(buffer));

        showNotification("Download complete. Launching installer...");
        await openPath(installerPath);
      } catch (e) {
        console.error(e);
        showNotification("Installation failed: " + e);
      }
    });

  // Check Status Button
  document
    .getElementById("btn-check-vpn-status")
    ?.addEventListener("click", () => checkVpnStatus(false));

  // Discord RPC Logic
  let isDrpcActive = false;
  const discordRpcToggle = document.getElementById(
    "discord-rpc-toggle",
  ) as HTMLInputElement;

  if (discordRpcToggle) {
    const isEnabled = configManager.get("discordRpcEnabled");
    discordRpcToggle.checked = isEnabled;
    if (isEnabled) {
      const clientId = configManager.get("discordRpcClientId");
      if (clientId) {
        start(clientId)
          .then(() => {
            setActivity(
              configManager.get("rpcDetails"),
              configManager.get("rpcState"),
            );
            isDrpcActive = true;
          })
          .catch(console.error);
      }
    }

    discordRpcToggle.addEventListener("change", (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      configManager.set("discordRpcEnabled", checked);
      if (checked) {
        const clientId = configManager.get("discordRpcClientId");
        if (clientId) {
          start(clientId)
            .then(() => {
              setActivity(
                configManager.get("rpcDetails"),
                configManager.get("rpcState"),
              );
              isDrpcActive = true;
            })
            .catch(console.error);
        }
      } else {
        if (isDrpcActive) {
          clearActivity()
            .then(() => destroy())
            .then(() => stopMonitoring())
            .then(() => {
              isDrpcActive = false;
            })
            .catch(console.error);
        }
      }
    });
  }

  // Toggle & Loop Logic
  const stToggle = document.getElementById(
    "st-enabled-toggle",
  ) as HTMLInputElement;
  const stContent = document.getElementById("st-content") as HTMLElement;

  if (stToggle && stContent) {
    const isEnabled = configManager.get("swiftTunnelEnabled");
    stToggle.checked = isEnabled;
    stContent.style.display = isEnabled ? "block" : "none";
    updateVpnLoop(isEnabled);

    stToggle.addEventListener("change", (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      configManager.set("swiftTunnelEnabled", checked);
      stContent.style.display = checked ? "block" : "none";
      updateVpnLoop(checked);
    });
  }
}
