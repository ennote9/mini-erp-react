//! Windows: export the main webview to PDF via WebView2 `PrintToPdf` (no JS canvas readback).

use tauri::{AppHandle, Manager};
use webview2_com::Microsoft::Web::WebView2::Win32::{
    ICoreWebView2Environment6, ICoreWebView2PrintSettings, ICoreWebView2_7,
    COREWEBVIEW2_PRINT_ORIENTATION_PORTRAIT,
};
use webview2_com::PrintToPdfCompletedHandler;
use windows::core::{Interface, HSTRING};

fn print_webview2_to_path(
    webview: tauri::webview::PlatformWebview,
    path: &str,
) -> Result<(), String> {
    let controller = webview.controller();
    let core = unsafe { controller.CoreWebView2().map_err(|e| e.to_string())? };
    let v7: ICoreWebView2_7 = core.cast().map_err(|e| e.to_string())?;

    let env = webview.environment();
    let env6: ICoreWebView2Environment6 = env.cast().map_err(|e| e.to_string())?;
    let settings: ICoreWebView2PrintSettings =
        unsafe { env6.CreatePrintSettings().map_err(|e| e.to_string())? };
    unsafe {
        settings
            .SetOrientation(COREWEBVIEW2_PRINT_ORIENTATION_PORTRAIT)
            .map_err(|e| e.to_string())?;
        settings
            .SetShouldPrintHeaderAndFooter(false)
            .map_err(|e| e.to_string())?;
    }

    let path_h = HSTRING::from(path);

    PrintToPdfCompletedHandler::wait_for_async_operation(
        Box::new(move |handler| {
            unsafe {
                v7.PrintToPdf(&path_h, &settings, &handler)
                    .map_err(webview2_com::Error::from)?;
            }
            Ok(())
        }),
        Box::new(|hr_result, success| {
            hr_result?;
            if !success {
                return Err(windows::core::Error::new(
                    windows::Win32::Foundation::E_FAIL,
                    "WebView2 PrintToPdf reported failure",
                ));
            }
            Ok(())
        }),
    )
    .map_err(|e| e.to_string())
}

fn try_print_on_main_thread(app: &AppHandle, path: &str) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Main window not found".to_string())?;
    let (tx, rx) = std::sync::mpsc::channel();
    let path = path.to_string();
    window
        .with_webview(move |webview| {
            let r = print_webview2_to_path(webview, &path);
            let _ = tx.send(r);
        })
        .map_err(|e| e.to_string())?;
    rx.recv()
        .map_err(|_| "PDF export channel closed".to_string())?
}

/// Runs WebView2 PrintToPdf on the main thread (required for COM + message pump).
pub async fn print_main_webview_to_pdf(app: AppHandle, path: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let (tx, rx) = std::sync::mpsc::channel::<Result<(), String>>();
        let app_for_handler = app.clone();
        app.run_on_main_thread(move || {
            let r = try_print_on_main_thread(&app_for_handler, &path);
            let _ = tx.send(r);
        })
        .map_err(|e| e.to_string())?;
        rx.recv()
            .map_err(|_| "PDF export scheduling failed".to_string())?
    })
    .await
    .map_err(|e| e.to_string())?
}
