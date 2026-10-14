#!/bin/sh
# SalaamStreet — tools/build-ios-zip.sh
# Builds SalaamStreet-iOS-3.0.0-Beta.zip at the repository root from the
# COMMITTED ios/ folder (git archive, so nothing uncommitted or ignored gets
# in), then extracts it and checks it is byte-for-byte the same as ios/ in git.
#
#   sh tools/build-ios-zip.sh
set -eu
cd "$(dirname "$0")/.."
ZIP=SalaamStreet-iOS-3.0.0-Beta.zip
COMMIT=$(git rev-parse --short HEAD)
if [ -n "$(git status --porcelain -- ios)" ]; then
  echo "ios/ has uncommitted changes; commit them first." >&2
  exit 1
fi
rm -f "$ZIP"
git archive --format=zip -9 --prefix=SalaamStreet-iOS/ -o "$ZIP" HEAD ios
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
unzip -q "$ZIP" -d "$TMP"
# Compare every file in the zip with git's copy.
git ls-tree -r --name-only HEAD ios | while read -r f; do
  if ! git show "HEAD:$f" | cmp -s - "$TMP/SalaamStreet-iOS/$f"; then echo "MISMATCH: $f" >&2; exit 1; fi
done
FILES=$(find "$TMP/SalaamStreet-iOS" -type f | wc -l | tr -d ' ')
WANT=$(git ls-tree -r --name-only HEAD ios | wc -l | tr -d ' ')
[ "$FILES" = "$WANT" ] || { echo "file count $FILES, expected $WANT" >&2; exit 1; }
test -f "$TMP/SalaamStreet-iOS/ios/SalaamStreet.xcodeproj/project.pbxproj"
test -f "$TMP/SalaamStreet-iOS/ios/SalaamStreet/WebApp/index.html"
test -f "$TMP/SalaamStreet-iOS/ios/SalaamStreet/WebApp/files/quran-english-sher-ali.pdf"
echo "$ZIP: $FILES files from ios/ at $COMMIT, $(du -h "$ZIP" | cut -f1), checked after extraction."
