import * as esbuild from 'esbuild';

const isWatch = process.argv.includes('--watch');

const buildOptions = {
    entryPoints: ['src/index.tsx'],
    bundle: true,
    outfile: 'dist/nemotavern.js',
    format: 'esm',
    target: ['es2020'],
    jsx: 'automatic',
    minify: !isWatch,
    sourcemap: isWatch,
    external: [],
    define: {
        'process.env.NODE_ENV': isWatch ? '"development"' : '"production"'
    },
    loader: {
        '.tsx': 'tsx',
        '.ts': 'ts',
        '.css': 'css'
    }
};

if (isWatch) {
    const ctx = await esbuild.context(buildOptions);
    await ctx.watch();
    console.log('Watching for changes...');
} else {
    await esbuild.build(buildOptions);
    console.log('Build complete: dist/nemotavern.js');
}
