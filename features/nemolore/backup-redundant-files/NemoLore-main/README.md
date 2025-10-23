# NemoLore - Advanced Memory Management & Lore Expansion

NemoLore is a comprehensive SillyTavern extension that enhances roleplay through intelligent **memory management**, **narrative consistency**, and **automated lore expansion**. It provides advanced noun detection, interactive highlighting, AI-powered summarization, core memory tracking, and semantic search capabilities.

## What NemoLore Does

### 🧠 Smart Memory Management
- **Message Summarization**: Automatically compresses chat history to preserve context while staying under token limits
- **Core Memory Detection**: Identifies and preserves pivotal story moments marked with `<CORE_MEMORY>` tags
- **Running Memory System**: Maintains a configurable sliding window of recent conversation context
- **Vectorized Storage**: Enables semantic search through chat history for relevant context retrieval

### 🎯 Interactive Story Enhancement  
- **Real-time Noun Highlighting**: Detects and highlights important story elements (characters, locations, objects) as you chat
- **Automated Lorebook Creation**: Generates comprehensive world information and character details from your conversations
- **Dynamic Entry Updates**: Progressively enhances existing lore based on story development
- **World Expansion**: AI-powered generation of backstory and world details when prompted

### 📚 Intelligent Lore Management
- **Context-Aware Generation**: Creates relevant backstory and world details that fit your narrative
- **Relationship Tracking**: Monitors character interactions and developments
- **Timeline Management**: Organizes events and memories chronologically
- **Multi-API Support**: Works with OpenAI, Gemini, Claude, OpenRouter, and local models

## How It Works

1. **Real-time Analysis**: As you chat, NemoLore analyzes messages for important nouns and story elements
2. **Smart Highlighting**: Important elements are highlighted in the chat for easy identification
3. **Memory Management**: Long conversations are automatically summarized to preserve context while managing token usage
4. **Lore Generation**: When prompted, the extension generates detailed lorebook entries based on your chat history
5. **Continuous Enhancement**: Existing lore entries are updated and expanded as your story develops

## Setup Guide

### Prerequisites
- SillyTavern installation
- API access to at least one supported provider (OpenAI, Gemini, Claude, etc.)

### Installation

1. **Download the Extension**
   - Clone or download this repository
   - Place the entire `Nemo-Lore` folder in your SillyTavern's `public/scripts/extensions/third-party/` directory

2. **Enable the Extension**
   - Start SillyTavern
   - Go to Extensions → Third-party Extensions
   - Find "NemoLore" and enable it
   - Refresh the page if needed

3. **Initial Configuration**
   - Click the NemoLore panel in your extensions area
   - Configure your API settings:
     - **API Provider**: Choose your preferred AI service (OpenAI, Gemini, Claude, etc.)
     - **API Key**: Enter your API key for the selected provider
     - **Model**: Select the model you want to use
     - **Endpoint**: Set the API endpoint (usually auto-filled)

### Basic Settings Configuration

#### Memory Management Settings
- **Enable Summarization**: Turn on/off automatic message summarization
- **Running Memory Size**: Number of recent messages to keep visible (default: 50)
- **Summary Threshold**: Token count at which summarization begins (default: 1500)
- **Max Context Size**: Target maximum context size (default: 100000)
- **Prefill**: Default prefill for summarization requests (default: `<think>\n\n</think>`)

#### Lore Generation Settings
- **Auto-create Lorebooks**: Automatically create lorebooks for new chats
- **Noun Detection**: Configure minimum word length and filtering
- **Highlighting**: Enable/disable real-time noun highlighting

#### API Configuration
- **Connection Profile**: Optional preset for specific API configurations
- **Completion Preset**: Preset for text generation settings
- **Test Connection**: Use the built-in test to verify your API setup

### Usage Tips

1. **First Time Setup**: Run the connection test to ensure your API is working properly
2. **World Building**: When prompted about "fleshing out the world," say yes to generate initial lorebook entries
3. **Core Memories**: Use `<CORE_MEMORY>` tags around important story moments to preserve them
4. **Summarization**: The extension will automatically ask about summarizing long conversations
5. **Manual Controls**: Use the extension panel to manually trigger lore generation or adjust settings

### Supported API Providers

- **OpenAI**: GPT-3.5, GPT-4, and compatible models
- **Google Gemini**: Gemini Pro, Gemini Flash models  
- **Anthropic Claude**: Claude 3 family models
- **OpenRouter**: Access to multiple model providers
- **Local Models**: Compatible with local inference servers

### Troubleshooting

- **API Errors**: Check your API key and endpoint configuration
- **No Highlighting**: Ensure noun detection is enabled and minimum word length is appropriate
- **Summarization Issues**: Verify your completion preset and prefill settings
- **Extension Not Loading**: Check browser console for errors and ensure proper file placement

## Features Overview

### Current Capabilities
- ✅ Real-time noun detection and highlighting
- ✅ Automated message summarization with multiple API support
- ✅ Core memory detection and preservation
- ✅ Vectorized search through chat history
- ✅ Dynamic lorebook generation and updates
- ✅ Mobile-friendly interface with haptic feedback
- ✅ Accessibility support with keyboard navigation
- ✅ Universal browser compatibility

### Key Benefits
- **Maintains Context**: Keeps important story details accessible even in long conversations
- **Enhances Immersion**: Real-time highlighting and lore generation create richer roleplay experiences
- **Saves Time**: Automates tedious lore creation and memory management tasks
- **Flexible Configuration**: Extensive settings to customize the experience to your preferences
- **Privacy Focused**: All processing respects your API choice and data handling preferences

---

**NemoLore** - Transforming roleplay through intelligent memory management and dynamic lore expansion.