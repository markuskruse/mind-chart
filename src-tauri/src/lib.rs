mod settings;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            settings::remember_last_file,
            settings::last_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running Mind Chart");
}
