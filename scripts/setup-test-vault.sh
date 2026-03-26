#!/usr/bin/env bash
# Setup a test vault with symlinks to the YAAE plugin build output.
# Idempotent — safe to re-run.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
VAULT_DIR="$PROJECT_ROOT/test-vault"
PLUGIN_DIR="$VAULT_DIR/.obsidian/plugins/yaae"

echo "Setting up test vault at: $VAULT_DIR"

# Create directory structure
mkdir -p "$PLUGIN_DIR"
mkdir -p "$VAULT_DIR/.obsidian"

# Symlink build artifacts into the plugin directory
for file in main.js manifest.json styles.css; do
  target="$PLUGIN_DIR/$file"
  source="$PROJECT_ROOT/$file"

  if [ -L "$target" ]; then
    rm "$target"
  fi

  if [ "$file" = "main.js" ] && [ ! -f "$source" ]; then
    echo "  Warning: $file not found — run 'pnpm run build' first"
  fi

  ln -s "$source" "$target"
  echo "  Linked $file"
done

# Hot reload marker (Obsidian watches for this file)
touch "$PLUGIN_DIR/.hotreload"
echo "  Created .hotreload marker"

# Obsidian config: enable the plugin
cat > "$VAULT_DIR/.obsidian/community-plugins.json" << 'EOF'
["yaae"]
EOF
echo "  Enabled yaae in community-plugins.json"

# Minimal app config
if [ ! -f "$VAULT_DIR/.obsidian/app.json" ]; then
  cat > "$VAULT_DIR/.obsidian/app.json" << 'EOF'
{
  "livePreview": true,
  "defaultViewMode": "source",
  "showFrontmatter": true
}
EOF
  echo "  Created app.json"
fi

# Install print-styles as a CSS snippet (concatenate all files)
SNIPPETS_DIR="$VAULT_DIR/.obsidian/snippets"
mkdir -p "$SNIPPETS_DIR"
cat "$PROJECT_ROOT"/packages/print-styles/src/presets/*.css \
    "$PROJECT_ROOT"/packages/print-styles/src/components/*.css \
    > "$SNIPPETS_DIR/yaae-print-styles.css"
echo "  Installed print-styles CSS snippet"

echo ""
echo "Done. To use:"
echo "  1. pnpm run build     (or pnpm run dev for watch mode)"
echo "  2. Open '$VAULT_DIR' as a vault in Obsidian"
echo "  3. Enable YAAE in Settings > Community Plugins"
echo "  4. Enable 'yaae-print-styles' in Settings > Appearance > CSS Snippets"
