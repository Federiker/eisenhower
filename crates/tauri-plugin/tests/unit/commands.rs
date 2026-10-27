use std::fs;

use tauri::{
    async_runtime::block_on,
    test::{mock_builder, mock_context, noop_assets},
};

use super::{BOARD, names};
use crate::{DocumentText, commands, hash};

#[test]
fn the_plugin_registers_in_an_app() {
    mock_builder()
        .plugin(crate::init())
        .build(mock_context(noop_assets()))
        .unwrap();
}

#[test]
fn the_document_commands_read_and_write_with_the_hash() {
    let folder = tempfile::tempdir().unwrap();
    let path = folder.path().join("plan.json");

    assert_eq!(block_on(commands::read_document(path.clone())).unwrap(), None);
    let first = block_on(commands::write_document(path.clone(), BOARD.to_owned(), None)).unwrap();
    assert_eq!(first, hash(BOARD.as_bytes()));
    assert_eq!(
        block_on(commands::read_document(path.clone())).unwrap(),
        Some(DocumentText {
            text: BOARD.to_owned(),
            hash: first.clone(),
        })
    );

    let second = block_on(commands::write_document(
        path.clone(),
        "{}\n".to_owned(),
        Some(first.clone()),
    ))
    .unwrap();
    assert_eq!(second, hash(b"{}\n"));
    let error = block_on(commands::write_document(path.clone(), "[]".to_owned(), Some(first))).unwrap_err();
    assert_eq!(error.code(), "changed_on_disk");
    assert_eq!(fs::read_to_string(&path).unwrap(), "{}\n");
    assert_eq!(names(folder.path()), ["plan.json"]);
}

#[test]
fn a_stopped_thread_is_an_internal_error() {
    let error = block_on(commands::blocking::<()>(|| panic!("stopped"))).unwrap_err();
    assert_eq!(error.code(), "internal");
}
