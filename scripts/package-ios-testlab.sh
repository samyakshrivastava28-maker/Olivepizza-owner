#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Olive Pizza — Firebase Test Lab iOS XCTest Packaging & Validation Script
# ==============================================================================
# Strictly conforms to Google Firebase Test Lab iOS XCTest specification:
# 1. Archive MUST contain exactly ONE .xctestrun file at the archive root.
# 2. Archive MUST contain the 'Debug-iphoneos' directory with the application bundle
#    and test bundle.
# 3. Release IPAs, .exe, or .dmg binaries MUST NEVER be packaged as XCTest suites.
# ==============================================================================

ACTION="${1:-package-only}"
APP_NAME="${2:-olivepizza-app}"
DERIVED_DATA="${3:-build/DerivedData}"
OUTPUT_DIR="${4:-testlab-artifacts}"

# Resolve absolute paths before changing directory
PROJECT_ROOT="$(pwd)"
OUTPUT_DIR_ABS="$PROJECT_ROOT/$OUTPUT_DIR"
DERIVED_DATA_ABS="$PROJECT_ROOT/$DERIVED_DATA"

echo "=========================================================="
echo "🍕 Olive Pizza — Firebase Test Lab iOS Packaging"
echo "  Action:       $ACTION"
echo "  App Name:     $APP_NAME"
echo "  DerivedData:  $DERIVED_DATA_ABS"
echo "  Output Dir:   $OUTPUT_DIR_ABS"
echo "=========================================================="

if [ "$ACTION" = "build" ] || [ "$ACTION" = "build-and-package" ]; then
  echo "🔨 Building iOS project for testing (Debug, generic/platform=iOS)..."
  mkdir -p "$DERIVED_DATA_ABS"
  
  if [ -d "ios/App/App.xcworkspace" ]; then
    TARGET_FLAG="-workspace ios/App/App.xcworkspace"
  else
    TARGET_FLAG="-project ios/App/App.xcodeproj"
  fi

  xcodebuild build-for-testing \
    $TARGET_FLAG \
    -scheme App \
    -configuration Debug \
    -destination "generic/platform=iOS" \
    -derivedDataPath "$DERIVED_DATA_ABS" \
    CODE_SIGN_IDENTITY="" \
    CODE_SIGNING_REQUIRED=NO \
    CODE_SIGNING_ALLOWED=NO \
    PROVISIONING_PROFILE_SPECIFIER=""
  
  echo "✅ xcodebuild build-for-testing completed successfully."
fi

PRODUCTS_DIR="$DERIVED_DATA_ABS/Build/Products"

if [ ! -d "$PRODUCTS_DIR" ]; then
  echo "::error::Products directory not found at $PRODUCTS_DIR"
  exit 1
fi

echo "🔍 Inspecting build products in $PRODUCTS_DIR..."

# 1. Discover .xctestrun file(s)
shopt -s nullglob
XCTESTRUN_FILES=("$PRODUCTS_DIR"/*.xctestrun)
shopt -u nullglob

COUNT=${#XCTESTRUN_FILES[@]}

if [ "$COUNT" -eq 0 ]; then
  echo "::error::No .xctestrun file found in $PRODUCTS_DIR. Ensure the scheme includes a valid test target."
  exit 1
elif [ "$COUNT" -gt 1 ]; then
  echo "::error::Multiple .xctestrun files found ($COUNT). Firebase Test Lab requires exactly ONE .xctestrun file in the zip."
  for f in "${XCTESTRUN_FILES[@]}"; do
    echo "  - $f"
  done
  exit 1
fi

XCTESTRUN_PATH="${XCTESTRUN_FILES[0]}"
XCTESTRUN_FILENAME="$(basename "$XCTESTRUN_PATH")"
echo "✅ Discovered single scheme .xctestrun file: $XCTESTRUN_FILENAME"

# 2. Check for Debug-iphoneos directory
if [ ! -d "$PRODUCTS_DIR/Debug-iphoneos" ]; then
  echo "::error::Required 'Debug-iphoneos' directory missing from $PRODUCTS_DIR."
  exit 1
fi

# Check for App.app inside Debug-iphoneos
if [ ! -d "$PRODUCTS_DIR/Debug-iphoneos/App.app" ]; then
  echo "::error::App.app bundle missing from $PRODUCTS_DIR/Debug-iphoneos."
  exit 1
fi

mkdir -p "$OUTPUT_DIR_ABS"
ZIP_NAME="${APP_NAME}-ios-xctest.zip"
ZIP_DEST="$OUTPUT_DIR_ABS/$ZIP_NAME"
rm -f "$ZIP_DEST"

# 3. Create zip from inside Products directory so root contains the single .xctestrun and Debug-iphoneos
echo "📦 Packaging Firebase Test Lab ZIP archive..."
pushd "$PRODUCTS_DIR" > /dev/null

zip -r "$ZIP_DEST" "$XCTESTRUN_FILENAME" Debug-iphoneos

popd > /dev/null

# 4. Strict structural verification
if [ ! -s "$ZIP_DEST" ]; then
  echo "::error::Generated ZIP archive is missing or empty: $ZIP_DEST"
  exit 1
fi

echo "🔍 Verifying ZIP archive structure with unzip -l..."
ZIP_CONTENTS="$(unzip -l "$ZIP_DEST")"

# Check rule: exactly one .xctestrun at root
XCTESTRUN_MATCH_COUNT=$(echo "$ZIP_CONTENTS" | grep -E "^\s+[0-9]+\s+[^/]+\.xctestrun$" | wc -l || true)
if [ "$XCTESTRUN_MATCH_COUNT" -ne 1 ]; then
  echo "::error::Archive must contain exactly one root .xctestrun file. Found: $XCTESTRUN_MATCH_COUNT"
  echo "$ZIP_CONTENTS"
  exit 1
fi

# Check rule: contains Debug-iphoneos/
if ! echo "$ZIP_CONTENTS" | grep -q "Debug-iphoneos/"; then
  echo "::error::Archive missing Debug-iphoneos/ directory."
  exit 1
fi

# Check rule: ensure no .ipa inside
if echo "$ZIP_CONTENTS" | grep -q "\.ipa"; then
  echo "::error::Archive contains an IPA file! An IPA cannot be used as an XCTest package."
  exit 1
fi

ZIP_SIZE=$(stat -c%s "$ZIP_DEST" 2>/dev/null || stat -f%z "$ZIP_DEST" 2>/dev/null || echo "unknown")
echo "=========================================================="
echo "🎉 Firebase Test Lab iOS XCTest package created and verified!"
echo "  Archive: $ZIP_DEST"
echo "  Size:    $ZIP_SIZE bytes"
echo "  Root:    $XCTESTRUN_FILENAME"
echo "  Bundles: Debug-iphoneos/App.app, Debug-iphoneos/AppTests.xctest"
echo "=========================================================="
