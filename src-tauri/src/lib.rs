use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::TrayIconBuilder,
    AppHandle, Manager,
};
use tauri_plugin_drpc;
use sysinfo::System;

// greet command
// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
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

// save fast flags
#[tauri::command]
fn save_fast_flags(_flags_json: String) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        use std::fs;
        use std::path::PathBuf;

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

        let mut saved_any = false;
        let mut searched_locations = Vec::new();

        for versions_path in potential_paths {
            searched_locations.push(versions_path.to_string_lossy().to_string());
            if !versions_path.exists() {
                continue;
            }

            if let Ok(entries) = fs::read_dir(versions_path) {
                for entry in entries {
                    if let Ok(entry) = entry {
                        let path = entry.path();
                        if path.is_dir() && path.join("RobloxPlayerBeta.exe").exists() {
                            let client_settings_dir = path.join("ClientSettings");
                            if !client_settings_dir.exists() {
                                if let Err(_) = fs::create_dir(&client_settings_dir) {
                                    continue;
                                }
                            }

                            let file_path = client_settings_dir.join("ClientAppSettings.json");
                            if let Ok(_) = fs::write(file_path, &_flags_json) {
                                saved_any = true;
                            }
                        }
                    }
                }
            }
        }

        if saved_any {
            Ok("Successfully saved Fast Flags to Roblox installation.".to_string())
        } else {
            Err(format!(
                "Could not find valid Roblox installation folder. Searched: {:?}",
                searched_locations
            ))
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("Fast Flag saving is only implemented for Windows currently.".to_string())
    }
}

// log to console
#[tauri::command]
fn log_to_console(message: String) {
    println!("{}", message);
}

#[tauri::command]
fn set_beam_sync(enable: bool) {
    println!("RUST: set_beam_sync called with enable: {}", enable);
    #[cfg(target_os = "macos")]
    unsafe {
        #[link(name = "CoreGraphics", kind = "framework")]
        extern "C" {
            fn CGSSetDebugOptions(options: i32);
            fn CGSGetDebugOptions(options: *mut i32);
        }

        const K_CGS_DISABLE_BEAM_SYNC: i32 = 0x00080000;

        let mut options: i32 = 0;
        CGSGetDebugOptions(&mut options);
        println!("RUST: Current CGS debug options: {:#010x}", options);

        if enable {
            println!("RUST: Enabling Beam Sync (clearing 0x00080000 bit)");
            options &= !K_CGS_DISABLE_BEAM_SYNC;
        } else {
            println!("RUST: Disabling Beam Sync (setting 0x00080000 bit)");
            options |= K_CGS_DISABLE_BEAM_SYNC;
        }

        println!("RUST: New CGS debug options: {:#010x}", options);
        CGSSetDebugOptions(options);
    }
    #[cfg(not(target_os = "macos"))]
    {
        println!("RUST: set_beam_sync not supported on this platform");
        let _ = enable;
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
        use std::fs;

        let mut log_dir = dirs::data_local_dir()?;
        log_dir.push("Roblox");
        log_dir.push("logs");

        println!("Log dir: {:?}", log_dir);
        if !log_dir.exists() {
            println!("Log dir does not exist");
            return None;
        }

        let mut log_files = Vec::new();
        for entry in fs::read_dir(log_dir).ok()? {
            let entry = entry.ok()?;
            let path = entry.path();
            if path.is_file() {
                if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
                    if file_name.ends_with(".log") {
                        println!("Found log file: {}", file_name);
                        if let Ok(metadata) = entry.metadata() {
                            log_files.push((path, metadata.modified().unwrap_or(std::time::SystemTime::UNIX_EPOCH)));
                        }
                    }
                }
            }
        }

        println!("Found {} log files", log_files.len());
        log_files.sort_by(|a, b| b.1.cmp(&a.1));

        for (path, _) in log_files {
            if let Ok(content) = fs::read_to_string(&path) {
                for line in content.lines().rev() {
                    if line.contains("Joining game") {
                        println!("Found joining line: {}", line);
                        let re = regex::Regex::new(r"place (\d+)").ok()?;
                        if let Some(captures) = re.captures(line) {
                            if let Some(place_id) = captures.get(1) {
                                println!("Extracted place ID: {}", place_id.as_str());
                                return Some(place_id.as_str().to_string());
                            }
                        } else {
                            // Return the line for debugging
                            return Some(line.to_string());
                        }
                    }
                }
            } else {
                println!("Failed to read log file: {:?}", path);
            }
        }
        println!("No place ID found");
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

pub fn create_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let show_i = MenuItemBuilder::with_id("show", "Show Window").build(app)?;
    let quit_i = MenuItemBuilder::with_id("quit", "Quit").build(app)?;

    let menu = MenuBuilder::new(app).items(&[&show_i, &quit_i]).build()?;

    TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone()) // or load your own .ico/.png
        .menu(&menu)
        .on_menu_event(move |app, event| match event.id().as_ref() {
            "show" => {
                // try splashscreen first as it's the primary launcher ui
                if let Some(window) = app.get_webview_window("splashscreen") {
                    let _ = window.show();
                    let _ = window.set_focus();
                } else if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .build(app)?;

    Ok(())
}

// run application
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_drpc::init())
        .setup(|app| {
            let splash_builder = tauri::WebviewWindowBuilder::new(
                app,
                "splashscreen",
                tauri::WebviewUrl::App("splashscreen.html".into()),
            )
            .inner_size(850.0, 450.0)
            .center()
            .title("nullstrap");

            #[cfg(target_os = "linux")]
            let splash_builder = splash_builder.decorations(false).transparent(false);

            #[cfg(not(target_os = "linux"))]
            let splash_builder = splash_builder.decorations(false).transparent(true);

            println!("Creating splashscreen window...");
            splash_builder.build()?;

            let main_builder = tauri::WebviewWindowBuilder::new(
                app,
                "main",
                tauri::WebviewUrl::App("index.html".into()),
            )
            .inner_size(800.0, 600.0)
            .visible(false)
            .title("nullstrap");

            #[cfg(target_os = "linux")]
            let main_builder = main_builder.decorations(false).transparent(false);

            #[cfg(not(target_os = "linux"))]
            let main_builder = main_builder.decorations(false).transparent(true);

            println!("Creating main window...");
            main_builder.build()?;

            // setup window attributes
            #[cfg(target_os = "windows")]
            {
                use raw_window_handle::{HasWindowHandle, RawWindowHandle};
                use windows::Win32::Foundation::HWND;
                use windows::Win32::Graphics::Dwm::{
                    DwmSetWindowAttribute, DWMWA_WINDOW_CORNER_PREFERENCE, DWMWCP_DONOTROUND,
                    DWM_WINDOW_CORNER_PREFERENCE,
                };

                for label in ["main", "splashscreen"] {
                    if let Some(window) = app.get_webview_window(label) {
                        if let Ok(handle) = window.window_handle() {
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
            }
            let _ = create_tray(app.handle());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            apply_square_corners,
            save_fast_flags,
            log_to_console,
            set_beam_sync,
            is_roblox_running,
            get_current_place_id,
            get_roblox_game_name
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
