#[expect(
    clippy::expect_used,
    reason = "a build that cannot make the window's context must stop"
)]
fn main() {
    // The window's context (tauri.conf.json), its capabilities and, on Windows, the icon. On Windows Tauri needs
    // version 6 of the common controls: the linker asks for them below, for the program and for the test binary
    // alike, rather than tauri-build's manifest, which only the program gets (the tests would not start,
    // STATUS_ENTRYPOINT_NOT_FOUND).
    let windows = tauri_build::WindowsAttributes::new_without_app_manifest();
    tauri_build::try_build(tauri_build::Attributes::new().windows_attributes(windows))
        .expect("failed to build the window's context");
    if std::env::var("CARGO_CFG_TARGET_ENV").is_ok_and(|target| target == "msvc") {
        println!("cargo:rustc-link-arg=/MANIFEST:EMBED");
        println!(
            "cargo:rustc-link-arg=/MANIFESTDEPENDENCY:type='win32' name='Microsoft.Windows.Common-Controls' \
             version='6.0.0.0' processorArchitecture='*' publicKeyToken='6595b64144ccf1df' language='*'"
        );
    }
}
