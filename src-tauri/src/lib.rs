#[cfg(target_os = "linux")]
use dirs;
use reqwest;
use std::fs;
use std::io::Cursor;
use std::path::PathBuf;
use std::process::Command;
use std::time::{Duration, SystemTime};
use sysinfo::System;
use tauri::{Emitter, Manager, WindowEvent};
use zip::ZipArchive;

#[derive(Clone, serde::Serialize)]
struct ProgressPayload {
    status: String,
    percent: u64,
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn open_main_window(app: tauri::AppHandle) {
    println!("open_main_window: invoked from JS");
    if let Some(win) = app.get_webview_window("main") {
        println!("open_main_window: found existing 'main' window");

        if win.is_minimized().unwrap_or(false) {
            let _ = win.unminimize();
            println!("open_main_window: unminimized the window");
        }
        let _ = win.show();
        let _ = win.set_focus();
        println!("open_main_window: attempted to show and focus existing window");
        return;
    }
    println!("open_main_window: 'main' window not found - attempting to create a new one");

    match tauri::WebviewWindowBuilder::new(
        &app,
        "main",
        tauri::WebviewUrl::App("index.html".into()),
    )
    .inner_size(800.0, 600.0)
    .title("nullstrap")
    .decorations(false)
    .shadow(true)
    .build()
    {
        Ok(win) => {
            let win_clone: tauri::WebviewWindow = win.clone();
            win.on_window_event(move |event| {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = win_clone.hide();
                }
            });
            let _ = win.show();
            let _ = win.set_focus();
            println!("open_main_window: successfully created 'main' window");
        }
        Err(err) => {
            eprintln!(
                "open_main_window: failed to create 'main' window: {:?}",
                err
            );
            if let Some(win) = app.get_webview_window("splashscreen") {
                let _ = win.show();
                let _ = win.set_focus();
            } else {
                eprintln!("open_main_window: no 'splashscreen' window available to fall back to");
            }
        }
    }
}

#[tauri::command]
fn apply_square_corners(_window: tauri::WebviewWindow) {
    #[cfg(target_os = "windows")]
    {
        use raw_window_handle::{HasWindowHandle, RawWindowHandle};
        use windows::Win32::Foundation::HWND;
        use windows::Win32::Graphics::Dwm::{
            DwmSetWindowAttribute, DWMWA_WINDOW_CORNER_PREFERENCE, DWMWCP_DONOTROUND,
            DWM_WINDOW_CORNER_PREFERENCE,
        };

        if let Ok(handle) = _window.window_handle() {
            if let RawWindowHandle::Win32(handle) = handle.as_raw() {
                let hwnd = handle.hwnd.get();
                unsafe {
                    let _ = DwmSetWindowAttribute(
                        HWND(hwnd as _),
                        DWMWA_WINDOW_CORNER_PREFERENCE,
                        &DWMWCP_DONOTROUND as *const _ as *const _,
                        std::mem::size_of::<DWM_WINDOW_CORNER_PREFERENCE>() as u32,
                    );
                }
            }
        }
    }
}

#[tauri::command]
#[allow(unused_variables)]
fn apply_skybox_texture(
    app: tauri::AppHandle,
    filename: String,
    data: Vec<u8>,
) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        let mut potential_paths = Vec::new();
        if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            potential_paths.push(
                PathBuf::from(local_app_data)
                    .join("Roblox")
                    .join("Versions"),
            );
        }
        if let Ok(program_files_x86) = std::env::var("ProgramFiles(x86)") {
            potential_paths.push(
                PathBuf::from(program_files_x86)
                    .join("Roblox")
                    .join("Versions"),
            );
        }
        if let Ok(data_dir) = app.path().app_local_data_dir() {
            potential_paths.push(data_dir.join("rblx-versions"));
        }

        let mut target_dirs = Vec::new();
        for versions_path in potential_paths {
            if !versions_path.exists() {
                continue;
            }
            if let Ok(entries) = fs::read_dir(versions_path) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_dir() {
                        let is_player = path.join("RobloxPlayerBeta.exe").exists();
                        let is_studio = path.join("RobloxStudioBeta.exe").exists();

                        if is_player || is_studio {
                            let sky_dir = path
                                .join("PlatformContent")
                                .join("pc")
                                .join("textures")
                                .join("sky");
                            if !sky_dir.exists() {
                                let _ = fs::create_dir_all(&sky_dir);
                            }
                            if sky_dir.exists() {
                                target_dirs.push(sky_dir);
                            }
                        }
                    }
                }
            }
        }

        if target_dirs.is_empty() {
            return Ok("No Roblox installations found to apply textures to.".to_string());
        }

        let mut count = 0;
        for target_dir in target_dirs {
            let dest_path = target_dir.join(&filename);
            if let Ok(_) = fs::write(dest_path, &data) {
                count += 1;
            }
        }

        Ok(format!("Applied {} to {} locations", filename, count))
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("Skybox changer is only implemented for Windows currently.".to_string())
    }
}

#[tauri::command]
fn save_fast_flags(
    app: tauri::AppHandle,
    flags_json: String,
    mode: &str,
) -> Result<String, String> {
    save_fast_flags_internal(&app, flags_json, mode)
}

