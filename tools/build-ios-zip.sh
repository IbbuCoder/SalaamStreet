#!/usr/bin/env bash
# Builds SalaamStreet-iOS-3.0.0-Beta.zip at the repository root from the
# committed ios/ folder (git archive, so the ZIP is exactly the source at HEAD),
# then extracts it and checks it: same files as ios/ at HEAD, the Xcode
# project and scheme are present, and nothing secret-looking is inside.
#   tools/build-ios-zip.sh            (commit ios/ changes first)
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
NAME="SalaamStreet-iOS-3.0.0-Beta"
ZIP="$NAME.zip"

if ! git diff --quiet HEAD -- ios; then
  echo "ios/ has uncommitted changes; commit them first so the ZIP matches the source." >&2
  exit 1
fi

rm -f "$ZIP"
git archive --format=zip -9 --prefix="$NAME/" -o "$ZIP" HEAD:ios

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
unzip -q "$ZIP" -d "$TMP"
OUT="$TMP/$NAME"

# 1. Exactly the committed files, byte for byte.
(cd "$OUT" && find . -type f | sed 's|^\./||' | sort) > "$TMP/zip.txt"
git ls-tree -r --name-only HEAD:ios | sort > "$TMP/git.txt"
diff -u "$TMP/git.txt" "$TMP/zip.txt"
while IFS= read -r f; do
  cmp -s "$OUT/$f" <(git show "HEAD:ios/$f") || { echo "differs: $f" >&2; exit 1; }
done < "$TMP/git.txt"

# 2. What Xcode needs to open and build it.
for f in SalaamStreet.xcodeproj/project.pbxproj SalaamStreet.xcodeproj/xcshareddata/xcschemes/SalaamStreet.xcscheme \
         SalaamStreetCore/Package.swift Config/SalaamStreet-Info.plist Config/SalaamStreetWidgets-Info.plist \
         SalaamStreet/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png SalaamStreetWidgets/PrayerLiveActivity.swift README.md; do
  [ -s "$OUT/$f" ] || { echo "missing in ZIP: $f" >&2; exit 1; }
done

# 3. No signing material or obvious secrets.
if find "$OUT" -iname '*.p12' -o -iname '*.mobileprovision' -o -iname '*.cer' -o -iname '*.p8' -o -iname '.env*' | grep -q .; then
  echo "signing material in ZIP" >&2; exit 1
fi
if grep -rIlE "(sk_live_|AIza[0-9A-Za-z_-]{35}|-----BEGIN (RSA |EC )?PRIVATE KEY|service_role)" "$OUT" | grep -q .; then
  echo "something that looks like a secret is in the ZIP" >&2; exit 1
fi

echo "$ZIP: $(wc -l < "$TMP/git.txt") files, $(du -h "$ZIP" | cut -f1), matches ios/ at $(git rev-parse --short HEAD)"
