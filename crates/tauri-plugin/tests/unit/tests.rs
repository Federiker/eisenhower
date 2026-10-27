#[path = "commands.rs"]
mod commands;
#[path = "errors.rs"]
mod errors;
#[path = "files.rs"]
mod files;

use std::path::Path;

/// The names in a folder, sorted: to check that no temporary file is left behind.
fn names(folder: &Path) -> Vec<String> {
    let mut names: Vec<String> = std::fs::read_dir(folder)
        .unwrap()
        .map(|entry| entry.unwrap().file_name().to_string_lossy().into_owned())
        .collect();
    names.sort();
    names
}

/// A small board document, as `@eisenhower/model` writes one.
const BOARD: &str = "{\n  \"format\": \"eisenhower\",\n  \"kind\": \"board\",\n  \"version\": 1,\n  \"data\": {}\n}\n";
