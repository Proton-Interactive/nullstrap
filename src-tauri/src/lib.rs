use tauri::{Manager, WindowEvent, Emitter};
use sysinfo::System;
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, Duration};
use std::io::{Cursor, Read};
use reqwest;
use zip::ZipArchive;
use std::process::Command;
#[cfg(target_os = "linux")]
use dirs;

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
        
        // do not hide splashscreen. the user requested splash to stay open.
        /* 
        if let Some(splash_win) = app.get_webview_window("splashscreen") {
            let _ = splash_win.hide();
            println!("open_main_window: hidden splashscreen");
        }
        */

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
    .transparent(true)
    .build()
    {
        Ok(win) => {
            // hide splashscreen
            /*
            if let Some(splash_win) = app.get_webview_window("splashscreen") {
                let _ = splash_win.hide();
            }
            */

            let win_clone = win.clone();
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
            eprintln!("open_main_window: failed to create 'main' window: {:?}", err);
            if let Some(win) = app.get_webview_window("splashscreen") {
                let _ = win.show();
                let _ = win.set_focus();
            } else {
                eprintln!("open_main_window: no 'splashscreen' window available to fall back to");
            }
        }
    }
}

// apply square corners
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
fn apply_skybox_texture(app: tauri::AppHandle, filename: String, data: Vec<u8>) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        let mut potential_paths = Vec::new();
        if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            potential_paths.push(PathBuf::from(local_app_data).join("Roblox").join("Versions"));
        }
        if let Ok(program_files_x86) = std::env::var("ProgramFiles(x86)") {
            potential_paths.push(PathBuf::from(program_files_x86).join("Roblox").join("Versions"));
        }
        if let Ok(data_dir) = app.path().app_local_data_dir() {
            potential_paths.push(data_dir.join("rblx-versions"));
        }
        
        let mut target_dirs = Vec::new();
        for versions_path in potential_paths {
            if !versions_path.exists() { continue; }
            if let Ok(entries) = fs::read_dir(versions_path) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_dir() {
                        let is_player = path.join("RobloxPlayerBeta.exe").exists();
                        let is_studio = path.join("RobloxStudioBeta.exe").exists();
                        
                        if is_player || is_studio {
                            let sky_dir = path.join("PlatformContent").join("pc").join("textures").join("sky");
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


// save fast flags
#[tauri::command]
fn save_fast_flags(app: tauri::AppHandle, flags_json: String, mode: &str) -> Result<String, String> {
    save_fast_flags_internal(&app, flags_json, mode)
}

fn save_fast_flags_internal(app: &tauri::AppHandle, flags_json: String, mode: &str) -> Result<String, String> {
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
        
        // Add Nullstrap managed versions
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

            // Recursive search for RobloxPlayerBeta.exe or RobloxStudioBeta.exe
            if let Ok(entries) = fs::read_dir(&versions_path) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_dir() {
                         // Check for Player or Studio
                         let is_player = path.join("RobloxPlayerBeta.exe").exists();
                         let is_studio = path.join("RobloxStudioBeta.exe").exists();
                         
                         let should_save = match mode {
                             "studio" => is_studio,
                             _ => is_player
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
            Ok(format!("Successfully saved Fast Flags to {} installation.", if mode == "studio" { "Roblox Studio" } else { "Roblox Player" }))
        } else {
            // Return Ok even if not found to avoid noisy UI errors when only one component is installed
            Ok(format!("No {} installation found to patch.", if mode == "studio" { "Roblox Studio" } else { "Roblox Player" }))
        }
    }

    #[cfg(target_os = "macos")]
    {
        // MacOS Logic
         let mut potential_paths = Vec::new();
         potential_paths.push(PathBuf::from("/Applications/Roblox.app"));
         
         // Nullstrap managed
         if let Ok(data_dir) = app.path().app_local_data_dir() {
            potential_paths.push(data_dir.join("rblx-versions"));
         }

          let mut saved_any = false;
        
        for versions_path in potential_paths {
             if mode == "studio" {
                 // Not implementing standard Mac Studio path yet, focused on Player from user request
                 continue; 
             }
             
             // If searching in rblx-versions, search recursively
             if versions_path.to_string_lossy().contains("rblx-versions") {
                 if let Ok(entries) = fs::read_dir(&versions_path) {
                    for entry in entries.flatten() {
                        let path = entry.path();
                        if path.is_dir() {
                             // Check for RobloxPlayer.app
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
                 // Standard Application
                 // User provided path: RobloxPlayer.app/Contents/ClientSettings/ClientAppSettings.json
                 // But typically it's inside Applications/Roblox.app? 
                 // Assuming user meant inside the .app bundle
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
        // Sober: ~/.var/app/org.vinegarhq.Sober/config/sober/config.json
        // Vinegar: ~/.var/app/org.vinegarhq.Vinegar/config/vinegar/config.toml (Start)

        let home = dirs::home_dir().ok_or("Could not find home directory")?;
        
        if mode == "studio" {
            // Vinegar
            let config_path = home.join(".var/app/org.vinegarhq.Vinegar/config/vinegar/config.toml");
            if !config_path.exists() {
                return Err("Vinegar config not found".to_string());
            }

            // Parse TOML
            // We need to insert/update [fflags] table
            // This is complex string manipulation if we don't want to deserialize everything.
            // Using toml crate: Value
            let content = fs::read_to_string(&config_path).map_err(|e| e.to_string())?;
            let mut value: toml::Value = toml::from_str(&content).map_err(|e| e.to_string())?;
            
            // Parse new flags from JSON
            let new_flags: std::collections::HashMap<String, serde_json::Value> = serde_json::from_str(&flags_json).map_err(|e| e.to_string())?;

            // Convert serde Value to toml Value is tricky because types mismatch slightly (Numbers)
            // But we can construct a toml::Table
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
            
            // Assuming config.toml has `[fflags]`
            // If `value` is a Table, check for "fflags"
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
             let mut value: serde_json::Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;

             let new_settings: serde_json::Value = serde_json::from_str(&flags_json).map_err(|e| e.to_string())?;
             
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
            // Sober FFlags (default for "roblox" mode on Linux)
            let config_path = home.join(".var/app/org.vinegarhq.Sober/config/sober/config.json");
            if !config_path.exists() {
                 return Err("Sober config not found".to_string());
            }

             let content = fs::read_to_string(&config_path).map_err(|e| e.to_string())?;
             let mut value: serde_json::Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;

             let new_flags: serde_json::Value = serde_json::from_str(&flags_json).map_err(|e| e.to_string())?;
             
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

    let roblox_names = if cfg!(target_os = "windows") {
        vec!["RobloxPlayerBeta.exe"]
    } else if cfg!(target_os = "macos") {
        vec!["RobloxPlayer"]
    } else {
        vec!["RobloxPlayer"]
    };

    for process in system.processes().values() {
        let name = process.name().to_lowercase();
        for roblox_name in &roblox_names {
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
                                    log_files.push((path, metadata.modified().unwrap_or(std::time::SystemTime::UNIX_EPOCH)));
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
    
    let url = format!("https://clientsettings.roblox.com/v2/client-version/{}", binary_type);
    let res = client.get(url).send().map_err(|e| e.to_string())?;
    
    if !res.status().is_success() {
        return Err(format!("Failed to fetch version info: Status {}", res.status()));
    }

    let json: serde_json::Value = res.json().map_err(|e| e.to_string())?;
    json["clientVersionUpload"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Invalid version response".to_string())
}

#[tauri::command]
fn fetch_all_flags(mode: &str) -> Result<serde_json::Value, String> {
    // Determine URL based on mode
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

fn download_and_install(app: &tauri::AppHandle, version: &str, binary_type: &str) -> Result<PathBuf, String> {
    let data_dir = app.path().app_local_data_dir().map_err(|e| e.to_string())?;
    let versions_dir = data_dir.join("rblx-versions");
    
    // Cleanup old versions
    if versions_dir.exists() {
        if let Ok(entries) = fs::read_dir(&versions_dir) {
            for entry in entries.flatten() {
                 let path = entry.path();
                 if path.is_dir() {
                     if let Some(dir_name) = path.file_name() {
                         if dir_name != version {
                             let _ = fs::remove_dir_all(&path);
                         }
                     }
                 }
            }
        }
    }

    let exe_name = if binary_type == "WindowsStudio" { "RobloxStudioBeta.exe" } else { "RobloxPlayerBeta.exe" };
    let version_path = versions_dir.join(version);
    let exe_path = version_path.join(exe_name);

    // Check for existing installation and validate structure
    if exe_path.exists() {
        // Validate critical folders exist
        let has_content = version_path.join("content").join("fonts").exists();
        let has_ssl = version_path.join("ssl").exists();
        
        if has_content && has_ssl {
            // Repair AppSettings.xml if missing instead of re-downloading
            let settings_path = version_path.join("AppSettings.xml");
            if !settings_path.exists() && binary_type == "WindowsPlayer" {
                let settings_content = r#"<?xml version="1.0" encoding="UTF-8"?>
<Settings>
    <ContentFolder>content</ContentFolder>
    <BaseUrl>http://www.roblox.com</BaseUrl>
</Settings>"#;
                let _ = fs::write(settings_path, settings_content);
            }

            // Return cleaned path
            let path_str = exe_path.to_string_lossy().to_string();
            if path_str.starts_with(r"\\?\") {
                return Ok(PathBuf::from(&path_str[4..]));
            }
            return Ok(exe_path);
        } else {
            // missing components.
            let _ = app.emit("progress-update", ProgressPayload { status: "Updating installation...".into(), percent: 0 });
        }
    }
    
    let _ = app.emit("progress-update", ProgressPayload { status: "Starting download...".into(), percent: 0 });

    // Ensure directory exists
    if !version_path.exists() {
        let _ = fs::create_dir_all(&version_path);
    }

    // Download main package
    let (zip_name, url_prefix) = match binary_type {
        "WindowsStudio" => ("RobloxStudio.zip", "https://setup.rbxcdn.com"),
        "WindowsPlayer" => ("RobloxApp.zip", "https://setup.rbxcdn.com"),
        "MacStudio" => ("RobloxStudio.zip", "https://setup.rbxcdn.com/mac"),
        "MacPlayer" => ("RobloxPlayer.zip", "https://setup.rbxcdn.com/mac"),
        _ => ("RobloxApp.zip", "https://setup.rbxcdn.com"),
    };
    
    let download_url = format!("{}/{}-{}", url_prefix, version, zip_name);
    
    let client = reqwest::blocking::Client::new();
    let mut resp = client.get(&download_url).send().map_err(|e| e.to_string())?;
    
    if !resp.status().is_success() {
        return Err(format!("Download failed: {}", resp.status()));
    }
    
    let total_size = resp.content_length().unwrap_or(0);
    let mut downloaded: u64 = 0;
    let mut buffer = Vec::new();
    let mut chunk = [0; 8192];

    loop {
        let bytes_read = resp.read(&mut chunk).map_err(|e| e.to_string())?;
        if bytes_read == 0 {
            break;
        }
        buffer.extend_from_slice(&chunk[..bytes_read]);
        downloaded += bytes_read as u64;
        
        if total_size > 0 {
             let percent = (downloaded * 100) / total_size;
             if downloaded % (1024 * 1024) < 8192 {
                 let _ = app.emit("progress-update", ProgressPayload { 
                     status: format!("Downloading... {:.1} MB", downloaded as f64 / 1024.0 / 1024.0), 
                     percent 
                 });
             }
        }
    }

    let _ = app.emit("progress-update", ProgressPayload { status: "Extracting...".into(), percent: 100 });
    
    // Extract main package to version_path
    let reader = Cursor::new(buffer);
    let mut archive = ZipArchive::new(reader).map_err(|e| e.to_string())?;
    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        let outpath = match file.enclosed_name() {
            Some(path) => version_path.join(path),
            None => continue,
        };
        if (*file.name()).ends_with('/') {
            let _ = fs::create_dir_all(&outpath);
        } else {
            if let Some(p) = outpath.parent() { let _ = fs::create_dir_all(p); }
            if let Ok(mut outfile) = fs::File::create(&outpath) {
                let _ = std::io::copy(&mut file, &mut outfile);
            }
        }
    }
    
    // Windows: Download and extract additional packages
    #[cfg(target_os = "windows")]
    if binary_type == "WindowsPlayer" {
        let packages = vec![
            "WebView2.zip", "ssl.zip", "shaders.zip", "content-fonts.zip",
            "content-models.zip", "content-sky.zip", "content-sounds.zip",
            "content-textures2.zip", "content-textures3.zip", "content-terrain.zip",
            "content-configs.zip", "content-platform-fonts.zip",
            "content-platform-dictionaries.zip", "content-avatar.zip",
            "extracontent-places.zip", "extracontent-luapackages.zip",
            "extracontent-translations.zip", "extracontent-models.zip",
            "extracontent-textures.zip",
        ];

        for pkg in packages {
            let label = pkg.replace(".zip", "");
            let _ = app.emit("progress-update", ProgressPayload { 
                status: format!("Downloading {}...", label).into(), 
                percent: 0 
            });

            let pkg_url = format!("https://setup.rbxcdn.com/{}-{}", version, pkg);
            if let Ok(resp) = client.get(&pkg_url).send() {
                if resp.status().is_success() {
                    if let Ok(content) = resp.bytes() {
                        let reader = Cursor::new(content);
                        if let Ok(mut archive) = ZipArchive::new(reader) {
                            for i in 0..archive.len() {
                                if let Ok(mut file) = archive.by_index(i) {
                                    let name = file.name();
                                    if name.ends_with('/') { continue; }
                                    
                                    let mut entry_path = PathBuf::from(name);
                                    
                                    // Flatten WebView2.zip
                                    if pkg == "WebView2.zip" {
                                        if let Some(first) = entry_path.components().next() {
                                            if let std::path::Component::Normal(c) = first {
                                                if c.to_string_lossy().to_lowercase() == "webview2" {
                                                    entry_path = entry_path.iter().skip(1).collect();
                                                }
                                            }
                                        }
                                    }

                                    // For content packages, we extract into subfolders
                                    let target_dir = if pkg == "ssl.zip" {
                                        version_path.join("ssl")
                                    } else if pkg == "shaders.zip" {
                                        version_path.join("shaders")
                                    } else if pkg.starts_with("content-platform-") {
                                        version_path.join("PlatformContent").join("pc").join(pkg.replace("content-platform-", "").replace(".zip", ""))
                                    } else if pkg.starts_with("content-textures") {
                                        version_path.join("content").join("textures")
                                    } else if pkg.starts_with("content-") {
                                        version_path.join("content").join(pkg.replace("content-", "").replace(".zip", ""))
                                    } else if pkg.starts_with("extracontent-") {
                                        version_path.join("ExtraContent").join(pkg.replace("extracontent-", "").replace(".zip", ""))
                                    } else {
                                        version_path.clone()
                                    };

                                    // Verify double-nesting: if entry_path starts with target_dir's leaf name, strip it
                                    if let Some(target_leaf) = target_dir.file_name() {
                                        if let Some(first) = entry_path.components().next() {
                                            if let std::path::Component::Normal(c) = first {
                                                if c.to_string_lossy().to_lowercase() == target_leaf.to_string_lossy().to_lowercase() {
                                                    entry_path = entry_path.iter().skip(1).collect();
                                                }
                                            }
                                        }
                                    }

                                    let outpath = target_dir.join(entry_path);
                                    if let Some(p) = outpath.parent() { let _ = fs::create_dir_all(p); }
                                    if let Ok(mut outfile) = fs::File::create(&outpath) {
                                        let _ = std::io::copy(&mut file, &mut outfile);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Windows: Create critical files for launching
    #[cfg(target_os = "windows")]
    if binary_type == "WindowsPlayer" {
        // AppSettings.xml is required for launching RobloxPlayerBeta.exe --app
        let settings_path = version_path.join("AppSettings.xml");
        if !settings_path.exists() {
            let settings_content = r#"<?xml version="1.0" encoding="UTF-8"?>
<Settings>
    <ContentFolder>content</ContentFolder>
    <BaseUrl>http://www.roblox.com</BaseUrl>
</Settings>"#;
            let _ = fs::write(settings_path, settings_content);
        }

        // ClientSettings folder for Fast Flags
        let client_settings_path = version_path.join("ClientSettings");
        if !client_settings_path.exists() {
            let _ = fs::create_dir_all(client_settings_path);
        }
    }

    // Set permissions and clean up path
    let mut final_path = exe_path;
    let path_str = final_path.to_string_lossy().to_string();
    if path_str.starts_with(r"\\?\") {
        final_path = PathBuf::from(&path_str[4..]);
    }

    #[cfg(target_family = "unix")]
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


fn install_mods(version_path: &PathBuf, flags_json: String, skybox_path: String) -> Result<(), String> {
    // 1. Install Fast Flags
    if !flags_json.is_empty() && flags_json != "{}" {
        let client_settings = version_path.join("ClientSettings");
        if !client_settings.exists() {
            let _ = fs::create_dir_all(&client_settings);
        }
        let _ = fs::write(client_settings.join("ClientAppSettings.json"), &flags_json);
    }

    // 2. Install Skybox
    if !skybox_path.is_empty() {
        let sky_dir = version_path.join("PlatformContent").join("pc").join("textures").join("sky");
        if sky_dir.exists() {
             let source_path = PathBuf::from(&skybox_path);
             if source_path.exists() {
                  let copy_if_tex = |entry_path: PathBuf, target_folder: &PathBuf| -> Result<(), std::io::Error> {
                     if let Some(name) = entry_path.file_name() {
                         let name_str = name.to_string_lossy().to_lowercase();
                         if name_str.ends_with(".tex") || name_str.ends_with(".png") || name_str.ends_with(".jpg") {
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
    let _ = app.emit("progress-update", ProgressPayload { status: "Checking for updates...".into(), percent: 0 });

    let app_clone = app.clone();
    let res = tauri::async_runtime::spawn_blocking(move || {
        #[cfg(target_os = "macos")]
        let binary_type = "MacPlayer";
        #[cfg(not(target_os = "macos"))]
        let binary_type = "WindowsPlayer";

        let version = get_latest_version(binary_type)?;
        download_and_install(&app_clone, &version, binary_type)
    }).await.map_err(|e| e.to_string())??;
    
    let mut path_str = res.to_string_lossy().to_string();
    if path_str.starts_with(r"\\?\") {
        path_str = path_str[4..].to_string();
    }
    
    // Close progress window
    let _ = app.emit("progress-close", ());
    if let Some(win) = app.get_webview_window("progress") { let _ = win.close(); }
    
    Ok(path_str)
}

#[tauri::command]
async fn launch_roblox_executable(path: String) -> Result<(), String> {
    if path == "sober" {
        #[cfg(any(target_os = "windows", target_os = "linux"))]
        {
             Command::new("flatpak")
                .args(["run", "org.vinegarhq.Sober"])
                .spawn()
                .map_err(|e| e.to_string())?;
             return Ok(());
        }
        #[cfg(not(any(target_os = "windows", target_os = "linux")))]
        { return Err("Sober not supported on this OS".into()); }
    }

    let mut exe_path = PathBuf::from(&path);
    
    // Strip UNC prefix (\\?\) if present, as it confuses some apps and shell commands
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
        
        // Return to cmd /C start but with extremely robust quoting for 'start'
        let exe_str = exe_path.to_string_lossy();
        let dir_str = version_dir.to_string_lossy();

        Command::new("cmd")
            .args(["/C", "start", "", "/D", &dir_str, &exe_str, "--app"])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&exe_path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "linux")]
    {
        // On Linux, we assume 'path' might be a flatpak name or absolute path
        if path.contains("org.vinegarhq.Sober") {
             Command::new("flatpak")
                .args(["run", "org.vinegarhq.Sober"])
                .spawn()
                .map_err(|e| e.to_string())?;
        } else {
             Command::new(&exe_path)
                .spawn()
                .map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

#[tauri::command]
async fn launch_roblox(app: tauri::AppHandle, flags_json: String, skybox_path: String) -> Result<(), String> {
    show_progress_window(&app);
    let _ = app.emit("progress-update", ProgressPayload { status: "Checking for updates...".into(), percent: 0 });

    let app_clone = app.clone();
    
    tauri::async_runtime::spawn_blocking(move || {
        let res = (|| -> Result<(), String> {
            #[cfg(target_os = "windows")]
            {
                let version = get_latest_version("WindowsPlayer")?;
                let _ = app_clone.emit("progress-update", ProgressPayload { status: "Verifying installation...".into(), percent: 0 });
                let exe_path = download_and_install(&app_clone, &version, "WindowsPlayer")?;
                
                let version_dir = exe_path.parent().unwrap().to_path_buf();
                let _ = install_mods(&version_dir, flags_json, skybox_path);
        
                let _ = app_clone.emit("progress-update", ProgressPayload { status: "Launching...".into(), percent: 100 });

                let exe_str = exe_path.to_string_lossy().to_string();
                
                // Construct the command string again for safety in this scope
                let version_dir = exe_path.parent().unwrap();
                let dir_str = version_dir.to_string_lossy();
                
                // Use shell start for standard behavior
                Command::new("cmd")
                    .args(["/C", "start", "", "/D", &dir_str, &exe_str, "--app"])
                    .spawn()
                    .map_err(|e| e.to_string())?;
                    
                Ok(())
            }
            #[cfg(target_os = "linux")]
            {
                let _ = app_clone.emit("progress-update", ProgressPayload { status: "Launching Sober...".into(), percent: 100 });
                Command::new("flatpak")
                    .args(["run", "org.vinegarhq.Sober"])
                    .spawn()
                    .map_err(|e| e.to_string())?;
                Ok(())
            }
            #[cfg(target_os = "macos")]
            {
                let version = get_latest_version("MacPlayer")?;
                let _ = app_clone.emit("progress-update", ProgressPayload { status: "Verifying installation...".into(), percent: 0 });
                let exe_path = download_and_install(&app_clone, &version, "MacPlayer")?;
                let _ = app_clone.emit("progress-update", ProgressPayload { status: "Launching...".into(), percent: 100 });
                Command::new("open")
                    .arg(exe_path)
                    .spawn()
                    .map_err(|e| e.to_string())?;
                Ok(())
            }
            #[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
            {
                Err("Not supported on this OS".to_string())
            }
        })();

        // Delay closing slightly so user sees "Launching..."
        std::thread::sleep(std::time::Duration::from_millis(1500));
        let _ = app_clone.emit("progress-close", ());
        if let Some(win) = app_clone.get_webview_window("progress") { let _ = win.close(); }

        res
    }).await.map_err(|e| e.to_string())??;
    
    Ok(())
}

#[tauri::command]
async fn launch_studio(app: tauri::AppHandle) -> Result<(), String> {
    show_progress_window(&app);
    let _ = app.emit("progress-update", ProgressPayload { status: "Checking for updates...".into(), percent: 0 });

   let app_clone = app.clone();
   tauri::async_runtime::spawn_blocking(move || {
        let res = (|| -> Result<(), String> {
            #[cfg(target_os = "windows")]
            {
                let version = get_latest_version("WindowsStudio")?;
                let _ = app_clone.emit("progress-update", ProgressPayload { status: "Verifying installation...".into(), percent: 0 });
                let exe_path = download_and_install(&app_clone, &version, "WindowsStudio")?;
                
                let _ = app_clone.emit("progress-update", ProgressPayload { status: "Launching Studio...".into(), percent: 100 });
                
                let version_dir = exe_path.parent().unwrap();
                let mut final_exe = exe_path.clone();
                let fe_str = final_exe.to_string_lossy().to_string();
                if fe_str.starts_with(r"\\?\") {
                    final_exe = PathBuf::from(&fe_str[4..]);
                }

                // Standard studio launch
                std::process::Command::new(&final_exe)
                    .current_dir(version_dir)
                    .spawn()
                    .map_err(|e| e.to_string())?;
                
                Ok(())
            }
             #[cfg(target_os = "linux")]
            {
                 let _ = app_clone.emit("progress-update", ProgressPayload { status: "Launching Vinegar...".into(), percent: 100 });
                 Command::new("flatpak")
                    .args(["run", "org.vinegarhq.Vinegar"])
                    .spawn()
                    .map_err(|e| e.to_string())?;
                Ok(())
            }
            #[cfg(target_os = "macos")]
            {
                 let version = get_latest_version("MacStudio")?;
                 let _ = app_clone.emit("progress-update", ProgressPayload { status: "Verifying installation...".into(), percent: 0 });
                 let exe_path = download_and_install(&app_clone, &version, "MacStudio")?;
                 let _ = app_clone.emit("progress-update", ProgressPayload { status: "Launching Studio...".into(), percent: 100 });
                 Command::new("open")
                     .arg(exe_path)
                     .spawn()
                     .map_err(|e| e.to_string())?;
                 Ok(())
            }
            #[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
            {
                Err("Not supported on this OS".to_string())
            }
        })();

        // Delay closing slightly so user sees valid status
        std::thread::sleep(std::time::Duration::from_millis(1500));
        let _ = app_clone.emit("progress-close", ());
        if let Some(win) = app_clone.get_webview_window("progress") { let _ = win.close(); }

        res
   }).await.map_err(|e| e.to_string())??;

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
                                if now.duration_since(modified).unwrap_or(Duration::ZERO) > max_age {
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
        paths.push(format!("{}/.var/app/org.vinegarhq.Sober/data/sober/logs", home));
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
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            let _ = app.emit("single-instance", ()); 

            // If main window exists and is visible (settings open), focus it
            if let Some(main_window) = app.get_webview_window("main") {
                 if main_window.is_visible().unwrap_or(false) {
                     let _ = main_window.set_focus();
                     let _ = main_window.unminimize();
                     return;
                 }
            }

            // Otherwise, show/focus splash screen (or recreate if missing)
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
        }))
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
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
            // ensure main window is hidden on startup (overriding potential saved state)
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
            
            // Ensure splashscreen is visible
            if let Some(splash) = app.get_webview_window("splashscreen") {
                let _ = splash.show();
                let _ = splash.set_focus();
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
