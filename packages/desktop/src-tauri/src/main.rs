// No console window behind the app in a release build on Windows.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

/// The desktop app: see `eisenhower_desktop_lib::run`.
fn main() {
    eisenhower_desktop_lib::run();
}
