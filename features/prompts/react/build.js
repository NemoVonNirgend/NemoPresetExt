/**
 * Build script for React prompt views
 * Uses esbuild for fast TypeScript + JSX compilation
 */

import * as esbuild from 'esbuild';
import { existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const isWatch = process.argv.includes('--watch');

// Ensure dist directory exists
const distDir = join(__dirname, 'dist');
if (!existsSync(distDir)) {
    mkdirSync(distDir, { recursive: true });
}

// Common build options
const buildOptions = {
    entryPoints: [join(__dirname, 'index.tsx')],
    bundle: true,
    outfile: join(distDir, 'prompt-views.js'),
    format: 'esm',
    platform: 'browser',
    target: ['es2020'],
    jsx: 'automatic',
    minify: !isWatch,
    sourcemap: isWatch ? 'inline' : false,
    external: [],  // Bundle everything including React
    define: {
        'process.env.NODE_ENV': isWatch ? '"development"' : '"production"'
    },
    banner: {
        js: '/* NemoPresetExt React Prompt Views - Auto-generated, do not edit */'
    },
    loader: {
        '.tsx': 'tsx',
        '.ts': 'ts'
    }
};

async function build() {
    try {
        if (isWatch) {
            // Watch mode
            const ctx = await esbuild.context(buildOptions);
            await ctx.watch();
            console.log('👀 Watching for changes...');
        } else {
            // Single build
            const result = await esbuild.build(buildOptions);
            console.log('✅ Build complete!');
            if (result.metafile) {
                const outputs = Object.keys(result.metafile.outputs);
                outputs.forEach(output => {
                    const size = result.metafile.outputs[output].bytes;
                    console.log(`   ${output}: ${(size / 1024).toFixed(1)} KB`);
                });
            }
        }
    } catch (error) {
        console.error('❌ Build failed:', error);
        process.exit(1);
    }
}

// Also build CSS
async function buildCSS() {
    try {
        await esbuild.build({
            entryPoints: [join(__dirname, 'styles.css')],
            outfile: join(distDir, 'prompt-views.css'),
            minify: !isWatch,
            bundle: true,
            loader: { '.css': 'css' }
        });
        console.log('✅ CSS build complete!');
    } catch (error) {
        console.error('❌ CSS build failed:', error);
    }
}

// Run builds
await build();
await buildCSS();
