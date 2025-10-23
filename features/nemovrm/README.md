# NEMO-VRM Extension with Organic Animation Behaviors

This is an enhanced version of the VRM extension for SillyTavern that adds more organic and dynamic character animations using behavior trees, procedural animations, and optional Gemini AI integration.

## Features

### Behavior Trees
- Characters now have behavior trees that determine their animations based on context
- Idle behaviors when no specific emotion is detected
- Emotion-based behaviors that respond to character expressions
- Animation sequences that combine multiple expressions and motions

### Procedural Animation System
- Smooth in-between frame animations for seamless transitions
- Automatic blinking with randomized intervals
- Breathing animations for more lifelike characters
- Idle sway animations for natural movement
- Nod and shake head animations for conversational gestures
- Head look-at tracking for eye contact
- Additive animation blending for natural motion combinations
- Easing functions for smooth animation transitions
- Slash commands for manual animation control

### 3D Environment System
- Grid-based navigation system for character movement
- Pathfinding with obstacle avoidance
- Interactive object system for environment interaction
- Dynamic grid sizing based on screen dimensions
- Visual grid helper for debugging

### Local Asset Management
- Dedicated asset folders within the extension directory:
  - `assets/models` for character models
  - `assets/animations` for animation files
  - `assets/environments` for environment assets
- Automatic scanning of local assets
- Priority loading of local assets over global ones
- Simplified asset management without navigating complex directory structures

### Movement System
- Characters can move around the screen to different positions
- Movement animations are automatically triggered when moving
- Characters can approach or retreat from the user
- Smooth movement with pathfinding to target positions
- Environment-aware navigation with obstacle avoidance

### Environment Interaction
- Characters can explore their environment when the user is away
- Predefined interaction points for consistent behaviors
- Position-based behaviors that change based on where the character is
- Interactive behaviors that combine movement and animations
- Object interaction capabilities

### Walking Animation Integration
- Automatic walking animation when characters move
- Transition to idle animation when movement completes
- Seamless animation blending during movement

### Environment Asset Loading
- Load custom 3D environments (FBX, GLTF, GLB)
- Position and scale environment assets
- Assets automatically block navigation grid
- Interactive object placement
- Support for both local and global asset paths

### Gemini AI Integration (Optional)
- Connect to Google's Gemini AI for dynamic behavior generation
- Uses the `gemini-1.5-flash-latest` model optimized for speed
- Characters can respond to conversation context with appropriate animations and movements
- Proactive behavior requests to ensure smooth animation transitions
- User presence detection to change character behaviors when user is away
- Response caching to reduce API calls
- Environment context provided to AI for better decisions

### Proactive Behavior Requests
- AI behaviors are requested before the current animation sequence ends
- Ensures seamless transitions between animation sequences
- Reduces waiting time between behaviors

### User Presence Detection
- Detects when the user is actively chatting vs. away
- Characters explore their environment when user is away
- Characters stay engaged when user is present
- Different behavior patterns based on user presence

### Animation Sequences
- Play multiple animations in sequence for more complex behaviors
- Automatic timing based on actual animation durations
- Seamless transitions between animations
- Combined behaviors (movement + animation + expression)

## Configuration

