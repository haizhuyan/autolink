@echo off
rem 双击启动 AutoLink：打开两个窗口，分别运行后端（8000）和网站（3000）。关闭窗口即停止。
chcp 65001 >nul
cd /d "%~dp0"
set PYTHONIOENCODING=utf-8

rem 数据库升级到最新结构（已是最新时什么都不做）
.venv\Scripts\python.exe -m backend.autolink_api.cli migrate || (echo 数据库初始化失败 & pause & exit /b 1)

start "AutoLink 后端" cmd /k ".venv\Scripts\python.exe -m uvicorn backend.autolink_api.main:app --host 127.0.0.1 --port 8000"
start "AutoLink 网站" cmd /k "cd web && npm run dev"

echo.
echo 已启动。稍等几秒后打开 http://localhost:3000/admin
echo 管理员账号见 data\private\admin-login.txt
timeout /t 5 >nul
start "" http://localhost:3000/admin