fn save_fast_flags_internal(
    app: &tauri::AppHandle,
    flags_json: String,
    mode: &str,
) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        let mut potential_paths = Vec::new();

        if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            potential_paths.push(
                PathBuf::from(local_app_data)
                    .join("Roblox")
                    .join("Versions"),
            );
        }
        if let Ok(program_files_x86) = std::env::var("ProgramFiles(x86)") {
            potential_paths.push(
                PathBuf::from(program_files_x86)
                    .join("Roblox")
                    .join("Versions"),
            );
        }
        if let Ok(program_files) = std::env::var("ProgramFiles") {
            potential_paths.push(PathBuf::from(program_files).join("Roblox").join("Versions"));
        }

        if let Ok(data_dir) = app.path().app_local_data_dir() {
            potential_paths.push(data_dir.join("rblx-versions"));
        }

        let mut saved_any = false;
        let mut searched_locations = Vec::new();

        for versions_path in potential_paths {
            searched_locations.push(versions_path.to_string_lossy().to_string());
            if !versions_path.exists() {
                continue;
            }

            if let Ok(entries) = fs::read_dir(&versions_path) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_dir() {
                        let is_player = path.join("RobloxPlayerBeta.exe").exists();
                        let is_studio = path.join("RobloxStudioBeta.exe").exists();

                        let should_save = match mode {
                            "studio" => is_studio,
                            _ => is_player,
                        };

                        if should_save {
                            let client_settings_dir = path.join("ClientSettings");
                            if !client_settings_dir.exists() {
                                if let Err(_) = fs::create_dir(&client_settings_dir) {
                                    continue;
                                }
                            }

                            let file_path = client_settings_dir.join("ClientAppSettings.json");
                            if let Ok(_) = fs::write(file_path, &flags_json) {
                                saved_any = true;
                            }
                        }
                    }
                }
            }
        }

        if saved_any {
            Ok(format!(
                "Successfully saved Fast Flags to {} installation.",
                if mode == "studio" {
                    "Roblox Studio"
                } else {
                    "Roblox Player"
                }
            ))
        } else {
            Ok(format!(
                "No {} installation found to patch.",
                if mode == "studio" {
                    "Roblox Studio"
                } else {
                    "Roblox Player"
                }
            ))
        }
    }

    #[cfg(target_os = "macos")]
    {
        let mut potential_paths = Vec::new();
        potential_paths.push(PathBuf::from("/Applications/Roblox.app"));

        if let Ok(data_dir) = app.path().app_local_data_dir() {
            potential_paths.push(data_dir.join("rblx-versions"));
        }

        let mut saved_any = false;

        for versions_path in potential_paths {
            if mode == "studio" {
                continue;
            }

            if versions_path.to_string_lossy().contains("rblx-versions") {
                if let Ok(entries) = fs::read_dir(&versions_path) {
                    for entry in entries.flatten() {
                        let path = entry.path();
                        if path.is_dir() {
                            let app_path = path.join("RobloxPlayer.app");
                            if app_path.exists() {
                                let settings_dir = app_path.join("Contents/ClientSettings");
                                if !settings_dir.exists() {
                                    let _ = fs::create_dir_all(&settings_dir);
                                }
                                let file_path = settings_dir.join("ClientAppSettings.json");
                                if let Ok(_) = fs::write(file_path, &flags_json) {
                                    saved_any = true;
                                }
                            }
                        }
                    }
                }
            } else {
                let settings_dir = versions_path.join("Contents/ClientSettings");
                if versions_path.exists() {
                    if !settings_dir.exists() {
                        let _ = fs::create_dir_all(&settings_dir);
                    }
                    let file_path = settings_dir.join("ClientAppSettings.json");
                    if let Ok(_) = fs::write(file_path, &flags_json) {
                        saved_any = true;
                    }
                }
            }
        }

        if saved_any {
            Ok("Saved Fast Flags".to_string())
        } else {
            Err("Could not find Roblox installation".to_string())
        }
    }

    #[cfg(target_os = "linux")]
    {
        use std::io::Write;

        let home = dirs::home_dir().ok_or("Could not find home directory")?;

        if mode == "studio" {
            let config_path =
                home.join(".var/app/org.vinegarhq.Vinegar/config/vinegar/config.toml");
            if !config_path.exists() {
                return Err("Vinegar config not found".to_string());
            }

            let content = fs::read_to_string(&config_path).map_err(|e| e.to_string())?;
            let mut value: toml::Value = toml::from_str(&content).map_err(|e| e.to_string())?;

            let new_flags: std::collections::HashMap<String, serde_json::Value> =
                serde_json::from_str(&flags_json).map_err(|e| e.to_string())?;

            let mut overrides_table = toml::map::Map::new();
            for (k, v) in new_flags {
                if let Some(b) = v.as_bool() {
                    overrides_table.insert(k, toml::Value::Boolean(b));
                } else if let Some(n) = v.as_i64() {
                    overrides_table.insert(k, toml::Value::Integer(n));
                } else if let Some(f) = v.as_f64() {
                    overrides_table.insert(k, toml::Value::Float(f));
                } else if let Some(s) = v.as_str() {
                    overrides_table.insert(k, toml::Value::String(s.to_string()));
                }
            }

            if let Some(table) = value.as_table_mut() {
                table.insert("fflags".to_string(), toml::Value::Table(overrides_table));
            } else {
                return Err("Invalid vinegar config structure".to_string());
            }

            let new_toml = toml::to_string(&value).map_err(|e| e.to_string())?;
            fs::write(&config_path, new_toml).map_err(|e| e.to_string())?;

            Ok("Saved to Vinegar config".to_string())
        } else if mode == "sober_main" {
            let config_path = home.join(".var/app/org.vinegarhq.Sober/config/sober/config.json");
            if !config_path.exists() {
                return Err("Sober config not found".to_string());
            }

            let content = fs::read_to_string(&config_path).map_err(|e| e.to_string())?;
            let mut value: serde_json::Value =
                serde_json::from_str(&content).map_err(|e| e.to_string())?;

            let new_settings: serde_json::Value =
                serde_json::from_str(&flags_json).map_err(|e| e.to_string())?;

            if let Some(obj) = value.as_object_mut() {
                if let Some(new_obj) = new_settings.as_object() {
                    for (k, v) in new_obj {
                        obj.insert(k.clone(), v.clone());
                    }
                }
            } else {
                return Err("Invalid Sober config structure".to_string());
            }

            let new_json = serde_json::to_string_pretty(&value).map_err(|e| e.to_string())?;
            fs::write(&config_path, new_json).map_err(|e| e.to_string())?;

            Ok("Saved Sober settings".to_string())
        } else {
            let config_path = home.join(".var/app/org.vinegarhq.Sober/config/sober/config.json");
            if !config_path.exists() {
                return Err("Sober config not found".to_string());
            }

            let content = fs::read_to_string(&config_path).map_err(|e| e.to_string())?;
            let mut value: serde_json::Value =
                serde_json::from_str(&content).map_err(|e| e.to_string())?;

            let new_flags: serde_json::Value =
                serde_json::from_str(&flags_json).map_err(|e| e.to_string())?;

            if let Some(obj) = value.as_object_mut() {
                obj.insert("fflags".to_string(), new_flags);
            } else {
                return Err("Invalid Sober config structure".to_string());
            }

            let new_json = serde_json::to_string_pretty(&value).map_err(|e| e.to_string())?;
            fs::write(&config_path, new_json).map_err(|e| e.to_string())?;

            Ok("Saved to Sober config".to_string())
        }
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        Err("Fast Flag saving is only implemented for Windows, MacOS, and Linux.".to_string())
    }
}

#[tauri::command]
fn is_roblox_running() -> bool {
    let mut system = System::new();
    system.refresh_processes();

    let names = vec![
        "RobloxPlayerBeta.exe",
        "RobloxPlayer",
        "RobloxStudioBeta.exe",
        "RobloxStudio",
        "RobloxPlayerBeta",
        "RobloxStudioBeta",
    ];

    for process in system.processes().values() {
        let name = process.name().to_lowercase();
        for roblox_name in &names {
            if name.contains(&roblox_name.to_lowercase()) {
                return true;
            }
        }
    }
    false
}

#[tauri::command]
fn get_current_place_id() -> Option<String> {
    #[cfg(target_os = "windows")]
    {
        let mut log_dir = dirs::data_local_dir()?;
        log_dir.push("Roblox");
        log_dir.push("logs");

        if !log_dir.exists() {
            return None;
        }

        let mut log_files = Vec::new();
        if let Ok(entries) = fs::read_dir(log_dir) {
            for entry in entries {
                if let Ok(entry) = entry {
                    let path = entry.path();
                    if path.is_file() {
                        if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
                            if file_name.ends_with(".log") {
                                if let Ok(metadata) = entry.metadata() {
                                    log_files.push((
                                        path,
                                        metadata
                                            .modified()
                                            .unwrap_or(std::time::SystemTime::UNIX_EPOCH),
                                    ));
                                }
                            }
                        }
                    }
                }
            }
        }

        log_files.sort_by(|a, b| b.1.cmp(&a.1));

        for (path, _) in log_files {
            if let Ok(content) = fs::read_to_string(&path) {
                for line in content.lines().rev() {
                    if line.contains("Joining game") {
                        let re = regex::Regex::new(r"place (\d+)").ok()?;
                        if let Some(captures) = re.captures(line) {
                            if let Some(place_id) = captures.get(1) {
                                return Some(place_id.as_str().to_string());
                            }
                        }
                    }
                }
            }
        }
        None
    }
    #[cfg(not(target_os = "windows"))]
    {
        None
    }
}

#[tauri::command]
fn get_roblox_game_name() -> String {
    if let Some(place_id) = get_current_place_id() {
        place_id
    } else {
        "Unknown Game".to_string()
    }
}

