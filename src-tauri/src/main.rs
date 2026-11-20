// Скрывает консольное окно Windows в релизной сборке.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    termoopros_lib::run();
}
