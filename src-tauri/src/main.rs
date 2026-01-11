// prevents additional console window on windows in release, do not remove!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // run application
    cross_platform_rblx_bootstrapper_lib::run()
}