fn get_latest_version(binary_type: &str) -> Result<String, String> {
    let client = reqwest::blocking::Client::builder()
        .user_agent("Roblox/WinInet")
        .build()
        .map_err(|e| e.to_string())?;

    let url = format!(
        "https://clientsettings.roblox.com/v2/client-version/{}",
        binary_type
    );
    let res = client.get(url).send().map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!(
            "Failed to fetch version info: Status {}",
            res.status()
        ));
    }

    let json: serde_json::Value = res.json().map_err(|e| e.to_string())?;
    json["clientVersionUpload"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Invalid version response".to_string())
}

#[tauri::command]
fn fetch_all_flags(mode: &str) -> Result<serde_json::Value, String> {
    let url = if mode == "studio" {
        "https://raw.githubusercontent.com/MaximumADHD/Roblox-FFlag-Tracker/main/PCStudioApp.json"
    } else {
        "https://raw.githubusercontent.com/MaximumADHD/Roblox-FFlag-Tracker/main/PCClientApp.json"
    };

    let client = reqwest::blocking::Client::new();
    let res = client.get(url).send().map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("Failed to fetch flags: Status {}", res.status()));
    }

    let json: serde_json::Value = res.json().map_err(|e| e.to_string())?;
    Ok(json)
}

fn show_progress_window(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("progress") {
        let _ = win.show();
        let _ = win.set_focus();
    } else {
        let _ = tauri::WebviewWindowBuilder::new(
            app,
            "progress",
            tauri::WebviewUrl::App("progress.html".into()),
        )
        .inner_size(400.0, 150.0)
        .title("Processing...")
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .center()
        .build();
    }
}

#[cfg(target_os = "macos")]
fn apply_macos_fixes(path: &PathBuf) {
    use std::os::unix::fs::PermissionsExt;

    // Remove quarantine attribute recursively and clear all extended attributes
    let _ = Command::new("xattr").args(["-cr"]).arg(path).output();

    // Aggressively set permissions for everything in the app bundle
    let _ = Command::new("chmod")
        .args(["-R", "u+rwx"])
        .arg(path)
        .output();

    // If it's an app bundle, ensure all binaries in Contents/MacOS are executable
    if path.extension().and_then(|s| s.to_str()) == Some("app") {
        let macos_dir = path.join("Contents").join("MacOS");
        if macos_dir.exists() {
            if let Ok(entries) = fs::read_dir(macos_dir) {
                for entry in entries.flatten() {
                    let p = entry.path();
                    if let Ok(metadata) = fs::metadata(&p) {
                        let mut perms = metadata.permissions();
                        perms.set_mode(0o755);
                        let _ = fs::set_permissions(&p, perms);
                    }
                }
            }
        }
    }

    if let Ok(metadata) = fs::metadata(path) {
        let mut perms = metadata.permissions();
        perms.set_mode(0o755);
        let _ = fs::set_permissions(path, perms);
    }
}

