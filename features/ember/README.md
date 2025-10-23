# Ember 2.0 🔥 - Universal Code Renderer

**The AI doesn't need to know Ember exists!**

Ember 2.0 automatically detects and runs ANY JavaScript or HTML code without the AI needing special instructions, formatting, or knowledge about Ember.

## 🎯 Key Features

### ✨ **Completely Transparent to AI**
- AI writes normal, natural code
- No special syntax or formatting required
- No `ember.inject()` or custom APIs needed
- Works with ANY AI-generated code

### 🚀 **Universal Auto-Detection**
- Detects JavaScript with ultra-permissive patterns
- Handles HTML with embedded scripts
- Recognizes charts, games, forms, animations
- Auto-loads required libraries (Chart.js, D3, Three.js, P5.js, etc.)

### 🔄 **Smart DOM Redirection**
- Automatically creates missing elements (`document.getElementById('missing')` just works)
- Redirects `document.body.appendChild()` to appropriate containers
- Handles `root`, `app`, `main`, `.container` targets automatically
- No setup required

### 📚 **Latest Libraries (Auto-Loaded)**
- **Chart.js 4.4.0** - Data visualization
- **D3.js 7.8.5** - Advanced visualizations
- **Three.js 0.158.0** - 3D graphics
- **P5.js 1.7.0** - Creative coding
- **Anime.js 3.2.1** - Animations
- **Matter.js 0.19.0** - Physics
- **Fabric.js 5.3.0** - Canvas manipulation
- **PIXI.js 7.3.2** - 2D WebGL rendering

### 🛡️ **Secure & Safe**
- All code runs in sandboxed iframes
- No direct DOM access outside containers
- HTTPS-only external requests
- Auto-error handling and recovery

## 🎉 How It Works

### For Users:
1. Ask AI: *"Create a chart showing sales data"*
2. AI writes normal Chart.js code
3. Ember automatically detects and runs it
4. Chart appears instantly - no configuration needed!

### For AI:
```javascript
// AI writes this completely naturally:
const canvas = document.createElement('canvas');
document.body.appendChild(canvas);

new Chart(canvas, {
    type: 'bar',
    data: {
        labels: ['Jan', 'Feb', 'Mar'],
        datasets: [{
            data: [10, 20, 30],
            backgroundColor: ['red', 'blue', 'green']
        }]
    }
});
```

Ember automatically:
- Detects this is Chart.js code
- Loads Chart.js library from CDN
- Creates sandboxed environment
- Redirects DOM operations to safe container
- Displays the chart

## 🔧 Installation

1. Copy `Ember` folder to SillyTavern extensions:
   ```
   SillyTavern/public/scripts/extensions/third-party/Ember/
   ```

2. Restart SillyTavern

3. Enable Ember 2.0 in settings

4. **That's it!** No configuration needed.

## 💬 Example Conversations

### "Create an interactive button"
AI writes:
```javascript
const button = document.createElement('button');
button.textContent = 'Click me!';
button.addEventListener('click', () => alert('Hello!'));
document.body.appendChild(button);
```
**Result:** Interactive button appears and works immediately.

### "Make a calculator"
AI writes standard calculator HTML/JS code.
**Result:** Full calculator interface appears and functions.

### "Show me a chart of data"
AI writes normal Chart.js code.
**Result:** Chart appears with latest Chart.js automatically loaded.

### "Create a simple game"
AI writes standard game logic with canvas.
**Result:** Game runs immediately with all interactions working.

## 🎛️ Settings

### Main Settings
- **Enable Ember 2.0** - Master toggle
- **Universal auto-detection** - Detect and run any code (recommended: ON)

### Developer Settings
- **Debug mode** - Detailed console logging for troubleshooting

## 🧪 What Gets Auto-Detected

Ember's ultra-permissive detection catches:

