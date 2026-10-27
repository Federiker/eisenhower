use tauri::{
    Runtime,
    plugin::{Builder, TauriPlugin},
};

use crate::commands;

/// The plugin's name: its commands are `plugin:eisenhower|<command>` and its permissions `eisenhower:…`.
const NAME: &str = "eisenhower";

/// The plugin: `.plugin(tauri_plugin_eisenhower::init())`. It keeps no state and needs no setup.
#[must_use]
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new(NAME)
        .invoke_handler(tauri::generate_handler![
            commands::read_document,
            commands::write_document
        ])
        .build()
}
