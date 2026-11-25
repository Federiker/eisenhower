//! A document given to the app when it starts or while it runs: an `.ike` file (or a `.json` document saved before
//! `.ike`) double-clicked or opened with Eisenhower. It arrives as an argument (Windows and Linux; a second
//! launch's, through the single-instance plugin) or, on macOS, as `RunEvent::Opened`. It is kept until the window
//! takes it; once the window has, a later one is sent as an event. Jerome's `launch_file.rs`, adapted: one kind of
//! file, given to the window as its path, which the window opens as Open… does (and says why when it cannot).

use std::{
    path::{Path, PathBuf},
    sync::{Mutex, MutexGuard, PoisonError},
};

use tauri::{AppHandle, Emitter, Manager, Runtime, State, Url};

/// The event a document given while the window is listening arrives by, with its path.
pub const LAUNCH_FILE_EVENT: &str = "eisenhower://launch-file";

/// The extensions of the documents the app opens: its own, and the `.json` it saved before.
pub const DOCUMENT_EXTENSIONS: [&str; 2] = ["ike", "json"];

/// Whether a path names a document the app opens, by its extension, ignoring case.
fn is_document(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| {
            DOCUMENT_EXTENSIONS
                .iter()
                .any(|known| extension.eq_ignore_ascii_case(known))
        })
}

/// One argument as a path: a `file://` URL's, or the argument itself, relative to `cwd` when it is relative.
fn argument_path(argument: &str, cwd: &Path) -> Option<PathBuf> {
    let path = if argument
        .get(..7)
        .is_some_and(|scheme| scheme.eq_ignore_ascii_case("file://"))
    {
        Url::parse(argument).ok()?.to_file_path().ok()?
    } else {
        PathBuf::from(argument)
    };
    Some(if path.is_relative() { cwd.join(path) } else { path })
}

/// The document among a launch's arguments (the program's own path first, which is skipped): the first that is
/// not a flag and ends `.ike` or `.json`. Relative paths are taken from `cwd`, the launch's working folder.
#[must_use]
pub fn launch_file_argument<I, S>(arguments: I, cwd: &Path) -> Option<PathBuf>
where
    I: IntoIterator<Item = S>,
    S: AsRef<str>,
{
    arguments
        .into_iter()
        .skip(1)
        .filter(|argument| !argument.as_ref().starts_with('-'))
        .filter_map(|argument| argument_path(argument.as_ref(), cwd))
        .find(|path| is_document(path))
}

/// The document among the URLs macOS opens the app with (`RunEvent::Opened`): the first local `.ike` or `.json`.
#[cfg_attr(
    not(target_os = "macos"),
    allow(dead_code, reason = "only macOS opens the app with URLs")
)]
#[must_use]
pub fn launch_file_url(urls: &[Url]) -> Option<PathBuf> {
    urls.iter()
        .filter(|url| url.scheme() == "file")
        .filter_map(|url| url.to_file_path().ok())
        .find(|path| is_document(path))
}

#[derive(Debug, Default)]
struct Waiting {
    /// The document not yet taken by the window; a later one replaces it.
    path: Option<String>,
    /// The window has taken what was waiting: later documents go to it as events.
    listening: bool,
}

/// The document given to the app, kept until the window takes it.
#[derive(Debug, Default)]
pub struct LaunchFiles {
    waiting: Mutex<Waiting>,
}

impl LaunchFiles {
    fn lock(&self) -> MutexGuard<'_, Waiting> {
        self.waiting.lock().unwrap_or_else(PoisonError::into_inner)
    }

    /// A document has arrived: kept until the window takes it, or given back to be sent when the window listens.
    pub fn arrive(&self, path: String) -> Option<String> {
        let mut waiting = self.lock();
        if waiting.listening {
            Some(path)
        } else {
            waiting.path = Some(path);
            None
        }
    }

    /// Keeps a document that could not be sent, for the window to take.
    pub fn keep(&self, path: String) {
        self.lock().path = Some(path);
    }

    /// The document waiting, once (then nothing); from now on later ones are sent as events.
    pub fn take(&self) -> Option<String> {
        let mut waiting = self.lock();
        waiting.listening = true;
        waiting.path.take()
    }
}

/// Keeps a document given to the app for the window, or sends it there when the window listens. One that could
/// not be sent is kept, so the window's next take has it. A path that is not Unicode is given as near as it can
/// be, and opening it then says it is not there.
pub fn deliver<R: Runtime>(app: &AppHandle<R>, path: &Path) {
    let files = app.state::<LaunchFiles>();
    if let Some(path) = files.arrive(path.to_string_lossy().into_owned())
        && app.emit(LAUNCH_FILE_EVENT, &path).is_err()
    {
        files.keep(path);
    }
}

/// A second launch's arguments (the single-instance plugin's callback): the window comes to the front, and the
/// document among them, if any, is opened.
pub fn second_launch<R: Runtime>(app: &AppHandle<R>, arguments: &[String], cwd: &str) {
    if let Some(window) = app.get_webview_window("main") {
        // Each step is a request to the system, which may decline it (Windows lets a program take the focus only
        // in some cases); the window is there whatever it does.
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
    if let Some(path) = launch_file_argument(arguments, Path::new(cwd)) {
        deliver(app, &path);
    }
}

/// The window's take of the document the app was given: its path once, then nothing.
#[allow(clippy::needless_pass_by_value)] // Tauri gives a command its state by value.
#[tauri::command]
#[must_use]
pub fn launch_file_take(files: State<'_, LaunchFiles>) -> Option<String> {
    files.take()
}
