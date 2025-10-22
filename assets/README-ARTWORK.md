# Vex Character Artwork

This directory is where you should place Vex's character artwork for the tutorial system.

## Required Images

### Default Image
- **Filename**: `vex-default.png`
- **Description**: The main/default Vex character artwork
- **Recommended size**: 800x1200px (portrait orientation)
- **Format**: PNG with transparency recommended

### Additional Expressions (Optional)
You can add multiple expressions for Vex to make tutorials more dynamic:

- `vex-happy.png` - Happy/excited expression
- `vex-explaining.png` - Teaching/explaining gesture
- `vex-thinking.png` - Thoughtful expression
- `vex-surprised.png` - Surprised reaction
- `vex-proud.png` - Proud/accomplished pose

## Image Requirements

- **Orientation**: Portrait/vertical (character should face forward or slightly to the side)
- **Style**: Should match your visual novel aesthetic
- **Background**: Transparent (PNG) or will be composited over gradient
- **Size**: Recommend keeping under 500KB for fast loading
- **Position**: Character should be positioned towards bottom of image (shown from waist up or full body)

## Using Custom Artwork in Tutorials

You can specify which artwork to use in each tutorial step by setting the `characterImage` property:

```javascript
{
    speaker: 'Vex',
    text: 'Welcome!',
    characterImage: 'scripts/extensions/third-party/NemoPresetExt/assets/vex-happy.png'
}
```

If no `characterImage` is specified, the system will use `vex-default.png`.

## Current Artwork

**Vex is here!** The mascot character artwork is now included as `vex-default.png`. She's a friendly fox girl with purple hair, ears, and tail, wearing a school uniform. Her welcoming pose and friendly expression make her perfect for guiding users through tutorials!

## Art Specifications for Best Results

1. **Lighting**: Ensure good lighting on the character
2. **Contrast**: Character should stand out from the dialog background
3. **Expression**: Clear, friendly expressions work best for tutorials
4. **Framing**: Leave some space above the character's head
5. **Consistency**: Use the same art style across all expressions

## Tips

- The character appears in a 400px wide container on desktop
- On mobile, the container shrinks to 180-250px
- Character scales to fit, maintaining aspect ratio
- A gradient backdrop is applied behind the character
- Animations apply on character entrance

Enjoy creating your tutorial experience with Vex! 🎨
