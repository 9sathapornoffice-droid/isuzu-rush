@echo off
chcp 65001 >nul
title ISUZU RUSH - อัปโหลดไฟล์ขึ้น GitHub
echo ============================================================
echo      ISUZU RUSH - ระบบอัปโหลดไฟล์ทั้งหมดขึ้น GitHub
echo ============================================================
echo.

set PATH=C:\Users\ASUS\AppData\Local\Programs\MinGit\cmd;C:\Users\ASUS\AppData\Local\Programs\gh;%PATH%
cd /d "C:\Users\ASUS\.gemini\antigravity\scratch\isuzu-rush"

echo [1/3] ตรวจสอบสถานะการเชื่อมต่อ GitHub...
call gh auth status >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo.
    echo กรุณาเข้าสู่ระบบ GitHub (ทำเพียงครั้งเดียว):
    echo กำลังเปิดหน้าต่างยืนยันบนเว็บเบราว์เซอร์...
    echo.
    call gh auth login --web --git-protocol https
)

echo.
echo [2/3] เตรียมไฟล์ทั้งหมด (โฟลเดอร์ css, js, assets รูปภาพครบทั้งหมด)...
git remote set-url origin https://github.com/9sathapornoffice-droid/isuzu-rush.git
git add .
git commit -m "feat: add PWA mobile install support for iOS and Android" >nul 2>&1

echo.
echo [3/3] กำลังอัปโหลดไปยัง https://github.com/9sathapornoffice-droid/isuzu-rush ...
git push origin main --force

if %ERRORLEVEL% equ 0 (
    echo.
    echo ============================================================
    echo   [สำเร็จเรียบร้อย!] โฟลเดอร์ CSS, JS, และระบบติดตั้ง PWA อัปโหลดแล้ว!
    echo ============================================================
    echo.
    echo รอ GitHub Pages ประมวลผลประมาณ 1 นาที
    echo จากนั้นเปิดดูหน้าเว็บที่แก้ไขแล้วได้ที่:
    echo 👉 https://9sathapornoffice-droid.github.io/isuzu-rush/
    echo.
) else (
    echo.
    echo [!] ไม่สามารถอัปโหลดได้ กรุณาตรวจสอบการล็อกอิน GitHub อีกครั้ง
)

echo.
pause
