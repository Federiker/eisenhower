use std::fs;

use super::{BOARD, names};
use crate::{DocumentText, Error, files::write_atomically, hash, read_document, write_document};

const EMPTY_HASH: &str = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

#[test]
fn the_hash_is_sha256_in_lower_case_hexadecimal() {
    assert_eq!(hash(b""), EMPTY_HASH);
    assert_eq!(
        hash(b"abc"),
        "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
    // The hash of the text's UTF-8, as `textRevision` in @eisenhower/model gives it.
    assert_eq!(
        hash("Größe ✓".as_bytes()),
        "61f1f25930ccaf63003cc3660715574dec957203fc4b333f9a573d5358f5a49b"
    );
}

#[test]
fn a_document_is_read_with_its_hash() {
    let folder = tempfile::tempdir().unwrap();
    let path = folder.path().join("plan.json");
    fs::write(&path, BOARD).unwrap();
    assert_eq!(
        read_document(&path).unwrap(),
        Some(DocumentText {
            text: BOARD.to_owned(),
            hash: hash(BOARD.as_bytes()),
        })
    );

    let empty = folder.path().join("empty.json");
    fs::write(&empty, b"").unwrap();
    assert_eq!(read_document(&empty).unwrap().unwrap().hash, EMPTY_HASH);
}

#[test]
fn a_missing_document_is_none_rather_than_an_error() {
    let folder = tempfile::tempdir().unwrap();
    assert_eq!(read_document(&folder.path().join("missing.json")).unwrap(), None);
    assert_eq!(read_document(&folder.path().join("missing/plan.json")).unwrap(), None);
}

#[test]
fn a_file_that_is_not_text_or_cannot_be_read_is_an_error() {
    let folder = tempfile::tempdir().unwrap();
    let path = folder.path().join("picture.json");
    fs::write(&path, [0xff, 0xfe, 0x00]).unwrap();
    let error = read_document(&path).unwrap_err();
    assert!(
        matches!(&error, Error::NotText { path: named } if named == &path),
        "{error:?}"
    );

    // A folder where the document should be.
    let taken = folder.path().join("taken.json");
    fs::create_dir(&taken).unwrap();
    assert_eq!(read_document(&taken).unwrap_err().code(), "read_failed");
}

#[test]
fn an_empty_path_is_refused() {
    assert_eq!(read_document("".as_ref()).unwrap_err().code(), "invalid_request");
    assert_eq!(
        write_document("".as_ref(), "{}", None).unwrap_err().code(),
        "invalid_request"
    );
}

#[test]
fn a_new_document_is_written_without_a_hash() {
    let folder = tempfile::tempdir().unwrap();
    let path = folder.path().join("Größe ✓.json");
    let written = write_document(&path, BOARD, None).unwrap();
    assert_eq!(written, hash(BOARD.as_bytes()));
    assert_eq!(fs::read_to_string(&path).unwrap(), BOARD);
    assert_eq!(names(folder.path()), ["Größe ✓.json"]);

    // Without a hash, whatever is there is replaced (Save As).
    fs::write(&path, b"changed elsewhere").unwrap();
    write_document(&path, "second", None).unwrap();
    assert_eq!(fs::read_to_string(&path).unwrap(), "second");
}

#[test]
fn a_document_changed_on_disk_is_not_overwritten() {
    let folder = tempfile::tempdir().unwrap();
    let path = folder.path().join("plan.json");
    let first = write_document(&path, "first", None).unwrap();
    let second = write_document(&path, "second", Some(&first)).unwrap();
    assert_eq!(fs::read_to_string(&path).unwrap(), "second");

    // Another program saved it after we read it.
    fs::write(&path, b"theirs").unwrap();
    let error = write_document(&path, "ours", Some(&second)).unwrap_err();
    let Error::ChangedOnDisk {
        path: changed,
        expected,
        actual,
    } = &error
    else {
        panic!("{error:?}");
    };
    assert_eq!(changed, &path);
    assert_eq!(expected, &second);
    assert_eq!(actual.as_deref(), Some(hash(b"theirs").as_str()));
    assert_eq!(fs::read_to_string(&path).unwrap(), "theirs");
    assert_eq!(names(folder.path()), ["plan.json"]);
}

#[test]
fn a_document_removed_since_it_was_read_has_changed() {
    let folder = tempfile::tempdir().unwrap();
    let path = folder.path().join("plan.json");
    for expected in [hash(b"read before"), EMPTY_HASH.to_owned()] {
        let error = write_document(&path, "ours", Some(&expected)).unwrap_err();
        assert!(matches!(&error, Error::ChangedOnDisk { actual: None, .. }), "{error:?}");
    }
    assert!(!path.exists());
    assert_eq!(names(folder.path()), Vec::<String>::new());
}

#[test]
fn a_change_while_writing_is_caught_before_the_rename() {
    let folder = tempfile::tempdir().unwrap();
    let path = folder.path().join("plan.json");
    fs::write(&path, b"before").unwrap();
    let error = write_atomically(&path, b"ours", || {
        Err(Error::ChangedOnDisk {
            path: path.clone(),
            expected: String::new(),
            actual: None,
        })
    })
    .unwrap_err();
    assert_eq!(error.code(), "changed_on_disk");
    assert_eq!(fs::read_to_string(&path).unwrap(), "before");
    assert_eq!(names(folder.path()), ["plan.json"]);
}

#[test]
fn a_document_in_a_missing_folder_or_unreadable_is_an_error() {
    let folder = tempfile::tempdir().unwrap();
    // No folder is created for a save.
    let error = write_document(&folder.path().join("missing/plan.json"), "x", None).unwrap_err();
    assert_eq!(error.code(), "write_failed");
    assert!(!folder.path().join("missing").exists());

    // A folder where the document should be: its hash cannot be checked, and it cannot be replaced.
    let taken = folder.path().join("taken.json");
    fs::create_dir(&taken).unwrap();
    assert_eq!(
        write_document(&taken, "x", Some(EMPTY_HASH)).unwrap_err().code(),
        "read_failed"
    );
    assert_eq!(write_document(&taken, "x", None).unwrap_err().code(), "write_failed");
    assert_eq!(names(folder.path()), ["taken.json"]);
}

#[test]
fn a_relative_path_is_written_in_the_current_folder() {
    let name = format!("eisenhower-relative-{}.json", std::process::id());
    let path = std::path::Path::new(&name);
    write_document(path, "here", None).unwrap();
    assert_eq!(fs::read_to_string(path).unwrap(), "here");
    fs::remove_file(path).unwrap();
}
