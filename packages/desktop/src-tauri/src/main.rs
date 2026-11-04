// No console window behind the app in a release build on Windows.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

/// The desktop app: its window is the Vite app in `packages/desktop`, with Eisenhower's plugin for documents on
/// disk, and Tauri's dialog plugin for choosing files and asking before something is lost.
#[expect(clippy::expect_used, reason = "the app cannot run if Tauri does not start")]
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_eisenhower::init())
        .run(tauri::generate_context!())
        .expect("failed to run Eisenhower");
}
