# 🎬 Animated Backgrounds Extension

## Overview

The Animated Backgrounds Extension is an enhanced background system for SillyTavern that extends the native background functionality to support animated content including videos (MP4, WebM), animated images (GIF, WebP), and YouTube videos as backgrounds.

## Features

### 📁 Enhanced Media Support
- **Video Backgrounds**: MP4, WebM, AVI, MOV, MKV, OGV
- **Animated Images**: GIF, WebP with proper animation support  
- **YouTube Integration**: Direct YouTube URL support with custom embed parameters
- **Traditional Images**: JPG, JPEG, PNG, BMP, TIFF, SVG, ICO

### 🎛️ Advanced Controls
- **Video Controls**: Loop, autoplay, mute, volume control
- **Background Fitting**: Cover, contain, stretch, center options
- **Preload Settings**: Configure video preloading behavior
- **Error Handling**: Automatic fallback to thumbnail on load errors

### 🎨 Enhanced UI
- **Drag & Drop Support**: Drop files directly onto the background area
- **YouTube URL Input**: Dedicated input field for YouTube URLs
- **Media Type Indicators**: Visual indicators showing background type (🎥 Video, 📺 YouTube, 🎬 Animated)
- **Enhanced Upload Area**: Better visual feedback and instructions

## Installation

The Animated Backgrounds Extension is integrated into NemoPresetExt. Simply ensure NemoPresetExt is installed and the feature will be automatically available.

## Usage

### 1. Uploading Video Backgrounds

#### Method 1: File Upload
1. Navigate to **Extensions → Backgrounds**
2. Click the upload button (+ icon) 
3. Select your video file (MP4, WebM, etc.)
4. The video will automatically start playing as background

#### Method 2: Drag & Drop  
1. Open the Backgrounds panel
2. Drag your video file directly onto the background area
3. Drop the file to upload

### 2. Adding YouTube Backgrounds

#### Method 1: URL Input Field
1. Open the Backgrounds panel
2. Find the "Paste YouTube URL here..." input field
3. Paste any YouTube URL and press Enter

#### Method 2: Direct Paste
1. Copy a YouTube URL
2. Click in the background upload area
3. Paste (Ctrl+V) - the URL will be automatically detected

#### Supported YouTube URL Formats
- `https://www.youtube.com/watch?v=VIDEO_ID`
- `https://youtu.be/VIDEO_ID`  
- `https://www.youtube.com/embed/VIDEO_ID`

### 3. Animated Image Backgrounds

Upload GIF or WebP files the same way as videos. They will maintain their animation and loop automatically.

## Settings

Access settings in **Extensions → Backgrounds** under the "🎬 Animated Backgrounds" section:

### Core Settings
- **Enable Enhanced Backgrounds**: Toggle the entire extension on/off
- **Loop Videos**: Whether videos should loop continuously
- **Autoplay Videos**: Start videos automatically when selected
- **Mute Videos by Default**: Mute video audio by default

### Advanced Settings
- **Video Volume**: Control volume level (0-100%) when not muted
- **Background Fitting**: How backgrounds are scaled/positioned
  - **Cover**: Scale to cover entire area (may crop)
  - **Contain**: Scale to fit entirely visible (may have bars)
  - **Stretch**: Stretch to fill area exactly (may distort)
  - **Center**: Center image at natural size
- **Preload Videos**: Load videos before they're needed
- **Fallback to Thumbnail**: Use thumbnail if video fails to load

## Technical Details

### Media Type Detection
The extension automatically detects media types based on file extensions:

```javascript
// Video formats
['mp4', 'webm', 'avi', 'mov', 'mkv', 'ogv']

// Animated images  
['gif', 'webp']

// Static images
['jpg', 'jpeg', 'png', 'bmp', 'tiff', 'svg', 'ico']
```

### YouTube Integration
YouTube videos are embedded using YouTube's embed API with the following parameters:
- `autoplay`: Controlled by settings
- `loop`: Controlled by settings  
- `mute`: Controlled by settings
- `controls=0`: Hide player controls
- `modestbranding=1`: Minimize YouTube branding
- `rel=0`: Don't show related videos

### Performance Considerations
- Videos are loaded with configurable preload settings
- Thumbnails are generated and cached for better performance
- Error handling prevents broken backgrounds
- Lazy loading for better initial page load

## Compatibility

### SillyTavern Integration
The extension hooks into SillyTavern's native background system:
- Overrides `setBackground()` function for enhanced media support
- Extends `getMediaType()` with additional format detection
- Maintains compatibility with existing background features

### Browser Support
- **Chrome/Chromium**: Full support for all features
- **Firefox**: Full support for all features  
- **Safari**: Limited WebM support, full support for other formats
- **Mobile**: YouTube backgrounds may have limited autoplay support

## Troubleshooting

### Videos Not Playing
1. **Check Format**: Ensure video is in supported format (MP4, WebM recommended)
2. **Check Size**: Large videos may take time to load
3. **Browser Restrictions**: Some browsers block autoplay - click to start manually
4. **Codec Issues**: Ensure video uses web-compatible codecs (H.264, VP9)

### YouTube Videos Not Loading
1. **URL Format**: Ensure URL is a valid YouTube video link
2. **Video Availability**: Check if video is publicly accessible
3. **Network Issues**: YouTube embeds require internet connection
4. **Ad Blockers**: Some ad blockers may interfere with YouTube embeds

### Performance Issues
1. **Large Files**: Compress videos for better performance
2. **Multiple Videos**: Having many video backgrounds may use more memory
3. **Preload Settings**: Disable preloading if experiencing slowdowns

## File Size Recommendations

### Videos
- **Resolution**: 1080p maximum recommended
- **Length**: Under 30 seconds for backgrounds
- **File Size**: Under 50MB for optimal performance
- **Bitrate**: 2-5 Mbps for good quality/performance balance

### Animated Images
- **GIF**: Under 10MB, optimize frame count and colors
- **WebP**: Generally more efficient than GIF for animations

## Advanced Usage

### Custom CSS Integration
The extension adds CSS classes that can be styled:

```css
/* Target video backgrounds */
#enhanced-background-container video {
    /* Custom video styling */
}

/* Target YouTube backgrounds */
#enhanced-background-container iframe {
    /* Custom iframe styling */
}
```

### JavaScript API
Access extension functionality programmatically:

```javascript
// Set animated background
window.AnimatedBackgrounds.setAnimatedBackground(url, mediaType);

// Get media type
const type = window.AnimatedBackgrounds.getEnhancedMediaType(filename);

// Access settings
const settings = window.AnimatedBackgrounds.extensionSettings;
```

## Contributing

The extension is part of NemoPresetExt. Contributions and bug reports are welcome through the main repository.

## License

Same license as NemoPresetExt and SillyTavern.

---

*This extension enhances the SillyTavern experience by bringing your chat backgrounds to life with video and animation support.* 🎬✨