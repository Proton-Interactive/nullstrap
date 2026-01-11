use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::TrayIconBuilder,
    AppHandle, Manager,
};

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
        .setup(|app| {
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
            save_fast_flags
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
