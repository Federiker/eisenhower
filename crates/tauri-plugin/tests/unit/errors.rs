use std::error::Error as _;

use serde_json::json;

use crate::Error;

fn json(error: &Error) -> serde_json::Value {
    serde_json::to_value(error).unwrap()
}

#[test]
fn errors_reach_the_app_as_codes_with_their_parameters() {
    assert_eq!(
        json(&Error::ReadFailed {
            path: "plan.json".into(),
            detail: "denied".to_owned()
        }),
        json!({ "code": "read_failed", "params": { "path": "plan.json", "detail": "denied" } })
    );
    assert_eq!(
        json(&Error::NotText {
            path: "plan.json".into()
        }),
        json!({ "code": "not_text", "params": { "path": "plan.json" } })
    );
    assert_eq!(
        json(&Error::WriteFailed {
            path: "plan.json".into(),
            detail: "full".to_owned()
        }),
        json!({ "code": "write_failed", "params": { "path": "plan.json", "detail": "full" } })
    );
    assert_eq!(
        json(&Error::ChangedOnDisk {
            path: "plan.json".into(),
            expected: "aa".to_owned(),
            actual: Some("bb".to_owned()),
        }),
        json!({
            "code": "changed_on_disk",
            "params": { "path": "plan.json", "expectedHash": "aa", "actualHash": "bb" },
        })
    );
    assert_eq!(
        json(&Error::ChangedOnDisk {
            path: "plan.json".into(),
            expected: "aa".to_owned(),
            actual: None,
        }),
        json!({
            "code": "changed_on_disk",
            "params": { "path": "plan.json", "expectedHash": "aa", "actualHash": null },
        })
    );
    assert_eq!(
        json(&Error::invalid_request("the path is empty")),
        json!({ "code": "invalid_request", "params": { "detail": "the path is empty" } })
    );
    assert_eq!(
        json(&Error::Internal {
            detail: "stopped".to_owned()
        }),
        json!({ "code": "internal", "params": { "detail": "stopped" } })
    );
}

#[test]
fn errors_have_a_message_for_logs() {
    let errors = [
        Error::ReadFailed {
            path: "a".into(),
            detail: "d".to_owned(),
        },
        Error::NotText { path: "a".into() },
        Error::WriteFailed {
            path: "a".into(),
            detail: "d".to_owned(),
        },
        Error::ChangedOnDisk {
            path: "a".into(),
            expected: String::new(),
            actual: None,
        },
        Error::invalid_request("d"),
        Error::Internal { detail: "d".to_owned() },
    ];
    for error in &errors {
        assert!(!error.to_string().is_empty(), "{error:?}");
        assert!(error.source().is_none());
    }
}
