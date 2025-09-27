# TypeScript Build Script for ALGO Project (Windows)
# This script compiles TypeScript files to JavaScript
#
# For WSL users: Use build_ts.sh instead:
#   wsl ./build_ts.sh
# Or run directly in WSL:
#   wsl -e bash -c "./build_ts.sh"

Write-Host "🚀 Building TypeScript files..." -ForegroundColor Green

# Compile profile.ts
Write-Host "📄 Compiling profile.ts..." -ForegroundColor Yellow
tsc app/static/js/profile.ts --outDir app/static/js --target ES2020 --module ES2020

# Compile user_dashboard.ts
Write-Host "📄 Compiling user_dashboard.ts..." -ForegroundColor Yellow
tsc app/static/js/user_dashboard.ts --outDir app/static/js --target ES2020 --module ES2020

Write-Host "✅ TypeScript compilation completed!" -ForegroundColor Green
Write-Host "📁 Compiled files are in app/static/js/" -ForegroundColor Cyan
