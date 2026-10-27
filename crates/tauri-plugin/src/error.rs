use std::{fmt, path::PathBuf};

use serde::{Serialize, Serializer, ser::SerializeMap};

/// What a command could not do. It reaches the app as `{ code, params }`: a stable code for the app to
/// translate and the values its message needs (`detail` is the operating system's own words, for logs).
#[derive(Debug)]
pub enum Error {
    /// The document could not be read (or checked before a save).
    ReadFailed { path: PathBuf, detail: String },
    /// The file is not UTF-8 text, so it cannot be a document.
    NotText { path: PathBuf },
    /// The document could not be written; the file on disk is as it was.
    WriteFailed { path: PathBuf, detail: String },
    /// The file changed on disk since the app read it (its hash is not the one the app quoted, or it is
    /// no longer there: `actual` is then `None`); nothing was written.
    ChangedOnDisk {
        path: PathBuf,
        expected: String,
        actual: Option<String>,
    },
    /// The command's arguments could not be used (an empty path).
    InvalidRequest { detail: String },
    /// The work could not be finished (its thread stopped).
    Internal { detail: String },
}

impl Error {
    pub(crate) fn read_failed(path: impl Into<PathBuf>, error: &impl fmt::Display) -> Self {
        Self::ReadFailed {
            path: path.into(),
            detail: error.to_string(),
        }
    }

    pub(crate) fn write_failed(path: impl Into<PathBuf>, error: &impl fmt::Display) -> Self {
        Self::WriteFailed {
            path: path.into(),
            detail: error.to_string(),
        }
    }

    pub(crate) fn invalid_request(detail: impl Into<String>) -> Self {
        Self::InvalidRequest { detail: detail.into() }
    }

    /// Stable code for the app to translate.
    #[must_use]
    pub const fn code(&self) -> &'static str {
        match self {
            Self::ReadFailed { .. } => "read_failed",
            Self::NotText { .. } => "not_text",
            Self::WriteFailed { .. } => "write_failed",
            Self::ChangedOnDisk { .. } => "changed_on_disk",
            Self::InvalidRequest { .. } => "invalid_request",
            Self::Internal { .. } => "internal",
        }
    }
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::ReadFailed { path, detail } => write!(f, "{} could not be read: {detail}.", path.display()),
            Self::NotText { path } => write!(f, "{} is not UTF-8 text.", path.display()),
            Self::WriteFailed { path, detail } => write!(f, "{} could not be written: {detail}.", path.display()),
            Self::ChangedOnDisk { path, .. } => write!(
                f,
                "{} changed on disk since it was read; nothing was written.",
                path.display()
            ),
            Self::InvalidRequest { detail } => write!(f, "The request could not be used: {detail}."),
            Self::Internal { detail } => write!(f, "The work could not be finished: {detail}."),
        }
    }
}

impl std::error::Error for Error {}

/// The parameters of an error.
struct Params<'a>(&'a Error);

impl Serialize for Params<'_> {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        match self.0 {
            Error::ReadFailed { path, detail } | Error::WriteFailed { path, detail } => {
                let mut map = serializer.serialize_map(Some(2))?;
                map.serialize_entry("path", &path.to_string_lossy())?;
                map.serialize_entry("detail", detail)?;
                map.end()
            }
            Error::NotText { path } => {
                let mut map = serializer.serialize_map(Some(1))?;
                map.serialize_entry("path", &path.to_string_lossy())?;
                map.end()
            }
            Error::ChangedOnDisk { path, expected, actual } => {
                let mut map = serializer.serialize_map(Some(3))?;
                map.serialize_entry("path", &path.to_string_lossy())?;
                map.serialize_entry("expectedHash", expected)?;
                map.serialize_entry("actualHash", actual)?;
                map.end()
            }
            Error::InvalidRequest { detail } | Error::Internal { detail } => {
                let mut map = serializer.serialize_map(Some(1))?;
                map.serialize_entry("detail", detail)?;
                map.end()
            }
        }
    }
}

impl Serialize for Error {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut map = serializer.serialize_map(Some(2))?;
        map.serialize_entry("code", self.code())?;
        map.serialize_entry("params", &Params(self))?;
        map.end()
    }
}
