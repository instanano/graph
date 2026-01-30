/**
 * Build script for Graph Plotter modules
 * Usage: node build.js         - Build once
 *        node build.js --watch - Watch mode (auto-rebuild on changes)
 */

const fs = require('fs');
const path = require('path');

// Files to bundle in correct dependency order
const FILES = [
    'core/config.js',
    'core/utils.js',
    'core/registry.js',
    'table/table.js',
    'charts/line.js',
    'charts/scatter.js',
    'charts/bar.js',
    'charts/area.js',
    'charts/ternary.js',
    'axis/scales.js',
    'axis/draw.js',
    'axis/edit.js',
    'ui/legend.js',
    'ui/tooltip.js',
    'ui/inspector.js',
    'features/shapes.js',
    'features/zoom.js',
    'features/smoothing.js',
    'features/fitting.js',
    'features/tauc.js',
    'parsers/parsers.js',
    'parsers/nmr.js',
    'match/core.js',
    'export/export.js',
    'graph.core.js'
];

const OUTPUT_DIR = 'dist';
const BUNDLE_NAME = 'graph.bundle.js';

function build() {
    const startTime = Date.now();

    // Create dist folder if it doesn't exist
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Concatenate all files
    let bundle = '';
    for (const file of FILES) {
        const filePath = path.join(__dirname, file);
        if (fs.existsSync(filePath)) {
            bundle += fs.readFileSync(filePath, 'utf8') + '\n';
        } else {
            console.error(`⚠️  Missing file: ${file}`);
        }
    }

    // Write bundle
    const outputPath = path.join(__dirname, OUTPUT_DIR, BUNDLE_NAME);
    fs.writeFileSync(outputPath, bundle);

    const size = (Buffer.byteLength(bundle, 'utf8') / 1024).toFixed(1);
    const time = Date.now() - startTime;

    console.log(`✅ Built ${OUTPUT_DIR}/${BUNDLE_NAME} (${size}KB) in ${time}ms`);

    return bundle;
}

// Watch mode
if (process.argv.includes('--watch')) {
    console.log('👀 Watching for changes...\n');

    // Initial build
    build();

    // Watch for changes using chokidar
    try {
        const chokidar = require('chokidar');

        const watcher = chokidar.watch([
            'core/**/*.js',
            'charts/**/*.js',
            'axis/**/*.js',
            'ui/**/*.js',
            'features/**/*.js',
            'parsers/**/*.js',
            'match/**/*.js',
            'export/**/*.js',
            'table/**/*.js',
            'graph.core.js'
        ], {
            ignored: /(^|[\/\\])\../,
            persistent: true,
            cwd: __dirname
        });

        watcher.on('change', (filePath) => {
            console.log(`\n📝 Changed: ${filePath}`);
            build();
        });

        watcher.on('add', (filePath) => {
            console.log(`\n➕ Added: ${filePath}`);
            build();
        });

    } catch (e) {
        console.log('ℹ️  For watch mode, install dependencies: npm install');
        console.log('   Then run: npm run watch');
    }
} else {
    // Single build
    build();
}