### JavaScript Patterns:
- Variable declarations: `const`, `let`, `var`
- Functions: `function`, `=>`, `() =>`
- DOM methods: `document.`, `window.`, `.getElementById`, `.createElement`
- Library usage: `Chart`, `d3`, `THREE`, `p5`, `anime`, `Matter`
- Modern syntax: `async/await`, classes, template literals
- Common methods: `.map()`, `.forEach()`, `console.log`

### HTML Patterns:
- Any HTML tags: `<div>`, `<button>`, `<canvas>`
- Interactive elements: `<input>`, `<select>`, `<textarea>`
- Event handlers: `onclick`, `onchange`
- HTML entities: `&amp;`, `&lt;`, etc.

### Smart Library Detection:
- Mentions of "chart", "graph", "data" → loads Chart.js
- Canvas operations → loads P5.js and animation libraries
- 3D keywords → loads Three.js
- Physics terms → loads Matter.js

## 🔍 Auto-Loading System

When AI writes code mentioning:
- `new Chart()` → Chart.js loads automatically
- `d3.select()` → D3.js loads automatically
- `new THREE.Scene()` → Three.js loads automatically
- `createCanvas()` → P5.js loads automatically

No imports, no special syntax - just natural code!

## 🛠️ Technical Details

### UniversalRenderer Core
- **Ultra-permissive detection** - catches any code pattern
- **CDN library loading** - latest versions from jsdelivr
- **Smart DOM redirection** - creates missing elements on demand
- **Multi-execution fallback** - tries different execution methods
- **Auto-context system** - button clicks trigger conversation

### Execution Environment
- Sandboxed iframes with `allow-scripts allow-same-origin`
- Global error handling and recovery
- Automatic resizing based on content
- Cross-browser compatibility
- Mobile-responsive design

### Security Features
- No arbitrary code execution in main window
- Iframe sandboxing prevents malicious access
- HTTPS-only external requests
- Input validation and sanitization
- Safe library loading from trusted CDNs

## 🎯 Migration from Ember 1.x

### For Users:
- **No changes needed** - old conversations continue working
- New conversations get enhanced auto-detection

### For Developers:
- Remove `ember.inject()` calls (optional - still works)
- Remove `root` element references (optional - auto-created)
- Remove library loading code (automatic)
- Remove frontmatter metadata (not needed)

## 🐛 Troubleshooting

### Code Not Running?
1. Check browser console for errors
2. Enable debug mode in settings
3. Verify JavaScript syntax
4. Try simpler test code first

### Interactive Elements Not Working?
- Ember auto-makes buttons and inputs interactive
- Clicks and changes automatically trigger conversation
- No special configuration needed

### Libraries Not Loading?
- Ember auto-detects library usage
- Latest versions loaded from CDN
- Check network connectivity
- Console shows loading progress

## 🎊 Examples That Work Automatically

**Simple Chart:**
```javascript
const canvas = document.createElement('canvas');
document.body.appendChild(canvas);
new Chart(canvas, { /* chart config */ });
```

**Interactive Form:**
```html
<form>
    <input type="text" placeholder="Name">
    <button type="submit">Submit</button>
</form>
```

**Animation:**
```javascript
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
// Animation loop...
```

**3D Scene:**
```javascript
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera();
// 3D setup...
```

All of these work with **zero configuration** and **no special knowledge** required from the AI!

## 🏆 Benefits

### For Users:
- **Just ask for what you want** - no technical knowledge needed
- **Everything works immediately** - no setup or configuration
- **Latest libraries** - always up-to-date visualization tools
- **Safe execution** - sandboxed and secure

### For AI:
- **Write natural code** - no special Ember syntax to learn
- **Standard patterns work** - normal JavaScript/HTML practices
- **All libraries available** - comprehensive toolkit automatically loaded
- **Automatic error handling** - forgiving execution environment

---

**Ember 2.0: Where any code becomes interactive magic! 🔥✨**

*Just ask the AI to create something, and watch it come to life automatically.*