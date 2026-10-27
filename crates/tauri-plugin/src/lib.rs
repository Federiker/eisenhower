mod commands;
mod error;
mod files;
mod plugin;

pub use error::Error;
pub use files::{DocumentText, hash, read_document, write_document};
pub use plugin::init;

#[cfg(test)]
#[path = "../tests/unit/tests.rs"]
mod tests;
