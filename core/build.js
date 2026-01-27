/**
 * Build script for core TypeScript modules
 * Compiles .ts files to .js for browser consumption
 */

import * as esbuild from 'esbuild';
import { readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Find all .ts files in core directory
const tsFiles = readdirSync(__dirname)
    .filter(f => f.endsWith('.ts') && !f.endsWith('.d.ts'))
    .map(f => join(__dirname, f));

if (tsFiles.length === 0) {
    console.log('No TypeScript files found to build');
    process.exit(0);
}

console.log(`Building ${tsFiles.length} TypeScript file(s)...`);

async function build() {
    try {
        for (const entryPoint of tsFiles) {
            const outfile = entryPoint.replace('.ts', '.js');

            await esbuild.build({
                entryPoints: [entryPoint],
                outfile,
                format: 'esm',
                platform: 'browser',
                target: ['es2022'],
                minify: false,  // Keep readable for debugging
                sourcemap: false,
                banner: {
                    js: '// Auto-generated from TypeScript - do not edit directly'
                }
            });

            console.log(`  ✅ ${entryPoint.split(/[\\/]/).pop()} -> ${outfile.split(/[\\/]/).pop()}`);
        }

        console.log('✅ Core build complete!');
    } catch (error) {
        console.error('❌ Build failed:', error);
        process.exit(1);
    }
}

await build();
