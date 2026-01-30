#!/bin/bash
# Build script for Graph Plotter modules
# Usage: ./build.sh

OUTPUT_DIR="dist"
BUNDLE_NAME="graph.bundle.js"

mkdir -p $OUTPUT_DIR

# Concatenate all modules in correct order
cat \
  core/config.js \
  core/utils.js \
  core/registry.js \
  table/table.js \
  charts/line.js \
  charts/scatter.js \
  charts/bar.js \
  charts/area.js \
  charts/ternary.js \
  axis/scales.js \
  axis/draw.js \
  axis/edit.js \
  ui/legend.js \
  ui/tooltip.js \
  ui/inspector.js \
  features/shapes.js \
  features/zoom.js \
  features/smoothing.js \
  features/fitting.js \
  features/tauc.js \
  parsers/parsers.js \
  parsers/nmr.js \
  match/core.js \
  export/export.js \
  graph.core.js \
  > $OUTPUT_DIR/$BUNDLE_NAME

echo "✅ Created $OUTPUT_DIR/$BUNDLE_NAME"

# Minify if terser is available
if command -v terser &> /dev/null; then
  terser $OUTPUT_DIR/$BUNDLE_NAME -o $OUTPUT_DIR/graph.bundle.min.js -c -m
  echo "✅ Created $OUTPUT_DIR/graph.bundle.min.js"
else
  echo "ℹ️  Install terser for minification: npm install -g terser"
fi

# Show file sizes
echo ""
echo "📊 Bundle sizes:"
ls -lh $OUTPUT_DIR/*.js | awk '{print $5, $9}'
