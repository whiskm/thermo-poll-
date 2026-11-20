use tauri_plugin_dialog::DialogExt;

/// Сохраняет файл экспорта: показывает окно «Сохранить как» и пишет текст по выбранному пути.
/// Возвращает false, если пользователь закрыл окно без выбора.
#[tauri::command]
async fn export_file(app: tauri::AppHandle, name: String, contents: String) -> Result<bool, String> {
    let picked = app
        .dialog()
        .file()
        .set_file_name(&name)
        .add_filter("JSON", &["json"])
        .blocking_save_file();
    match picked {
        Some(path) => {
            let path = path.into_path().map_err(|e| e.to_string())?;
            std::fs::write(&path, contents).map_err(|e| e.to_string())?;
            Ok(true)
        }
        None => Ok(false),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![export_file])
        .run(tauri::generate_context!())
        .expect("ошибка запуска приложения");
}
