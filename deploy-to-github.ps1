# Script to push ISUZU RUSH to GitHub
$gitPath = "C:\Users\ASUS\AppData\Local\Programs\MinGit\cmd"
$ghPath = "C:\Users\ASUS\AppData\Local\Programs\gh"
$env:Path = "$gitPath;$ghPath;$env:Path"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   ISUZU RUSH - GitHub & Web Deployment   " -ForegroundColor Yellow
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

Set-Location -Path $PSScriptRoot

# Check if gh is authenticated
$authStatus = & gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "กรุณาเข้าสู่ระบบ GitHub (ทำเพียงครั้งเดียว):" -ForegroundColor Green
    Write-Host "กำลังเปิดหน้าต่างล็อกอิน GitHub..." -ForegroundColor Cyan
    & gh auth login --web --git-protocol https
}

Write-Host ""
Write-Host "กำลังสร้าง Repository บน GitHub และอัปโหลดโค้ด..." -ForegroundColor Green

# Create repo and push
& gh repo create isuzu-rush --public --source=. --remote=origin --push

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host " สำเร็จ! โค้ดถูกนำขึ้น GitHub เรียบร้อยแล้ว!" -ForegroundColor Green
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "ขั้นตอนเปิดหน้าเว็บให้เล่นได้ทันทีผ่าน GitHub Pages:" -ForegroundColor Yellow
    Write-Host "1. เข้าไปที่หน้า Repository บน GitHub ของคุณ" -ForegroundColor White
    Write-Host "2. ไปที่เมนู Settings -> Pages" -ForegroundColor White
    Write-Host "3. ในส่วน Source ให้เลือก 'GitHub Actions'" -ForegroundColor White
    Write-Host "4. รอประมาณ 1-2 นาที จะได้ลิงก์สำหรับเข้าเล่นและทำ QR Code ทันที!" -ForegroundColor Cyan
} else {
    Write-Host "หากมี Repository อยู่แล้ว กำลังทำการ Push..." -ForegroundColor Yellow
    & git push -u origin main
}

Write-Host ""
pause
