# TypeScript Build Script for ALGO Project (Windows)
# This script compiles TypeScript files to JavaScript
#
# For WSL users: Use build_ts.sh instead:
#   wsl ./build_ts.sh
# Or run directly in WSL:
#   wsl -e bash -c "./build_ts.sh"

Write-Host "🚀 Building TypeScript files..." -ForegroundColor Green

# Compile all TypeScript files using tsconfig.json
Write-Host "📄 Compiling all TypeScript files..." -ForegroundColor Yellow
tsc

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ TypeScript compilation failed" -ForegroundColor Red
    exit 1
}

Write-Host "✅ TypeScript compilation completed!" -ForegroundColor Green
Write-Host "📁 Compiled files are in app/static/js/" -ForegroundColor Cyan
