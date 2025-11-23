#!/bin/bash

# TypeScript Build Script for ALGO Project (Linux/macOS/WSL)
# This script compiles TypeScript files to JavaScript

echo "🚀 Building TypeScript files..."

# Detect if running in WSL
if grep -qEi "(Microsoft|WSL)" /proc/version &> /dev/null; then
    echo "🐧 Detected WSL environment"
    WSL_MODE=true
else
    WSL_MODE=false
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js first:"
    if [ "$WSL_MODE" = true ]; then
        echo "   For WSL: curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -"
        echo "           sudo apt-get install -y nodejs"
    else
        echo "   Visit: https://nodejs.org/"
    fi
    exit 1
fi

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo "❌ npm not found. Please install npm"
    exit 1
fi

# Check if TypeScript is installed
if ! command -v tsc &> /dev/null; then
    echo "❌ TypeScript compiler not found. Installing..."
    if [ "$WSL_MODE" = true ]; then
        # In WSL, sometimes global npm packages need special handling
        npm install -g typescript --unsafe-perm=true --allow-root
    else
        npm install -g typescript
    fi
    
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install TypeScript globally. Trying local installation..."
        npm install typescript
        if [ $? -eq 0 ]; then
            echo "✅ TypeScript installed locally. Using npx..."
            TSC_CMD="npx tsc"
        else
            echo "❌ Failed to install TypeScript. Please install it manually:"
            echo "   npm install -g typescript"
            exit 1
        fi
    else
        echo "✅ TypeScript installed successfully!"
        TSC_CMD="tsc"
    fi
else
    TSC_CMD="tsc"
fi

# Function to compile TypeScript file
compile_ts() {
    local file=$1
    local name=$2
    
    echo "📄 Compiling $name..."
    $TSC_CMD "$file" --outDir app/static/js --target ES2020 --module ES2020
    
    if [ $? -ne 0 ]; then
        echo "❌ Failed to compile $name"
        return 1
    fi
    return 0
}

# Compile all TypeScript files using tsconfig.json
echo "📄 Compiling all TypeScript files..."
$TSC_CMD

if [ $? -ne 0 ]; then
    echo "❌ TypeScript compilation failed"
    exit 1
fi

echo "✅ TypeScript compilation completed!"
echo "📁 Compiled files are in app/static/js/"

# Show compiled files
echo ""
echo "📋 Generated files:"
if [ "$WSL_MODE" = true ]; then
    # WSL-friendly file listing
    find app/static/js -name "*.js" -o -name "*.js.map" 2>/dev/null | sort
else
    ls -la app/static/js/*.js app/static/js/*.js.map 2>/dev/null | grep -E '\.(js|js\.map)$' || echo "No compiled files found"
fi

echo ""
echo "🎉 Build complete! You can now run your application."

if [ "$WSL_MODE" = true ]; then
    echo "💡 WSL Tip: You can access your files from Windows at:"
    echo "   \\\\wsl$\\Ubuntu\\$(pwd | sed 's|/mnt/c|C:|')"
fi
