use std::{
    fs,
    io::{self, Write},
    path::Path,
};

use serde::Serialize;
use sha2::{Digest, Sha256};
use tempfile::NamedTempFile;

use crate::error::Error;

/// A document's text, as it is on disk, and its hash.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct DocumentText {
    pub text: String,
    /// What a save quotes to show it still has the file it read: see [`hash`].
    pub hash: String,
}

/// The SHA-256 of a file's bytes, in lower-case hexadecimal (64 characters). For a document, the bytes
/// are its text's UTF-8, so this is the revision `@eisenhower/model`'s `textRevision` gives.
#[must_use]
pub fn hash(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

/// Refuses an empty path, which names no file.
fn require_path(path: &Path) -> Result<(), Error> {
    if path.as_os_str().is_empty() {
        Err(Error::invalid_request("the path is empty"))
    } else {
        Ok(())
    }
}

/// A file's bytes, or `None` when there is no file there (nor its folder).
fn bytes_if_any(path: &Path) -> Result<Option<Vec<u8>>, Error> {
    match fs::read(path) {
        Ok(bytes) => Ok(Some(bytes)),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(Error::read_failed(path, &error)),
    }
}

/// A document's text and hash, or `None` when there is no file at `path` (a document not saved yet is
/// not a failure).
///
/// # Errors
/// Returns `InvalidRequest` for an empty path, `ReadFailed` when the file cannot be read and `NotText`
/// when it is not UTF-8.
pub fn read_document(path: &Path) -> Result<Option<DocumentText>, Error> {
    require_path(path)?;
    let Some(bytes) = bytes_if_any(path)? else {
        return Ok(None);
    };
    let hash = hash(&bytes);
    let text = String::from_utf8(bytes).map_err(|_| Error::NotText {
        path: path.to_path_buf(),
    })?;
    Ok(Some(DocumentText { text, hash }))
}

/// Fails with `ChangedOnDisk` unless the file is still the one whose hash the app quoted; a file that
/// is no longer there has changed.
fn check_unchanged(path: &Path, expected: &str) -> Result<(), Error> {
    let actual = bytes_if_any(path)?.map(|bytes| hash(&bytes));
    if actual.as_deref() == Some(expected) {
        Ok(())
    } else {
        Err(Error::ChangedOnDisk {
            path: path.to_path_buf(),
            expected: expected.to_owned(),
            actual,
        })
    }
}

/// Writes a document's text and returns its new hash. The text goes to a temporary file in the same
/// folder, which then replaces the document in one rename, so the file on disk is always either the
/// old document or the new one, never half of each. The folder must exist: a save never creates
/// folders, so a path whose folder has gone (a removed drive, a renamed folder) fails rather than
/// writing somewhere the user did not choose.
///
/// With `expected_hash` (the hash [`read_document`] or the last write gave), the file must still be the
/// one the app read: it is checked before writing and again just before the rename, and if another
/// program changed or removed it in between nothing is written (`ChangedOnDisk`). Without it, the file
/// is written whatever is there (a new file, Save As, or the user choosing to overwrite).
///
/// # Errors
/// Returns `InvalidRequest` for an empty path, `ChangedOnDisk`, `ReadFailed` (the file could not be
/// checked) or `WriteFailed`; the file is as it was after any of them.
pub fn write_document(path: &Path, text: &str, expected_hash: Option<&str>) -> Result<String, Error> {
    require_path(path)?;
    if let Some(expected) = expected_hash {
        check_unchanged(path, expected)?;
    }
    write_atomically(path, text.as_bytes(), || {
        expected_hash.map_or(Ok(()), |expected| check_unchanged(path, expected))
    })?;
    Ok(hash(text.as_bytes()))
}

/// Writes `bytes` to a temporary file beside `path`, calls `check`, then renames the temporary file
/// over `path`. The temporary file is removed if anything fails.
pub(crate) fn write_atomically(
    path: &Path,
    bytes: &[u8],
    check: impl FnOnce() -> Result<(), Error>,
) -> Result<(), Error> {
    let folder = match path.parent() {
        Some(parent) if !parent.as_os_str().is_empty() => parent,
        _ => Path::new("."),
    };
    let name = path
        .file_name()
        .map_or_else(Default::default, |name| name.to_string_lossy());
    let failed = |error: &io::Error| Error::write_failed(path, error);
    let prefix = format!(".{name}.");
    let mut builder = tempfile::Builder::new();
    builder.prefix(&prefix).suffix(".tmp");
    // Readable as an ordinary new file is (the umask applies), not only by its owner.
    #[cfg(unix)]
    builder.permissions(std::os::unix::fs::PermissionsExt::from_mode(0o666));
    let mut temporary: NamedTempFile = builder.tempfile_in(folder).map_err(|error| failed(&error))?;
    temporary.write_all(bytes).map_err(|error| failed(&error))?;
    temporary.as_file().sync_all().map_err(|error| failed(&error))?;
    // A file being replaced keeps its permissions. (Windows has only the read-only flag, and a read-only
    // file is refused by the rename anyway.)
    #[cfg(unix)]
    if let Ok(metadata) = fs::metadata(path) {
        fs::set_permissions(temporary.path(), metadata.permissions()).map_err(|error| failed(&error))?;
    }
    check()?;
    temporary.persist(path).map_err(|error| failed(&error.error))?;
    Ok(())
}
