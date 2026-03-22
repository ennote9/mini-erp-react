// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

#[cfg(windows)]
mod pdf_export_windows;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn write_export_file(path: String, contents_base64: String) -> Result<(), String> {
    use base64::{engine::general_purpose::STANDARD, Engine};
    let bytes = STANDARD.decode(&contents_base64).map_err(|e| e.to_string())?;
    std::fs::write(&path, bytes).map_err(|e| e.to_string())?;
    Ok(())
}

/// Opens the given file path with the system default application.
#[tauri::command]
fn open_export_file(path: String) -> Result<(), String> {
    if !std::path::Path::new(&path).exists() {
        return Err(format!("File not found: {}", path));
    }
    let status = if cfg!(target_os = "windows") {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &path])
            .status()
            .map_err(|e| e.to_string())?
    } else if cfg!(target_os = "macos") {
        std::process::Command::new("open")
            .arg(&path)
            .status()
            .map_err(|e| e.to_string())?
    } else {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .status()
            .map_err(|e| e.to_string())?
    };
    if status.success() {
        Ok(())
    } else {
        Err(format!("open failed with status: {:?}", status))
    }
}

/// Writes the **entire main webview** to a PDF using the platform webview engine (WebView2 on Windows).
/// `@media print` CSS should hide app chrome so only document content is included.
#[tauri::command]
async fn webview_print_to_pdf(app: tauri::AppHandle, path: String) -> Result<(), String> {
    #[cfg(windows)]
    {
        pdf_export_windows::print_main_webview_to_pdf(app, path).await
    }
    #[cfg(not(windows))]
    {
        let _ = app;
        let _ = path;
        Err("NATIVE_PDF_UNSUPPORTED".to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            write_export_file,
            open_export_file,
            webview_print_to_pdf
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
