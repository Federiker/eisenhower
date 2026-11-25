use std::{
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
};

use tauri::{
    App, Listener, Manager, Url,
    test::{MockRuntime, mock_builder, mock_context, noop_assets},
};

use crate::launch::{
    DOCUMENT_EXTENSIONS, LAUNCH_FILE_EVENT, LaunchFiles, deliver, launch_file_argument, launch_file_take,
    launch_file_url, second_launch,
};

/// An app on the mock runtime, keeping the documents it is given as the desktop app does.
fn app() -> App<MockRuntime> {
    mock_builder()
        .manage(LaunchFiles::default())
        .build(mock_context(noop_assets()))
        .unwrap()
}

/// The paths sent to the window as events, as they arrive.
fn listened(app: &App<MockRuntime>) -> Arc<Mutex<Vec<String>>> {
    let heard = Arc::new(Mutex::new(Vec::new()));
    let into = Arc::clone(&heard);
    app.listen(LAUNCH_FILE_EVENT, move |event| {
        into.lock()
            .unwrap()
            .push(serde_json::from_str::<String>(event.payload()).unwrap());
    });
    heard
}

#[test]
fn the_documents_are_ike_files_and_the_json_ones_saved_before() {
    assert_eq!(DOCUMENT_EXTENSIONS, ["ike", "json"]);
}

#[test]
fn a_launch_gives_its_first_document_argument_relative_to_its_folder() {
    let cwd = Path::new("plans");
    let arguments = ["eisenhower", "--flag", "notes.txt", "Garden.IKE", "Week.json"];
    assert_eq!(launch_file_argument(arguments, cwd), Some(cwd.join("Garden.IKE")));
    assert_eq!(
        launch_file_argument(["eisenhower", "Week.json"], cwd),
        Some(cwd.join("Week.json"))
    );
    // The program's own path is not a document, whatever it ends with; nor is a file of another kind.
    assert_eq!(launch_file_argument(["Garden.ike"], cwd), None);
    assert_eq!(launch_file_argument(["eisenhower", "notes.txt", "ike"], cwd), None);

    let folder = tempfile::tempdir().unwrap();
    let absolute = folder.path().join("Garden.ike");
    let url = Url::from_file_path(&absolute).unwrap().to_string();
    assert_eq!(
        launch_file_argument(["eisenhower", url.as_str()], cwd),
        Some(absolute.clone())
    );
    let text = absolute.to_string_lossy().into_owned();
    assert_eq!(launch_file_argument(["eisenhower", text.as_str()], cwd), Some(absolute));
    assert_eq!(launch_file_argument(["eisenhower", "file://not a url"], cwd), None);
}

#[test]
fn macos_gives_the_first_local_document_among_its_urls() {
    let folder = tempfile::tempdir().unwrap();
    let garden = folder.path().join("Garden.ike");
    let urls = [
        Url::parse("https://example.org/Plan.ike").unwrap(),
        Url::from_file_path(folder.path().join("notes.txt")).unwrap(),
        Url::from_file_path(&garden).unwrap(),
    ];
    assert_eq!(launch_file_url(&urls), Some(garden));
    assert_eq!(launch_file_url(&urls[..2]), None);
}

#[test]
fn a_document_waits_for_the_window_then_later_ones_are_sent() {
    let files = LaunchFiles::default();
    assert_eq!(files.arrive("first.ike".to_owned()), None);
    assert_eq!(files.arrive("second.ike".to_owned()), None);
    assert_eq!(files.take(), Some("second.ike".to_owned()));
    assert_eq!(files.take(), None);
    assert_eq!(files.arrive("third.ike".to_owned()), Some("third.ike".to_owned()));
    files.keep("unsent.ike".to_owned());
    assert_eq!(files.take(), Some("unsent.ike".to_owned()));
}

#[test]
fn the_window_takes_the_document_the_app_started_with_then_hears_of_later_ones() {
    let app = app();
    let heard = listened(&app);
    deliver(app.handle(), Path::new("Garden.ike"));
    assert!(heard.lock().unwrap().is_empty());
    assert_eq!(
        launch_file_take(app.state::<LaunchFiles>()),
        Some(PathBuf::from("Garden.ike").to_string_lossy().into_owned())
    );
    assert_eq!(launch_file_take(app.state::<LaunchFiles>()), None);

    deliver(app.handle(), Path::new("Week.json"));
    assert_eq!(*heard.lock().unwrap(), ["Week.json"]);
}

#[test]
fn a_second_launch_brings_its_document_to_the_window() {
    let app = app();
    tauri::WebviewWindowBuilder::new(&app, "main", tauri::WebviewUrl::default())
        .build()
        .unwrap();
    let heard = listened(&app);
    let _ = launch_file_take(app.state::<LaunchFiles>());
    let folder = tempfile::tempdir().unwrap();
    let cwd = folder.path().to_string_lossy().into_owned();
    second_launch(app.handle(), &["eisenhower".to_owned(), "Garden.ike".to_owned()], &cwd);
    second_launch(app.handle(), &["eisenhower".to_owned()], &cwd);
    let expected = folder.path().join("Garden.ike").to_string_lossy().into_owned();
    assert_eq!(*heard.lock().unwrap(), [expected]);
}
