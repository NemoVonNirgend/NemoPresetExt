# NemoPresetExt React Prompt Views

React + TypeScript implementation of accordion and tray views for SillyTavern prompt management.

## Build Configuration

This subproject uses **esbuild** for fast compilation of TypeScript and JSX.

### Prerequisites

- Node.js 16+
- npm or yarn

### Installation

```bash
npm install
```

### Build Commands

**Production build:**
```bash
npm run build
```

**Development build with watch mode:**
```bash
npm run watch
```

**Type checking only (no output):**
```bash
npm run typecheck
```

### Build Outputs

- `dist/prompt-views.js` - Bundled JavaScript (150KB minified, includes React)
- `dist/prompt-views.css` - Bundled and minified CSS (4.8KB)

### Build Features

- Full React + React DOM bundled (no external dependencies)
- TypeScript compilation with strict type checking
- JSX automatic runtime (React 18)
- Minification in production mode
- Source maps in development mode
- CSS bundling and minification

### Integration

The built files are imported dynamically by the main extension:

```javascript
const reactViews = await import('./react/dist/prompt-views.js');
reactViews.mountPromptView(container, mode, options);
```

CSS is loaded via a `<link>` tag in the document head.

### Development Workflow

1. Start watch mode: `npm run watch`
2. Edit React components in `components/`
3. Changes automatically rebuild
4. Refresh SillyTavern to see updates

### Project Structure

```
react/
├── components/        # React components
├── hooks/            # React hooks
├── types/            # TypeScript type definitions
├── index.tsx         # Main entry point
├── styles.css        # Component styles
├── build.js          # esbuild configuration
├── tsconfig.json     # TypeScript configuration
├── package.json      # Dependencies and scripts
└── dist/             # Build output (gitignored)
```

### TypeScript Configuration

- Target: ES2020
- Module: ESNext with bundler resolution
- JSX: react-jsx (automatic runtime)
- Strict mode enabled
- Path aliases: `@/*` maps to project root

### esbuild Configuration

- Entry: `index.tsx`
- Format: ESM
- Platform: Browser
- Target: ES2020
- Bundle: All dependencies including React
- Minify: Production builds only
- Sourcemap: Development builds only