fn download_and_install(
    app: &tauri::AppHandle,
    version: &str,
    binary_type: &str,
) -> Result<PathBuf, String> {
    println!("[Downloader] Version: {}, Type: {}", version, binary_type);

    #[cfg(target_os = "macos")]
    if binary_type.contains("Studio") {
        return Err("Studio not supported on macOS".to_string());
    }

    if is_roblox_running() {
        return Err(
            "Roblox or Roblox Studio is currently running. Please close it before updating.".into(),
        );
    }

    let data_dir = app.path().app_local_data_dir().map_err(|e| e.to_string())?;
    let versions_dir = data_dir.join("rblx-versions");
    println!("[Downloader] Target Directory: {}", versions_dir.display());

    if versions_dir.exists() {
        if let Ok(entries) = fs::read_dir(&versions_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    if let Some(dir_name) = path.file_name() {
                        if dir_name != version {
                            let has_player = path.join("RobloxPlayerBeta.exe").exists()
                                || path.join("RobloxPlayer.app").exists();
                            let has_studio = path.join("RobloxStudioBeta.exe").exists()
                                || path.join("RobloxStudio.app").exists();

                            let is_studio = binary_type.contains("Studio");

                            if is_studio {
                                if has_studio || (!has_player && !has_studio) {
                                    let _ = fs::remove_dir_all(&path);
                                }
                            } else {
                                if has_player || (!has_player && !has_studio) {
                                    let _ = fs::remove_dir_all(&path);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    let exe_name = match binary_type {
        "WindowsStudio" | "WindowsStudio64" => "RobloxStudioBeta.exe",
        "WindowsPlayer" => "RobloxPlayerBeta.exe",
        "MacStudio" => "RobloxStudio.app/Contents/MacOS/RobloxStudio",
        "MacPlayer" => "RobloxPlayer.app/Contents/MacOS/RobloxPlayer",
        _ => "RobloxPlayerBeta.exe",
    };
    let version_path = versions_dir.join(version);
    let exe_path = version_path.join(exe_name);

    if exe_path.exists() {
        let settings_path = version_path.join("AppSettings.xml");
        if !settings_path.exists() {
            let settings_content = r#"<?xml version="1.0" encoding="UTF-8"?>
<Settings>
    <ContentFolder>content</ContentFolder>
    <BaseUrl>http://www.roblox.com</BaseUrl>
</Settings>"#;
            let _ = fs::write(settings_path, settings_content);
        }

        let mut final_path = exe_path;
        let path_str = final_path.to_string_lossy().to_string();
        if path_str.starts_with(r"\\?\") {
            final_path = PathBuf::from(&path_str[4..]);
        }

        #[cfg(target_os = "macos")]
        {
            let app_path = final_path
                .parent()
                .unwrap()
                .parent()
                .unwrap()
                .parent()
                .unwrap();
            apply_macos_fixes(&app_path.to_path_buf());
        }

        return Ok(final_path);
    }

    let client = reqwest::blocking::Client::builder()
        .user_agent("Roblox/WinInet")
        .build()
        .map_err(|e| e.to_string())?;

    let _ = app.emit(
        "progress-update",
        ProgressPayload {
            status: "Starting download...".into(),
            percent: 0,
        },
    );

    if !version_path.exists() {
        let _ = fs::create_dir_all(&version_path);
    }

    if binary_type == "MacStudio" {
        let dmg_name = "RobloxStudio.dmg";
        let dmg_url = "https://setup.rbxcdn.com/mac/RobloxStudio.dmg";
        let _ = app.emit(
            "progress-update",
            ProgressPayload {
                status: "Downloading Roblox Studio...".into(),
                percent: 0,
            },
        );
        let resp = client.get(dmg_url).send().map_err(|e| e.to_string())?;
        if !resp.status().is_success() {
            return Err(format!(
                "Failed to download {}: Status {}",
                dmg_name,
                resp.status()
            ));
        }
        let content = resp.bytes().map_err(|e| e.to_string())?;
        let temp_dir = std::env::temp_dir();
        let temp_path = temp_dir.join(dmg_name);
        fs::write(&temp_path, &content).map_err(|e| e.to_string())?;
        let _ = app.emit(
            "progress-update",
            ProgressPayload {
                status: "Mounting disk image...".into(),
                percent: 50,
            },
        );
        let attach_output = Command::new("hdiutil")
            .args(["attach", &temp_path.to_string_lossy()])
            .output()
            .map_err(|e| e.to_string())?;
        if !attach_output.status.success() {
            return Err("Failed to attach dmg".to_string());
        }
        let output_str = String::from_utf8_lossy(&attach_output.stdout);
        let mount_point = output_str
            .lines()
            .last()
            .unwrap_or("")
            .split_whitespace()
            .last()
            .unwrap_or("");
        let mount_path = PathBuf::from(mount_point);
        let app_name = "RobloxStudio.app";
        let source_app = mount_path.join(&app_name);
        if source_app.exists() {
            let _ = fs::create_dir_all(&version_path);
            let dest_app = version_path.join(&app_name);
            let _ = Command::new("cp")
                .args([
                    "-r",
                    &source_app.to_string_lossy(),
                    &dest_app.to_string_lossy(),
                ])
                .output();
        } else {
            return Err(format!("{} not found in dmg", app_name));
        }
        let _ = app.emit(
            "progress-update",
            ProgressPayload {
                status: "Cleaning up...".into(),
                percent: 90,
            },
        );
        let _ = Command::new("hdiutil")
            .args(["detach", mount_point])
            .output();
        let _ = fs::remove_file(&temp_path);
    }

    let url_prefix: &str;
    if binary_type == "MacStudio" {
        url_prefix = "https://setup.rbxcdn.com";
    } else if binary_type.starts_with("Mac") {
        url_prefix = "https://setup.rbxcdn.com/mac";
    } else {
        url_prefix = "https://setup.rbxcdn.com";
    }

    if binary_type != "MacStudio" {
        let mut packages_to_download = Vec::new();

        // Fetch manifests first to ensure Studio doesn't say "missing or corrupted"
        for m_name in ["rbxPkgManifest.txt", "rbxManifest.txt"] {
            let m_url = format!("{}/{}-{}", url_prefix, version, m_name);
            println!("[Downloader] Syncing manifest: {}", m_name);
            if let Ok(resp) = client.get(&m_url).send() {
                if resp.status().is_success() {
                    if let Ok(content) = resp.bytes() {
                        let _ = fs::write(version_path.join(m_name), &content);

                        if m_name == "rbxPkgManifest.txt" {
                            let text = String::from_utf8_lossy(&content);
                            let lines: Vec<&str> = text.lines().collect();
                            if !lines.is_empty() && lines[0] == "v0" {
                                for i in (1..lines.len()).step_by(4) {
                                    if i < lines.len() {
                                        packages_to_download.push(lines[i].to_string());
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // Fallback if manifest fetch failed
        if packages_to_download.is_empty() {
            #[cfg(target_os = "windows")]
            {
                let packages = if binary_type == "WindowsStudio" || binary_type == "WindowsStudio64"
                {
                    vec![
                        "RobloxStudio.zip",
                        "Libraries.zip",
                        "LibrariesQt5.zip",
                        "redist.zip",
                        "ApplicationConfig.zip",
                        "RibbonConfig.zip",
                        "WebView2.zip",
                        "shaders.zip",
                        "ssl.zip",
                        "content-avatar.zip",
                        "content-configs.zip",
                        "content-fonts.zip",
                        "content-models.zip",
                        "content-qt_translations.zip",
                        "content-sky.zip",
                        "content-sounds.zip",
                        "content-textures2.zip",
                        "content-textures3.zip",
                        "content-studio_svg_textures.zip",
                        "content-terrain.zip",
                        "content-platform-fonts.zip",
                        "content-platform-dictionaries.zip",
                        "content-api-docs.zip",
                        "extracontent-scripts.zip",
                        "extracontent-luapackages.zip",
                        "extracontent-translations.zip",
                        "extracontent-models.zip",
                        "extracontent-textures.zip",
                        "studiocontent-models.zip",
                        "studiocontent-textures.zip",
                        "StudioFonts.zip",
                        "BuiltInPlugins.zip",
                        "BuiltInStandalonePlugins.zip",
                        "Plugins.zip",
                    ]
                } else {
                    vec![
                        "RobloxApp.zip",
                        "WebView2.zip",
                        "ssl.zip",
                        "shaders.zip",
                        "content-fonts.zip",
                        "content-models.zip",
                        "content-sky.zip",
                        "content-sounds.zip",
                        "content-textures2.zip",
                        "content-textures3.zip",
                        "content-terrain.zip",
                        "content-configs.zip",
                        "content-platform-fonts.zip",
                        "content-platform-dictionaries.zip",
                        "content-avatar.zip",
                        "extracontent-places.zip",
                        "extracontent-luapackages.zip",
                        "extracontent-translations.zip",
                        "extracontent-models.zip",
                        "extracontent-textures.zip",
                    ]
                };
                packages_to_download = packages.iter().map(|s| s.to_string()).collect();
            }
            #[cfg(target_os = "macos")]
            {
                packages_to_download = vec!["RobloxPlayer.zip".to_string()];
            }
        }

        for (idx, pkg) in packages_to_download.iter().enumerate() {
            if pkg == "WebView2RuntimeInstaller.zip" {
                continue;
            }

            let label = pkg.replace(".zip", "");
            let percent = ((idx + 1) * 100) / packages_to_download.len();

            println!("[Downloader] Processing package: {} ({}%)", pkg, percent);

            let _ = app.emit(
                "progress-update",
                ProgressPayload {
                    status: format!("Updating {}...", label).into(),
                    percent: percent as u64,
                },
            );

            let pkg_url = format!("{}/{}-{}", url_prefix, version, pkg);
            let resp = match client.get(&pkg_url).send() {
                Ok(r) => {
                    if !r.status().is_success() {
                        println!(
                            "[Downloader] Failed to download {}: Status {}",
                            pkg,
                            r.status()
                        );
                        continue;
                    }
                    r
                }
                Err(e) => {
                    println!("[Downloader] Request error for {}: {}", pkg, e);
                    continue;
                }
            };

            let content = match resp.bytes() {
                Ok(b) => b,
                Err(e) => {
                    println!("[Downloader] Failed to read bytes for {}: {}", pkg, e);
                    continue;
                }
            };

            println!(
                "[Downloader] Extracting {} ({} bytes)...",
                pkg,
                content.len()
            );
            let reader = Cursor::new(content);

            let package_dir = match pkg.as_str() {
                "RobloxStudio.zip" => "RobloxStudio.app",
                "RobloxPlayer.zip" => "RobloxPlayer.app",
                "RobloxApp.zip" | "Libraries.zip" | "LibrariesQt5.zip" | "redist.zip"
                | "WebView2.zip" => "",
                "shaders.zip" => "shaders",
                "ssl.zip" => "ssl",
                "content-avatar.zip" => "content/avatar",
                "content-configs.zip" => "content/configs",
                "content-fonts.zip" => "content/fonts",
                "content-sky.zip" => "content/sky",
                "content-sounds.zip" => "content/sounds",
                "content-textures2.zip" => "content/textures",
                "content-models.zip" => "content/models",
                "content-textures3.zip" => "PlatformContent/pc/textures",
                "content-terrain.zip" => "PlatformContent/pc/terrain",
                "content-platform-fonts.zip" => "PlatformContent/pc/fonts",
                "content-platform-dictionaries.zip" => {
                    "PlatformContent/pc/shared_compression_dictionaries"
                }
                "extracontent-luapackages.zip" => "ExtraContent/LuaPackages",
                "extracontent-translations.zip" => "ExtraContent/translations",
                "extracontent-models.zip" => "ExtraContent/models",
                "extracontent-textures.zip" => "ExtraContent/textures",
                "extracontent-places.zip" => "ExtraContent/places",
                "content-studio_svg_textures.zip" => "content/studio_svg_textures",
                "content-qt_translations.zip" => "content/qt_translations",
                "content-api-docs.zip" => "content/api_docs",
                "BuiltInPlugins.zip" => "BuiltInPlugins",
                "BuiltInStandalonePlugins.zip" => "BuiltInStandalonePlugins",
                "StudioFonts.zip" => "StudioFonts",
                "ApplicationConfig.zip" => "ApplicationConfig",
                "RibbonConfig.zip" => "RibbonConfig",
                "Qml.zip" => "Qml",
                "Plugins.zip" => "plugins",
                _ => "",
            };

            if let Ok(mut archive) = ZipArchive::new(reader) {
                for i in 0..archive.len() {
                    if let Ok(mut file) = archive.by_index(i) {
                        let name = file.name();
                        if name.ends_with('/') {
                            continue;
                        }

                        let mut entry_path = PathBuf::from(name);

                        if !package_dir.is_empty() {
                            let pkg_dir_path = PathBuf::from(package_dir.replace('\\', "/"));
                            if entry_path.starts_with(&pkg_dir_path) {
                                if let Ok(remaining) = entry_path.strip_prefix(&pkg_dir_path) {
                                    entry_path = remaining.to_path_buf();
                                }
                            } else {
                                if let Some(first_comp) = entry_path.components().next() {
                                    if let std::path::Component::Normal(c1) = first_comp {
                                        if let Some(p_first_comp) = pkg_dir_path.components().next()
                                        {
                                            if let std::path::Component::Normal(p1) = p_first_comp {
                                                if c1.to_string_lossy().to_lowercase()
                                                    == p1.to_string_lossy().to_lowercase()
                                                {
                                                    let entry_comps: Vec<_> =
                                                        entry_path.components().collect();
                                                    let pkg_comps: Vec<_> =
                                                        pkg_dir_path.components().collect();
                                                    let mut match_count = 0;
                                                    for (ec, pc) in
                                                        entry_comps.iter().zip(pkg_comps.iter())
                                                    {
                                                        if ec
                                                            .as_os_str()
                                                            .to_string_lossy()
                                                            .to_lowercase()
                                                            == pc
                                                                .as_os_str()
                                                                .to_string_lossy()
                                                                .to_lowercase()
                                                        {
                                                            match_count += 1;
                                                        } else {
                                                            break;
                                                        }
                                                    }
                                                    if match_count > 0 {
                                                        let mut p = PathBuf::new();
                                                        for comp in entry_comps
                                                            .into_iter()
                                                            .skip(match_count)
                                                        {
                                                            p.push(comp.as_os_str());
                                                        }
                                                        entry_path = p;
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        if entry_path.as_os_str().is_empty() {
                            continue;
                        }

                        let target_dir = version_path.join(package_dir);
                        let outpath = target_dir.join(&entry_path);

                        if let Some(p) = outpath.parent() {
                            let _ = fs::create_dir_all(p);
                        }

                        #[cfg(unix)]
                        let is_symlink =
                            file.unix_mode().map(|m| (m >> 12) == 0o12).unwrap_or(false);
                        #[cfg(not(unix))]
                        let is_symlink = false;

                        if is_symlink {
                            #[cfg(unix)]
                            {
                                use std::io::Read;
                                let mut link_to = String::new();
                                if file.read_to_string(&mut link_to).is_ok() {
                                    let _ = fs::remove_file(&outpath);
                                    let _ = std::os::unix::fs::symlink(link_to.trim(), &outpath);
                                }
                            }
                        } else {
                            if let Ok(mut outfile) = fs::File::create(&outpath) {
                                let _ = std::io::copy(&mut file, &mut outfile);
                            }
                        }

                        #[cfg(unix)]
                        {
                            use std::os::unix::fs::PermissionsExt;
                            if let Some(mode) = file.unix_mode() {
                                let _ =
                                    fs::set_permissions(&outpath, fs::Permissions::from_mode(mode));
                            }
                        }
                    }
                }
            } else {
                println!("[Downloader] Failed to open zip archive for {}", pkg);
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        let settings_path = version_path.join("AppSettings.xml");
        if !settings_path.exists() {
            let settings_content = r#"<?xml version="1.0" encoding="UTF-8"?>
<Settings>
    <ContentFolder>content</ContentFolder>
    <BaseUrl>http://www.roblox.com</BaseUrl>
</Settings>"#;
            let _ = fs::write(settings_path, settings_content);
        }

        if binary_type == "WindowsPlayer" {
            let client_settings_path = version_path.join("ClientSettings");
            if !client_settings_path.exists() {
                let _ = fs::create_dir_all(client_settings_path);
            }
        }
    }
    let mut final_path = exe_path;
    let path_str = final_path.to_string_lossy().to_string();
    if path_str.starts_with(r"\\?\") {
        final_path = PathBuf::from(&path_str[4..]);
    }

    #[cfg(target_os = "macos")]
    apply_macos_fixes(&final_path);

    #[cfg(all(target_family = "unix", not(target_os = "macos")))]
    {
        use std::os::unix::fs::PermissionsExt;
        if final_path.exists() {
            if let Ok(metadata) = fs::metadata(&final_path) {
                let mut perms = metadata.permissions();
                perms.set_mode(0o755);
                let _ = fs::set_permissions(&final_path, perms);
            }
        }
    }

    Ok(final_path)
}

fn install_mods(
    version_path: &PathBuf,
    flags_json: String,
    skybox_path: String,
) -> Result<(), String> {
    if !flags_json.is_empty() && flags_json != "{}" {
        let client_settings = version_path.join("ClientSettings");
        if !client_settings.exists() {
            let _ = fs::create_dir_all(&client_settings);
        }
        let _ = fs::write(client_settings.join("ClientAppSettings.json"), &flags_json);
    }

    if !skybox_path.is_empty() {
        let sky_dir = version_path
            .join("PlatformContent")
            .join("pc")
            .join("textures")
            .join("sky");
        if sky_dir.exists() {
            let source_path = PathBuf::from(&skybox_path);
            if source_path.exists() {
                let copy_if_tex =
                    |entry_path: PathBuf, target_folder: &PathBuf| -> Result<(), std::io::Error> {
                        if let Some(name) = entry_path.file_name() {
                            let name_str = name.to_string_lossy().to_lowercase();
                            if name_str.ends_with(".tex")
                                || name_str.ends_with(".png")
                                || name_str.ends_with(".jpg")
                            {
                                fs::copy(&entry_path, target_folder.join(name))?;
                            }
                        }
                        Ok(())
                    };

                if source_path.is_dir() {
                    if let Ok(entries) = fs::read_dir(&source_path) {
                        for entry in entries.flatten() {
                            let _ = copy_if_tex(entry.path(), &sky_dir);
                        }
                    }
                }
            }
        }
    }
    Ok(())
}

#[tauri::command]
async fn ensure_roblox_installed(app: tauri::AppHandle) -> Result<String, String> {
    show_progress_window(&app);
    let _ = app.emit(
        "progress-update",
        ProgressPayload {
            status: "Checking for updates...".into(),
            percent: 0,
        },
    );

    let app_clone = app.clone();
    let res = tauri::async_runtime::spawn_blocking(move || {
        #[cfg(target_os = "macos")]
        let binary_type = "MacPlayer";
        #[cfg(not(target_os = "macos"))]
        let binary_type = "WindowsPlayer";

        let version = get_latest_version(binary_type)?;
        download_and_install(&app_clone, &version, binary_type)
    })
    .await
    .map_err(|e| e.to_string())??;

    let mut path_str = res.to_string_lossy().to_string();
    if path_str.starts_with(r"\\?\") {
        path_str = path_str[4..].to_string();
    }

    let _ = app.emit("progress-close", ());
    if let Some(win) = app.get_webview_window("progress") {
        let _ = win.close();
    }

    Ok(path_str)
}

#[tauri::command]
async fn launch_roblox_executable(path: String) -> Result<(), String> {
    if path == "sober" {
        #[cfg(any(target_os = "windows", target_os = "linux"))]
        {
            #[cfg(target_os = "linux")]
            {
                // Helper to test if a command exists
                fn command_exists(cmd: &str) -> bool {
                    Command::new("sh")
                        .arg("-c")
                        .arg(format!("command -v {} >/dev/null 2>&1", cmd))
                        .status()
                        .map(|s| s.success())
                        .unwrap_or(false)
                }

                // Try to install flatpak if missing
                fn try_install_flatpak() -> Result<(), String> {
                    if command_exists("flatpak") {
                        return Ok(());
                    }

                    let installers = [
                        ("apt-get", "sudo apt-get update && sudo apt-get install -y flatpak"),
                        ("dnf", "sudo dnf install -y flatpak"),
                        ("pacman", "sudo pacman -S --noconfirm flatpak"),
                        ("zypper", "sudo zypper install -y flatpak"),
                    ];

                    for (mgr, cmd) in installers {
                        if command_exists(mgr) {
                            let status = Command::new("sh").arg("-c").arg(cmd).status().map_err(|e| e.to_string())?;
                            if status.success() && command_exists("flatpak") {
                                return Ok(());
                            }
                        }
                    }

                    Err("Failed to install flatpak: no supported package manager found or installation failed".into())
                }

                // Ensure flathub remote exists
                fn ensure_flathub_remote() -> Result<(), String> {
                    let check = Command::new("sh")
                        .arg("-c")
                        .arg("flatpak remote-list | awk '{print $1}' | grep -x flathub >/dev/null 2>&1")
                        .status()
                        .map_err(|e| e.to_string())?;
                    if check.success() {
                        return Ok(());
                    }
                    let add = Command::new("flatpak")
                        .args(["remote-add", "--if-not-exists", "flathub", "https://flathub.org/repo/flathub.flatpakrepo"])
                        .status()
                        .map_err(|e| e.to_string())?;
                    if add.success() {
                        Ok(())
                    } else {
                        Err("Failed to add flathub remote".into())
                    }
                }

                fn ensure_flatpak_app(pkg: &str) -> Result<(), String> {
                    // Check installed apps
                    let list = Command::new("flatpak")
                        .args(["list", "--app", "--columns=application"])
                        .output()
                        .map_err(|e| e.to_string())?;

                    let stdout = String::from_utf8_lossy(&list.stdout);
                    if stdout.lines().any(|l| l.trim() == pkg) {
                        return Ok(());
                    }

                    ensure_flathub_remote()?;

                    let install_cmd = format!("flatpak install -y flathub {}", pkg);
                    let status = Command::new("sh").arg("-c").arg(&install_cmd).status().map_err(|e| e.to_string())?;
                    if status.success() {
                        Ok(())
                    } else {
                        Err(format!("Failed to install {} via flatpak", pkg))
                    }
                }

                try_install_flatpak()?;
                ensure_flatpak_app("org.vinegarhq.Sober")?;
                Command::new("flatpak")
                    .args(["run", "org.vinegarhq.Sober"])
                    .spawn()
                    .map_err(|e| e.to_string())?;
                return Ok(());
            }

            #[cfg(target_os = "windows")]
            {
                // On Windows just try to run; installing flatpak is out of scope here
                Command::new("flatpak")
                    .args(["run", "org.vinegarhq.Sober"])
                    .spawn()
                    .map_err(|e| e.to_string())?;
                return Ok(());
            }
        }
        #[cfg(not(any(target_os = "windows", target_os = "linux")))]
        {
            return Err("Sober not supported on this OS".into());
        }
    }

    let mut exe_path = PathBuf::from(&path);

    let path_str = exe_path.to_string_lossy().to_string();
    if path_str.starts_with(r"\\?\") {
        exe_path = PathBuf::from(&path_str[4..]);
    }

    if !exe_path.exists() {
        return Err(format!("Executable not found at {}", exe_path.display()));
    }

    #[cfg(target_os = "windows")]
    {
        let version_dir = exe_path.parent().ok_or("Invalid path")?;

        let exe_str = exe_path.to_string_lossy();
        let dir_str = version_dir.to_string_lossy();

        Command::new("cmd")
            .args(["/C", "start", "", "/D", &dir_str, &exe_str, "--app"])
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "macos")]
    {
        let app_path = exe_path
            .parent()
            .unwrap()
            .parent()
            .unwrap()
            .parent()
            .unwrap();
        Command::new("open")
            .args(["-a", app_path.to_string_lossy().as_ref()])
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "linux")]
    {
        if path.contains("org.vinegarhq.Sober") || path.contains("org.vinegarhq.Vinegar") {
            let pkg = if path.contains("org.vinegarhq.Sober") {
                "org.vinegarhq.Sober"
            } else {
                "org.vinegarhq.Vinegar"
            };

            fn command_exists(cmd: &str) -> bool {
                Command::new("sh")
                    .arg("-c")
                    .arg(format!("command -v {} >/dev/null 2>&1", cmd))
                    .status()
                    .map(|s| s.success())
                    .unwrap_or(false)
            }

            fn try_install_flatpak() -> Result<(), String> {
                if command_exists("flatpak") {
                    return Ok(());
                }
                let installers = [
                    ("apt-get", "sudo apt-get update && sudo apt-get install -y flatpak"),
                    ("dnf", "sudo dnf install -y flatpak"),
                    ("pacman", "sudo pacman -S --noconfirm flatpak"),
                    ("zypper", "sudo zypper install -y flatpak"),
                ];
                for (_mgr, cmd) in installers {
                    if command_exists(_mgr) {
                        let status = Command::new("sh").arg("-c").arg(cmd).status().map_err(|e| e.to_string())?;
                        if status.success() && command_exists("flatpak") {
                            return Ok(());
                        }
                    }
                }
                Err("Failed to install flatpak: no supported package manager found or installation failed".into())
            }

            fn ensure_flathub_remote() -> Result<(), String> {
                let check = Command::new("sh")
                    .arg("-c")
                    .arg("flatpak remote-list | awk '{print $1}' | grep -x flathub >/dev/null 2>&1")
                    .status()
                    .map_err(|e| e.to_string())?;
                if check.success() {
                    return Ok(());
                }
                let add = Command::new("flatpak")
                    .args(["remote-add", "--if-not-exists", "flathub", "https://flathub.org/repo/flathub.flatpakrepo"])
                    .status()
                    .map_err(|e| e.to_string())?;
                if add.success() {
                    Ok(())
                } else {
                    Err("Failed to add flathub remote".into())
                }
            }

            fn ensure_flatpak_app(pkg: &str) -> Result<(), String> {
                let list = Command::new("flatpak")
                    .args(["list", "--app", "--columns=application"])
                    .output()
                    .map_err(|e| e.to_string())?;
                let stdout = String::from_utf8_lossy(&list.stdout);
                if stdout.lines().any(|l| l.trim() == pkg) {
                    return Ok(());
                }
                ensure_flathub_remote()?;
                let install_cmd = format!("flatpak install -y flathub {}", pkg);
                let status = Command::new("sh").arg("-c").arg(&install_cmd).status().map_err(|e| e.to_string())?;
                if status.success() {
                    Ok(())
                } else {
                    Err(format!("Failed to install {} via flatpak", pkg))
                }
            }

            try_install_flatpak()?;
            ensure_flatpak_app(pkg)?;
            Command::new("flatpak")
                .args(["run", pkg])
                .spawn()
                .map_err(|e| e.to_string())?;
        } else {
            Command::new(&exe_path).spawn().map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

#[tauri::command]
#[allow(unused_variables)]
async fn launch_roblox(
    app: tauri::AppHandle,
    flags_json: String,
    skybox_path: String,
) -> Result<(), String> {
    show_progress_window(&app);
    let _ = app.emit(
        "progress-update",
        ProgressPayload {
            status: "Checking for updates...".into(),
            percent: 0,
        },
    );

    let app_clone = app.clone();

    tauri::async_runtime::spawn_blocking(move || {
        let res = (|| -> Result<(), String> {
            #[cfg(target_os = "windows")]
            {
                let version = get_latest_version("WindowsPlayer")?;
                let _ = app_clone.emit(
                    "progress-update",
                    ProgressPayload {
                        status: "Verifying installation...".into(),
                        percent: 0,
                    },
                );
                let exe_path = download_and_install(&app_clone, &version, "WindowsPlayer")?;

                let version_dir = exe_path.parent().unwrap().to_path_buf();
                let _ = install_mods(&version_dir, flags_json, skybox_path);

                let _ = app_clone.emit(
                    "progress-update",
                    ProgressPayload {
                        status: "Launching...".into(),
                        percent: 100,
                    },
                );

                let exe_str = exe_path.to_string_lossy().to_string();

                let version_dir = exe_path.parent().unwrap();
                let dir_str = version_dir.to_string_lossy();

                Command::new("cmd")
                    .args(["/C", "start", "", "/D", &dir_str, &exe_str, "--app"])
                    .spawn()
                    .map_err(|e| e.to_string())?;

                Ok(())
            }
            #[cfg(target_os = "linux")]
            {
                let _ = app_clone.emit(
                    "progress-update",
                    ProgressPayload {
                        status: "Launching Sober...".into(),
                        percent: 100,
                    },
                );

                // Helpers (scoped locally) to detect and install flatpak and the app
                fn command_exists(cmd: &str) -> bool {
                    Command::new("sh")
                        .arg("-c")
                        .arg(format!("command -v {} >/dev/null 2>&1", cmd))
                        .status()
                        .map(|s| s.success())
                        .unwrap_or(false)
                }

                fn try_install_flatpak() -> Result<(), String> {
                    if command_exists("flatpak") {
                        return Ok(());
                    }
                    let installers = [
                        ("apt-get", "sudo apt-get update && sudo apt-get install -y flatpak"),
                        ("dnf", "sudo dnf install -y flatpak"),
                        ("pacman", "sudo pacman -S --noconfirm flatpak"),
                        ("zypper", "sudo zypper install -y flatpak"),
                    ];
                    for (_mgr, cmd) in installers {
                        if command_exists(_mgr) {
                            let status = Command::new("sh").arg("-c").arg(cmd).status().map_err(|e| e.to_string())?;
                            if status.success() && command_exists("flatpak") {
                                return Ok(());
                            }
                        }
                    }
                    Err("Failed to install flatpak: no supported package manager found or installation failed".into())
                }

                fn ensure_flathub_remote() -> Result<(), String> {
                    let check = Command::new("sh")
                        .arg("-c")
                        .arg("flatpak remote-list | awk '{print $1}' | grep -x flathub >/dev/null 2>&1")
                        .status()
                        .map_err(|e| e.to_string())?;
                    if check.success() {
                        return Ok(());
                    }
                    let add = Command::new("flatpak")
                        .args(["remote-add", "--if-not-exists", "flathub", "https://flathub.org/repo/flathub.flatpakrepo"])
                        .status()
                        .map_err(|e| e.to_string())?;
                    if add.success() {
                        Ok(())
                    } else {
                        Err("Failed to add flathub remote".into())
                    }
                }

                fn ensure_flatpak_app(pkg: &str) -> Result<(), String> {
                    let list = Command::new("flatpak")
                        .args(["list", "--app", "--columns=application"])
                        .output()
                        .map_err(|e| e.to_string())?;
                    let stdout = String::from_utf8_lossy(&list.stdout);
                    if stdout.lines().any(|l| l.trim() == pkg) {
                        return Ok(());
                    }
                    ensure_flathub_remote()?;
                    let install_cmd = format!("flatpak install -y flathub {}", pkg);
                    let status = Command::new("sh").arg("-c").arg(&install_cmd).status().map_err(|e| e.to_string())?;
                    if status.success() {
                        Ok(())
                    } else {
                        Err(format!("Failed to install {} via flatpak", pkg))
                    }
                }

                try_install_flatpak()?;
                ensure_flatpak_app("org.vinegarhq.Sober")?;
                Command::new("flatpak")
                    .args(["run", "org.vinegarhq.Sober"])
                    .spawn()
                    .map_err(|e| e.to_string())?;
                Ok(())
            }
            #[cfg(target_os = "macos")]
            {
                let version = get_latest_version("MacPlayer")?;
                let _ = app_clone.emit(
                    "progress-update",
                    ProgressPayload {
                        status: "Verifying installation...".into(),
                        percent: 0,
                    },
                );
                let exe_path = download_and_install(&app_clone, &version, "MacPlayer")?;
                let _ = app_clone.emit(
                    "progress-update",
                    ProgressPayload {
                        status: "Launching...".into(),
                        percent: 100,
                    },
                );
                let app_bundle = exe_path
                    .parent()
                    .unwrap()
                    .parent()
                    .unwrap()
                    .parent()
                    .unwrap();
                Command::new("open")
                    .args(["-a", app_bundle.to_string_lossy().as_ref()])
                    .spawn()
                    .map_err(|e| e.to_string())?;
                Ok(())
            }
            #[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
            {
                Err("Not supported on this OS".to_string())
            }
        })();

        std::thread::sleep(std::time::Duration::from_millis(1500));
        let _ = app_clone.emit("progress-close", ());
        if let Some(win) = app_clone.get_webview_window("progress") {
            let _ = win.close();
        }

        res
    })
    .await
    .map_err(|e| e.to_string())??;

    Ok(())
}

#[tauri::command]
async fn launch_studio(app: tauri::AppHandle) -> Result<(), String> {
    show_progress_window(&app);
    let _ = app.emit(
        "progress-update",
        ProgressPayload {
            status: "Checking for updates...".into(),
            percent: 0,
        },
    );

    let app_clone = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let res = (|| -> Result<(), String> {
            #[cfg(target_os = "windows")]
            {
                let binary_type = "WindowsStudio64";
                let version = get_latest_version(binary_type)?;
                let _ = app_clone.emit(
                    "progress-update",
                    ProgressPayload {
                        status: "Verifying installation...".into(),
                        percent: 0,
                    },
                );
                let exe_path = download_and_install(&app_clone, &version, binary_type)?;

                let _ = app_clone.emit(
                    "progress-update",
                    ProgressPayload {
                        status: "Launching Studio...".into(),
                        percent: 100,
                    },
                );

                let version_dir = exe_path.parent().unwrap();
                let mut final_exe = exe_path.clone();
                let fe_str = final_exe.to_string_lossy().to_string();
                if fe_str.starts_with(r"\\?\") {
                    final_exe = PathBuf::from(&fe_str[4..]);
                }

                let mut cmd = std::process::Command::new("cmd");
                cmd.args([
                    "/C",
                    "start",
                    "",
                    "/D",
                    &version_dir.to_string_lossy(),
                    &final_exe.to_string_lossy(),
                ]);

                cmd.spawn().map_err(|e| e.to_string())?;

                Ok(())
            }
            #[cfg(target_os = "linux")]
            {
                let _ = app_clone.emit(
                    "progress-update",
                    ProgressPayload {
                        status: "Launching Vinegar...".into(),
                        percent: 100,
                    },
                );

                // Local helpers to ensure flatpak and Vinegar are installed
                fn command_exists(cmd: &str) -> bool {
                    Command::new("sh")
                        .arg("-c")
                        .arg(format!("command -v {} >/dev/null 2>&1", cmd))
                        .status()
                        .map(|s| s.success())
                        .unwrap_or(false)
                }

                fn try_install_flatpak() -> Result<(), String> {
                    if command_exists("flatpak") {
                        return Ok(());
                    }
                    let installers = [
                        ("apt-get", "sudo apt-get update && sudo apt-get install -y flatpak"),
                        ("dnf", "sudo dnf install -y flatpak"),
                        ("pacman", "sudo pacman -S --noconfirm flatpak"),
                        ("zypper", "sudo zypper install -y flatpak"),
                    ];
                    for (mgr, cmd) in installers {
                        if command_exists(mgr) {
                            let status = Command::new("sh").arg("-c").arg(cmd).status().map_err(|e| e.to_string())?;
                            if status.success() && command_exists("flatpak") {
                                return Ok(());
                            }
                        }
                    }
                    Err("Failed to install flatpak: no supported package manager found or installation failed".into())
                }

                fn ensure_flathub_remote() -> Result<(), String> {
                    let check = Command::new("sh")
                        .arg("-c")
                        .arg("flatpak remote-list | awk '{print $1}' | grep -x flathub >/dev/null 2>&1")
                        .status()
                        .map_err(|e| e.to_string())?;
                    if check.success() {
                        return Ok(());
                    }
                    let add = Command::new("flatpak")
                        .args(["remote-add", "--if-not-exists", "flathub", "https://flathub.org/repo/flathub.flatpakrepo"])
                        .status()
                        .map_err(|e| e.to_string())?;
                    if add.success() {
                        Ok(())
                    } else {
                        Err("Failed to add flathub remote".into())
                    }
                }

                fn ensure_flatpak_app(pkg: &str) -> Result<(), String> {
                    let list = Command::new("flatpak")
                        .args(["list", "--app", "--columns=application"])
                        .output()
                        .map_err(|e| e.to_string())?;
                    let stdout = String::from_utf8_lossy(&list.stdout);
                    if stdout.lines().any(|l| l.trim() == pkg) {
                        return Ok(());
                    }
                    ensure_flathub_remote()?;
                    let install_cmd = format!("flatpak install -y flathub {}", pkg);
                    let status = Command::new("sh").arg("-c").arg(&install_cmd).status().map_err(|e| e.to_string())?;
                    if status.success() {
                        Ok(())
                    } else {
                        Err(format!("Failed to install {} via flatpak", pkg))
                    }
                }

                try_install_flatpak()?;
                ensure_flatpak_app("org.vinegarhq.Vinegar")?;
                Command::new("flatpak")
                    .args(["run", "org.vinegarhq.Vinegar"])
                    .spawn()
                    .map_err(|e| e.to_string())?;
                Ok(())
            }
            #[cfg(target_os = "macos")]
            {
                return Err("Studio not supported on macOS".to_string());
            }
            #[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
            {
                Err("Not supported on this OS".to_string())
            }
        })();

        std::thread::sleep(std::time::Duration::from_millis(1500));
        let _ = app_clone.emit("progress-close", ());
        if let Some(win) = app_clone.get_webview_window("progress") {
            let _ = win.close();
        }

        res
    })
    .await
    .map_err(|e| e.to_string())??;

    Ok(())
}

#[tauri::command]
fn run_cleaner(max_age_days: u32, directories: Vec<String>) -> Result<String, String> {
    let max_age = Duration::from_secs(max_age_days as u64 * 24 * 60 * 60);
    let now = SystemTime::now();
    let mut cleaned_count = 0;

    for dir_type in directories {
        let paths = match dir_type.as_str() {
            "RobloxLogs" => get_roblox_log_paths(),
            "RobloxCache" => get_roblox_cache_paths(),
            _ => continue,
        };

        for path in paths {
            if let Ok(entries) = fs::read_dir(&path) {
                for entry in entries.flatten() {
                    if let Ok(metadata) = entry.metadata() {
                        if metadata.is_file() {
                            if let Ok(modified) = metadata.modified() {
                                if now.duration_since(modified).unwrap_or(Duration::ZERO) > max_age
                                {
                                    if fs::remove_file(entry.path()).is_ok() {
                                        cleaned_count += 1;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(format!("Cleaned {} files.", cleaned_count))
}

fn get_roblox_log_paths() -> Vec<String> {
    let mut paths = Vec::new();
    if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
        paths.push(format!("{}\\Roblox\\logs", local_app_data));
    }
    if let Ok(home) = std::env::var("HOME") {
        paths.push(format!("{}/Library/Logs/Roblox", home));
        paths.push(format!(
            "{}/.var/app/org.vinegarhq.Sober/data/sober/logs",
            home
        ));
    }
    paths
}

fn get_roblox_cache_paths() -> Vec<String> {
    let mut paths = Vec::new();
    if let Ok(temp) = std::env::var("TEMP") {
        paths.push(format!("{}\\Roblox", temp));
    }
    if let Ok(tmpdir) = std::env::var("TMPDIR") {
        paths.push(format!("{}/Roblox", tmpdir.trim_end_matches('/')));
    }
    if let Ok(home) = std::env::var("HOME") {
        paths.push(format!("{}/Library/Caches/Roblox", home));
        paths.push(format!("{}/.cache/sober", home));
    }
    paths
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut app =
        tauri::Builder::default().plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            let _ = app.emit("single-instance", ());

            if let Some(main_window) = app.get_webview_window("main") {
                if main_window.is_visible().unwrap_or(false) {
                    let _ = main_window.set_focus();
                    let _ = main_window.unminimize();
                    return;
                }
            }

            if let Some(splash) = app.get_webview_window("splashscreen") {
                let _ = splash.show();
                let _ = splash.set_focus();
                let _ = splash.unminimize();
            } else {
                let _ = tauri::WebviewWindowBuilder::new(
                    app,
                    "splashscreen",
                    tauri::WebviewUrl::App("splashscreen.html".into()),
                )
                .title("nullstrap")
                .inner_size(700.0, 350.0)
                .center()
                .decorations(false)
                .shadow(true)
                .maximizable(false)
                .build();
            }
        }));

    #[cfg(not(target_os = "macos"))]
    {
        app = app.plugin(tauri_plugin_window_state::Builder::default().build());
    }

    app.plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_drpc::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_os::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            open_main_window,
            apply_square_corners,
            save_fast_flags,
            apply_skybox_texture,
            is_roblox_running,
            get_current_place_id,
            get_roblox_game_name,
            run_cleaner,
            launch_roblox,
            launch_studio,
            ensure_roblox_installed,
            launch_roblox_executable,
            fetch_all_flags
        ])
        .setup(|app| {
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.hide();
                let win_clone = win.clone();
                win.on_window_event(move |event| {
                    if let WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = win_clone.hide();
                    }
                });
            }

            if let Some(splash) = app.get_webview_window("splashscreen") {
                let _ = splash.show();
                let _ = splash.set_focus();
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
