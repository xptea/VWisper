#!/usr/bin/env bash
# This script packages the VWisper .app bundle into a compressed DMG.
# It is intended as a replacement for Tauri's default DMG creation,
# which some users have reported appears corrupted when downloaded from GitHub.
#
# Usage:
# chmod +x scripts/create_dmg.sh
# ./scripts/create_dmg.sh
#
# If APP_PATH is not provided, it defaults to
#   target/release/bundle/macos/VWisper.app
# If DMG_NAME is not provided, it defaults to
#   VWisper_<version>.dmg where <version> is read from Cargo.toml.
#
# Requirements:
#   • macOS with the `hdiutil` command available (pre-installed)
#   • The VWisper.app bundle must already be built (e.g., via `cargo tauri build`)
#
# Notes:
#   • The script creates a temporary staging directory containing the app and an
#     alias to /Applications so users can drag-and-drop to install.
#   • The resulting DMG is read-only and compressed (UDZO format).
#   • The script cleans up temporary artifacts after completion.
#
set -euo pipefail

################################################################################
# Helper functions
################################################################################

function info()  { echo -e "\033[1;34m[INFO]  $*\033[0m"; }
function error() { echo -e "\033[1;31m[ERROR] $*\033[0m" >&2; }

################################################################################
# Determine paths
################################################################################

WORKSPACE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# Prefer bundle inside src-tauri build output; fallback to top-level target path.
if [[ -d "$WORKSPACE_ROOT/src-tauri/target/release/bundle/macos/VWisper.app" ]]; then
  DEFAULT_APP_PATH="$WORKSPACE_ROOT/src-tauri/target/release/bundle/macos/VWisper.app"
elif [[ -d "$WORKSPACE_ROOT/src-tauri/target/release/bundle/macos/vwisper.app" ]]; then
  DEFAULT_APP_PATH="$WORKSPACE_ROOT/src-tauri/target/release/bundle/macos/vwisper.app"
elif [[ -d "$WORKSPACE_ROOT/target/release/bundle/macos/VWisper.app" ]]; then
  DEFAULT_APP_PATH="$WORKSPACE_ROOT/target/release/bundle/macos/VWisper.app"
else
  DEFAULT_APP_PATH=""
fi

if [[ -z "$DEFAULT_APP_PATH" ]]; then
  error "Could not locate VWisper.app bundle automatically. Please pass the path explicitly."
  exit 1
fi

# Read version from Cargo.toml (first occurrence of version under [package])
VERSION=$(grep -m1 '^version' "$WORKSPACE_ROOT/src-tauri/Cargo.toml" | cut -d '"' -f2)
DEFAULT_DMG_NAME="VWisper_${VERSION}.dmg"

APP_PATH="${1:-$DEFAULT_APP_PATH}"
DMG_NAME="${2:-$DEFAULT_DMG_NAME}"

if [[ ! -d "$APP_PATH" ]]; then
  error "App bundle not found at: $APP_PATH"
  exit 1
fi

OUTPUT_DIR="$(dirname "$APP_PATH")"
DMG_PATH="$OUTPUT_DIR/$DMG_NAME"

info "Packaging: $APP_PATH"
info "Output DMG: $DMG_PATH"

################################################################################
# Create staging directory
################################################################################

STAGING_DIR="$(mktemp -d)"
info "Created staging dir: $STAGING_DIR"

# Copy .app bundle into staging directory
APP_BUNDLE_NAME="$(basename "$APP_PATH")"
cp -R "$APP_PATH" "$STAGING_DIR/" || { error "Failed to copy .app"; exit 1; }

# ---------------------------------------------------------------------------
# Optional: remove quarantine attribute & (ad-hoc) sign the application
# ---------------------------------------------------------------------------

# Remove the quarantine attribute so Gatekeeper does not think the app is
# already "tainted" before signing/notarisation.
if command -v xattr >/dev/null 2>&1; then
  info "Removing quarantine attribute from copied bundle"
  xattr -dr com.apple.quarantine "$STAGING_DIR/$APP_BUNDLE_NAME" || true