### Gemini Settings
1. Enable "Gemini-driven behaviors" in the extension settings
2. Enter your Gemini API Key (get one from [Google AI Studio](https://aistudio.google.com/))

### Environment Asset Settings
1. Specify the path to your environment asset (can be just filename for local assets)
2. Adjust the scale and position of the asset
3. Click "Load Environment Asset" to add it to the scene

### Animation Settings
The extension uses the existing animation mapping system but enhances it with:
- Sequences of animations that play in order
- Context-aware behavior selection
- Automatic idle animations when characters are not speaking

## Procedural Animation Commands

### Nod Command
Make a character nod their head:
```
/vrmnod [character=CharacterName] [intensity=0.2] [count=1]
```
Example: `/vrmnod character=Seraphina intensity=0.3 count=2`

### Shake Command
Make a character shake their head:
```
/vrmshake [character=CharacterName] [intensity=0.2] [count=2]
```
Example: `/vrmshake character=Seraphina intensity=0.3 count=3`

### Breath Command
Toggle breathing animation:
```
/vrmbreath [on|off] [character=CharacterName]
```
Example: `/vrmbreath on character=Seraphina`

## Technical Implementation

### Behavior Trees
Each character has a behavior tree that decides what animation to play based on:
- Current emotional state
- Time since last behavior
- Recent conversation context
- User presence status
- Character position
- Environment interaction points
- AI-generated behaviors (when enabled)

### Procedural Animation System
The procedural animation system provides:
- Real-time animation blending for smooth transitions
- Automatic animation updates at 60 FPS
- Per-character animation systems
- Additive blending with file-based animations
- Easing functions for natural motion
- Temporary animations (nod, shake) that clean up after completion
- Persistent animations (blink, breath, idle sway) that run continuously

### 3D Environment System
The environment system provides:
- Grid-based navigation with A* pathfinding
- Dynamic grid sizing based on screen dimensions
- Asset loading and positioning
- Interactive object system
- Obstacle detection and avoidance

### Local Asset Management
The system automatically scans and loads assets from:
- `assets/models` for VRM character models
- `assets/animations` for FBX/BVH animation files
- `assets/environments` for 3D environment assets

### Movement System
Characters can move around the screen:
- Position tracking for each character
- Movement animations triggered automatically
- Pathfinding with obstacle avoidance
- Environment interaction points for consistent behaviors

### Environment Interaction Points
Predefined points in the environment:
- Center of screen (0, 0)
- Four corners of screen
- Each point has associated behaviors
- Characters can move between points

### Interactive Objects
Objects in the environment:
- Can be interacted with by characters
- Different interaction types (inspect, use, etc.)
- AI-aware for behavior generation

### Gemini Integration
When Gemini integration is enabled, the system will:
1. Send recent conversation context, character state, and environment info to Gemini
2. Request an appropriate behavior (animation, expression, movement, or sequence)
3. Parse the response and execute the behavior
4. Proactively request the next behavior before the current one ends
5. Cache responses to reduce API calls
6. Fall back to rule-based behaviors if the AI fails

### Proactive Behavior Requests
The system requests new behaviors proactively:
1. 5 seconds before the current animation ends
2. Schedules the next behavior execution
3. Continues the cycle for seamless transitions

### User Presence Detection
The system detects user presence:
- When a user sends a message, the presence timer resets
- If no message is received for 30 seconds, the user is considered away
- AI is informed of user presence status when generating behaviors
- Different behavior patterns for present vs. away users

### Animation Sequences
The system can play sequences of behaviors:
1. Expression changes
2. Motion animations
3. Character movements
4. Object interactions
5. Complex behaviors combining multiple actions

## API Responses

When using AI integration, the system expects responses in JSON format:

```json
{
  "type": "motion",
  "value": "/assets/vrm/animation/happy_dance",
  "loop": false
}
```

Or for movement:

```json
{
  "type": "move",
  "value": {"x": 0.5, "y": -0.3}
}
```

Or for environment exploration:

```json
{
  "type": "explore",
  "value": "random"
}
```

Or for sequences:

```json
{
  "type": "sequence",
  "value": [
    {
      "type": "move",
      "value": {"x": 0.5, "y": -0.3}
    },
    {
      "type": "motion",
      "value": "/assets/vrm/animation/look_around",
      "loop": false
    },
    {
      "type": "expression",
      "value": "surprised"
    }
  ]
}
```

## Development

To extend the behavior system:

1. Modify `behaviortree.js` to add new behavior rules
2. Add new animation mappings in `constants.js`
3. Extend the AI prompt in `behaviortree.js` to include new behaviors
4. Add new interaction points in `behaviortree.js`
5. Add new environment objects in `environment.js`
6. Extend `proceduralAnimation.js` to add new procedural animation types

## Credits

Based on the original VRM extension for SillyTavern.