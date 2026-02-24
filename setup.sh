#!/usr/bin/env bash
set -e

REPO_URL="https://github.com/nirmash/agentic-app-demo.git"
INSTALL_DIR="${ADCGEN_HOME:-$HOME/.adcgen-cli}"

echo ""
echo "  🔧 adcgen installer"
echo "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "  ❌ Node.js is required. Install from https://nodejs.org"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "  ❌ npm is required. Install from https://nodejs.org"; exit 1; }
command -v git >/dev/null 2>&1 || { echo "  ❌ git is required. Install from https://git-scm.com"; exit 1; }

NODE_VER=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VER" -lt 18 ]; then
  echo "  ❌ Node.js 18+ required (found $(node -v))"
  exit 1
fi

echo "  ✓ Node.js $(node -v)"
echo "  ✓ npm $(npm -v)"

# Clone or update
if [ -d "$INSTALL_DIR/.git" ]; then
  echo ""
  echo "  📦 Updating existing installation..."
  cd "$INSTALL_DIR"
  git pull --quiet origin main
else
  echo ""
  echo "  📦 Cloning adcgen..."
  git clone --quiet "$REPO_URL" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

# Install dependencies (production only)
echo "  📦 Installing dependencies..."
npm install --production --quiet 2>/dev/null

# Create workspace directories
mkdir -p _data _site_src _site

# Link globally
echo "  🔗 Linking adcgen globally..."
npm link --quiet 2>/dev/null

# Verify
NPM_BIN="$(npm prefix -g)/bin"
if [ -x "$NPM_BIN/adcgen" ]; then
  echo ""
  echo "  ✅ adcgen installed successfully!"
  echo ""
  echo "  Installed to: $INSTALL_DIR"
  echo "  Binaries:     $NPM_BIN/adcgen"
  echo "                $NPM_BIN/adc"
  echo ""

  # Check PATH
  if ! echo "$PATH" | tr ':' '\n' | grep -q "$NPM_BIN"; then
    SHELL_RC=""
    if [ -n "$ZSH_VERSION" ] || [ "$(basename "$SHELL")" = "zsh" ]; then
      SHELL_RC="$HOME/.zshrc"
    elif [ -n "$BASH_VERSION" ] || [ "$(basename "$SHELL")" = "bash" ]; then
      SHELL_RC="$HOME/.bashrc"
    fi

    echo "  ⚠️  $NPM_BIN is not in your PATH."
    if [ -n "$SHELL_RC" ]; then
      echo ""
      echo "  Run this to fix:"
      echo ""
      echo "    echo 'export PATH=\"$NPM_BIN:\$PATH\"' >> $SHELL_RC"
      echo "    source $SHELL_RC"
    else
      echo ""
      echo "  Add this to your shell profile:"
      echo ""
      echo "    export PATH=\"$NPM_BIN:\$PATH\""
    fi
    echo ""
  fi

  echo "  Quick start:"
  echo ""
  echo "    adcgen login       # Authenticate with GitHub"
  echo "    adcgen generate    # Create a form"
  echo "    adcgen launch      # Start the dev server"
  echo "    adc config set apiKey <key>  # Configure ADC MCP client"
  echo ""
else
  echo ""
  echo "  ⚠️  Link created but adcgen not found in PATH."
  echo "  Try: export PATH=\"$NPM_BIN:\$PATH\""
  echo ""
fi