fi

# Codesign step – ad-hoc by default, or use provided identity.
if command -v codesign >/dev/null 2>&1; then
  if [[ -n "${CODESIGN_IDENTITY:-}" ]]; then
    info "Signing application with identity: $CODESIGN_IDENTITY"
    codesign --deep --force --options runtime --timestamp=none --sign "$CODESIGN_IDENTITY" "$STAGING_DIR/$APP_BUNDLE_NAME"
  else
    info "Ad-hoc signing application (no CODESIGN_IDENTITY provided)"
    codesign --deep --force --sign - "$STAGING_DIR/$APP_BUNDLE_NAME"
  fi
fi

# Create /Applications symlink for drag-and-drop installation
ln -s /Applications "$STAGING_DIR/Applications"

################################################################################
# Build writable DMG so we can customise the look & feel
################################################################################

# Remove any pre-existing DMG with this name
if [[ -f "$DMG_PATH" ]]; then
  info "Removing existing DMG at $DMG_PATH"
  rm "$DMG_PATH"
fi

VOLUME_NAME="VWisper"

TMP_DMG="$OUTPUT_DIR/$VOLUME_NAME.tmp.dmg"

info "Creating temporary writable DMG…"
hdiutil create \
  -volname "$VOLUME_NAME" \
  -srcfolder "$STAGING_DIR" \
  -fs HFS+ \
  -fsargs "-c c=64,a=16,e=16" \
  -format UDRW \
  "$TMP_DMG" 1>/dev/null

# ---------------------------------------------------------------------------
# Mount, apply Finder cosmetic settings, then convert to compressed read-only
# ---------------------------------------------------------------------------

MOUNT_DIR="$(mktemp -d /tmp/vwisper_dmg_mount_XXXX)"
hdiutil attach "$TMP_DMG" -mountpoint "$MOUNT_DIR" -quiet -noverify -noautoopen

# Wait a moment for the disk to be fully mounted
sleep 2

# If we have a background image, copy it into .background/ inside the dmg
BG_SRC="${DMG_BACKGROUND_IMAGE:-$WORKSPACE_ROOT/scripts/dmg_background.png}"
BG_DST="$MOUNT_DIR/.background"

if [[ -f "$BG_SRC" ]]; then
  info "Adding background image"
  mkdir -p "$BG_DST"
  cp "$BG_SRC" "$BG_DST/bg.png"
  BG_REL_PATH=".background:bg.png" # Finder's syntax for image inside dmg
else
  BG_REL_PATH="" # will fallback to default background colour
fi

info "Configuring Finder window layout"
osascript <<EOF
tell application "Finder"
  delay 1
  try
    tell disk "$VOLUME_NAME"
      open
      set current view of container window to icon view
      set toolbar visible of container window to false
      set statusbar visible of container window to false
      set bounds of container window to {400, 120, 1000, 520}

      set viewOptions to the icon view options of container window
      set arrangement of viewOptions to not arranged
      set icon size of viewOptions to 128
      if "$BG_REL_PATH" is not "" then
        set background picture of viewOptions to file "$BG_REL_PATH"
      end if

      -- Position icons
      set position of item "$APP_BUNDLE_NAME" of container window to {165, 185}
      set position of item "Applications" of container window to {435, 185}

      -- Refresh
      update without registering applications
      delay 1
      close
    end tell
  on error errMsg
    log "Warning: Could not configure Finder layout: " & errMsg
  end try
end tell
EOF

sleep 1
hdiutil detach "$MOUNT_DIR" -quiet
rmdir "$MOUNT_DIR"

# Convert to compressed read-only DMG
info "Converting to compressed image"
hdiutil convert "$TMP_DMG" -format UDZO -imagekey zlib-level=9 -o "$DMG_PATH" -quiet
rm "$TMP_DMG"

info "DMG created successfully at: $DMG_PATH"
################################################################################
# Cleanup
################################################################################

rm -rf "$STAGING_DIR"
info "Cleaned up staging directory"

exit 0 