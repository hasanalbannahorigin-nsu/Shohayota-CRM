# PowerShell script to configure Gemini API key
Write-Host "🔧 Gemini API Configuration" -ForegroundColor Cyan
Write-Host ""

# Check if .env file exists
if (-not (Test-Path ".env")) {
    Write-Host "❌ .env file not found!" -ForegroundColor Red
    exit 1
}

Write-Host "📋 Current Gemini Configuration:" -ForegroundColor Yellow
Get-Content .env | Select-String -Pattern "GEMINI"

Write-Host ""
Write-Host "To configure Gemini, you need to:" -ForegroundColor Cyan
Write-Host "1. Get a free API key from: https://aistudio.google.com/app/apikey" -ForegroundColor White
Write-Host "2. Copy your API key" -ForegroundColor White
Write-Host ""

# Prompt for API key
$apiKey = Read-Host "Enter your Gemini API key (or press Enter to skip)"

if ([string]::IsNullOrWhiteSpace($apiKey)) {
    Write-Host "⚠️  No API key provided. Skipping configuration." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "The AI Assistant will use rule-based fallback responses." -ForegroundColor Yellow
    Write-Host "To enable Gemini later, update GEMINI_API_KEY in .env file." -ForegroundColor Yellow
    exit 0
}

# Update .env file
$envContent = Get-Content .env -Raw

# Update GEMINI_API_KEY if it exists
if ($envContent -match "GEMINI_API_KEY=") {
    $envContent = $envContent -replace "GEMINI_API_KEY=.*", "GEMINI_API_KEY=$apiKey"
} else {
    # Add if it doesn't exist
    $envContent += "`nGEMINI_API_KEY=$apiKey"
}

# Also update GEMINI_API_URL to use Google's official API (we don't need the custom URL)
$envContent = $envContent -replace "GEMINI_API_URL=.*", "# GEMINI_API_URL is not needed - using Google's official API"

Set-Content .env -Value $envContent -NoNewline

Write-Host ""
Write-Host "✅ Gemini API key configured!" -ForegroundColor Green
Write-Host ""
Write-Host "⚠️  IMPORTANT: Restart the server for changes to take effect:" -ForegroundColor Yellow
Write-Host "   1. Stop the current server (Ctrl+C)" -ForegroundColor White
Write-Host "   2. Run: npm run dev" -ForegroundColor White
Write-Host ""

