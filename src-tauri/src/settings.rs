use serde::{Deserialize, Serialize};
use std::{collections::BTreeMap, fs, io::ErrorKind, path::Path};
use tauri::Manager;
use tauri_plugin_fs::FsExt;

#[derive(Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Settings {
    #[serde(default)]
    last_file: Option<String>,
    #[serde(flatten)]
    extra: BTreeMap<String, serde_json::Value>,
}

fn read_settings(path: &Path) -> Result<Settings, String> {
    match fs::read_to_string(path) {
        Ok(text) => serde_json::from_str(&text).map_err(|e| format!("Invalid settings: {e}")),
        Err(e) if e.kind() == ErrorKind::NotFound => Ok(Settings::default()),
        Err(e) => Err(format!("Could not read settings: {e}")),
    }
}

fn write_last_file(settings_path: &Path, file: String) -> Result<(), String> {
    let mut settings = read_settings(settings_path)?;
    settings.last_file = Some(file);
    fs::create_dir_all(settings_path.parent().ok_or("Invalid settings path")?)
        .map_err(|e| e.to_string())?;
    let text = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(settings_path, format!("{text}\n")).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn remember_last_file(app: tauri::AppHandle, path: String) -> Result<(), String> {
    // Only remember documents already authorized by a file picker or Load last.
    if !Path::new(&path).is_absolute() || !app.fs_scope().is_allowed(&path) {
        return Err("File has not been selected for this app".into());
    }
    let settings_path = app
        .path()
        .home_dir()
        .map_err(|e| e.to_string())?
        .join(".mind-chart/settings.json");
    write_last_file(&settings_path, path)
}

#[tauri::command]
pub fn last_file(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let settings_path = app
        .path()
        .home_dir()
        .map_err(|e| e.to_string())?
        .join(".mind-chart/settings.json");
    let path = read_settings(&settings_path)?.last_file;
    if let Some(file) = &path {
        if !Path::new(file).is_absolute() {
            return Err("Last file in settings must be an absolute path".into());
        }
        // Dialog permissions are session-local. Restore access to this one file.
        app.fs_scope().allow_file(file).map_err(|e| e.to_string())?;
    }
    Ok(path)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn settings_round_trip() {
        let dir = std::env::temp_dir().join(format!(
            "mind-chart-settings-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let path = dir.join(".mind-chart/settings.json");
        assert!(read_settings(&path).unwrap().last_file.is_none());
        write_last_file(&path, "/tmp/first map.json".into()).unwrap();
        assert_eq!(
            read_settings(&path).unwrap().last_file.as_deref(),
            Some("/tmp/first map.json")
        );
        write_last_file(&path, "/tmp/second.json".into()).unwrap();
        assert_eq!(
            read_settings(&path).unwrap().last_file.as_deref(),
            Some("/tmp/second.json")
        );
        fs::write(&path, "invalid json").unwrap();
        assert!(read_settings(&path).is_err());
        fs::remove_dir_all(dir).unwrap();
    }
}
