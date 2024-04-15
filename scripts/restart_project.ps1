# AI-Based Vehicle Health Monitoring - Project Restart Helper
# Use this script after "terraform destroy" to bring the project back online.

$ErrorActionPreference = "Stop"

Write-Host "🚀 Starting Project Restoration Process..." -ForegroundColor Cyan

# 1. Apply Terraform Infrastructure
Write-Host "`n🛠️  Step 1: Provisioning AWS Infrastructure..." -ForegroundColor Yellow
if (Test-Path "../terraform.exe") {
    & "../terraform.exe" apply -auto-approve
} elseif (Get-Command terraform -ErrorAction SilentlyContinue) {
    terraform apply -auto-approve
} else {
    Write-Error "Could not find terraform.exe. Please ensure it is in the root directory or your PATH."
}

# 2. Extract new IPs
Write-Host "`n🔍 Step 2: Extracting New Connectivity Details..." -ForegroundColor Yellow
$prod_ip = & "../terraform.exe" output -raw production_ip
$jenkins_ip = & "../terraform.exe" output -raw jenkins_ip

# 3. Final Report
Write-Host "`n✅ Infrastructure is READY!" -ForegroundColor Green
Write-Host "--------------------------------------------------" -ForegroundColor Gray
Write-Host "🌐 Website Dashboard: http://$($prod_ip)" -ForegroundColor White
Write-Host "🏗️  Jenkins Dashboard: http://$($jenkins_ip):8080" -ForegroundColor White
Write-Host "--------------------------------------------------" -ForegroundColor Gray

Write-Host "`n⚠️  Final Action Required:" -ForegroundColor Red
Write-Host "1. Open the Jenkins Dashboard at the link above."
Write-Host "2. Trigger a 'Build Now' for your project to redeploy the app."
Write-Host "3. Refresh your website once the build is finished!" -ForegroundColor Cyan

Write-Host "`n✨ Happy Monitoring!" -ForegroundColor Magenta
