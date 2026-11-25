use crate::launch;

/// The desktop app: its window is the Vite app in `packages/desktop`, with Eisenhower's plugin for documents on
/// disk, Tauri's dialog plugin for choosing files and asking before something is lost, and one app at a time: a
/// document double-clicked (an `.ike` file) opens in the window already there.
///
/// # Panics
///
/// When Tauri cannot start the app.
#[expect(clippy::expect_used, reason = "the app cannot run if Tauri does not start")]
pub fn run() {
    tauri::Builder::default()
        // One Eisenhower at a time: a second launch (a double-clicked document) hands its arguments here and quits.
        // The plugin must be the first registered.
        .plugin(tauri_plugin_single_instance::init(|app, arguments, cwd| {
            launch::second_launch(app, &arguments, &cwd);
        }))
        // The document the app was started with, kept until the window takes it.
        .manage(launch::LaunchFiles::default())
        .setup(|app| {
            // A document the app was opened with (Windows and Linux): the first argument it opens. Without a working
            // folder, a relative argument is taken as it is.
            if let Some(path) =
                launch::launch_file_argument(std::env::args(), &std::env::current_dir().unwrap_or_default())
            {
                launch::deliver(app.handle(), &path);
            }
            Ok(())
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_eisenhower::init())
        .invoke_handler(tauri::generate_handler![launch::launch_file_take])
        .build(tauri::generate_context!())
        .expect("failed to build Eisenhower")
        .run(|_app, _event| {
            // macOS gives the documents it opens the app with as an event, at start and while it runs.
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Opened { urls } = &_event
                && let Some(path) = launch::launch_file_url(urls)
            {
                launch::deliver(_app, &path);
            }
        });
}
