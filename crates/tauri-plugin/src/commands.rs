//! The commands, `plugin:eisenhower|<name>` from the app: each passes its arguments to a function of
//! the crate, on a blocking thread, since each touches the disk.

use std::path::PathBuf;

use crate::{
    error::Error,
    files::{self, DocumentText},
};

/// Runs file work off the async runtime's threads.
pub(crate) async fn blocking<T: Send + 'static>(
    work: impl FnOnce() -> Result<T, Error> + Send + 'static,
) -> Result<T, Error> {
    tauri::async_runtime::spawn_blocking(work)
        .await
        .map_err(|error| Error::Internal {
            detail: error.to_string(),
        })?
}

/// The document's text and hash, or null when there is no file at `path`.
#[tauri::command]
pub async fn read_document(path: PathBuf) -> Result<Option<DocumentText>, Error> {
    blocking(move || files::read_document(&path)).await
}

/// Writes the document's text in one rename and answers its new hash; with `expectedHash`, only over
/// the file that hash was read from.
#[tauri::command]
pub async fn write_document(path: PathBuf, text: String, expected_hash: Option<String>) -> Result<String, Error> {
    blocking(move || files::write_document(&path, &text, expected_hash.as_deref())).await
}
