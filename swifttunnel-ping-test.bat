@echo off
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
Read-Host '  Press Enter to exit'"
