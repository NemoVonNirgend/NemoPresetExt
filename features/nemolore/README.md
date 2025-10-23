# NemoLore v2.0 - Advanced Memory Management & Intelligent Roleplay Enhancement

NemoLore is a comprehensive **SillyTavern extension** that revolutionizes roleplay through cutting-edge **AI-powered memory management**, **real-time entity recognition**, **automated lore expansion**, and **intelligent summarization**. Built on a modular, scalable architecture with hybrid AI/NLP processing systems.

## 🚀 What NemoLore v2.0 Does

### 🧠 Advanced Memory Management System
- **AI-Powered Summarization**: Multi-template summarization engine with 5 specialized types (conversation, narrative, dialogue, description, action)
- **Intelligent Context Injection**: `{{nemolore_summaries}}` and `{{NemoLore}}` macros inject relevant summaries into prompts automatically
- **Smart Memory Pooling**: Sophisticated memory allocation with automatic cleanup and compression
- **Persistent Storage**: Chat-specific summary caching with localStorage integration
- **Quality Control**: AI artifact removal, compression ratio analysis, and validation systems

### 🎯 Hybrid Auto-Lorebook System
- **Real-Time Entity Recognition**: Advanced NLP patterns detect persons, places, organizations, items, and titles as you chat
- **AI-Enhanced Generation**: Combines pattern-based detection with AI-powered content generation
- **Confidence Scoring**: Multi-factor confidence calculation using context clues, mention frequency, and linguistic patterns  
- **Incremental Learning**: Entity database learns and improves recognition over time
- **Automatic Integration**: Creates and updates World Info entries seamlessly during roleplay

### 🌟 Interactive Story Enhancement
- **Real-Time Noun Highlighting**: Dynamic highlighting of story elements with visual feedback
- **Cross-Chat Memory**: Share memories and entities across different conversations
- **Context-Aware Processing**: Sophisticated message analysis and relationship tracking
- **Vector-Based Search**: Semantic search through conversation history
- **Performance Monitoring**: Built-in performance analytics and optimization

### 📊 Comprehensive UI & Management
- **Summary Viewer**: Rich popup interface showing all generated summaries with metadata
- **System Diagnostics**: Built-in health checks and performance monitoring
- **Export Functionality**: JSON export of summaries and entity databases
- **Notification System**: Clean slide-out notifications instead of intrusive popups
- **Settings Management**: Extensive configuration options with live updates

## 🏗️ Architecture Overview

NemoLore v2.0 is built on the **Enhanced Workflow System** - a modular architecture that coordinates multiple specialized managers:

```
┌─────────────────────────────────────────────────────────────┐
│                    Enhanced Workflow System                 │
├─────────────────────────────────────────────────────────────┤
│ MemoryManager          │ AutoLorebookManager                │
│ - AI Summarization     │ - Entity Recognition               │
│ - Context Injection    │ - Confidence Scoring               │
│ - Cache Management     │ - Incremental Learning             │
│                        │                                    │
│ ContextInterceptor     │ VectorManager                      │
│ - Message Processing   │ - Semantic Search                  │  
│ - Summary Triggers     │ - Cross-Chat Memory                │
│                        │                                    │
│ UIManager              │ NotificationManager                │
│ - Summary Viewer       │ - User Feedback                    │
│ - Export Tools         │ - System Alerts                   │
└─────────────────────────────────────────────────────────────┘
```

## 🔧 Key Features & Systems

### 1. **Multi-Template Summarization Engine**
```javascript
// 5 Specialized Summary Types:
- Conversation: Key topics and decisions
- Narrative: Main events and character actions  
- Dialogue: Main points and emotional context
- Description: Important details preservation
- Action: Outcomes and consequences focus
```

### 2. **Advanced Entity Recognition Patterns**
```javascript
// Real-time NLP Detection:
- Persons: "Lord Marcus", "Captain Sarah"
- Places: "in Alderton", "at the Crimson Tavern" 
- Organizations: "Knights of the Round Table", "Mage Academy"
- Items: "Excalibur Sword", "Phoenix Ring"
- Titles: "King Arthur", "Professor McGonagall"
```

### 3. **Confidence Scoring Algorithm**
- **Base Score**: 0.5 starting confidence
- **Capitalization Boost**: +0.2 for proper nouns
- **Frequency Bonus**: +0.1 per additional mention (max +0.3)
- **Context Analysis**: +0.4 max for type-specific contextual clues
- **Dynamic Thresholds**: Person: 0.7, Place: 0.6, Organization: 0.8

### 4. **Memory Pool Management**
```javascript
// Intelligent Memory Allocation:
- Total Limit: 100MB
- Vectors: 50MB pool
- Summaries: 20MB pool  
- Lorebook: 15MB pool
- Cache: 15MB pool
```

## 📱 User Interface

### Summary Viewer
- **Rich Display**: Formatted summaries with metadata, timestamps, and compression ratios
- **Type Classification**: Visual indicators for conversation types (dialogue, action, etc.)
- **Message Grouping**: Shows how many messages each summary covers
- **Export Options**: One-click JSON export functionality

### Real-Time Notifications
- **Slide-out Design**: Non-intrusive notifications from screen edge
- **Action Buttons**: Interactive buttons for immediate responses
- **Auto-dismiss**: Configurable timeout with manual override
- **Status Updates**: Real-time feedback on system operations

### System Diagnostics
- **Health Checks**: Comprehensive system validation
- **Performance Metrics**: Memory usage, processing times, cache statistics
- **Debug Information**: Detailed logging for troubleshooting
- **Settings Validation**: Configuration verification and recommendations

## ⚙️ Configuration & Settings

### Memory Management
```javascript
{
  "enableSummarization": true,        // Enable AI summarization
  "summaryThreshold": 2000,          // Characters before summarization
  "summaryMaxLength": 200,           // Maximum summary length
  "maxContextSize": 4000,            // Target context window
  "updateInterval": 5                // Processing interval (seconds)
}
```

### Auto-Lorebook System
```javascript
{
  "enableAutoLorebook": true,        // Enable entity recognition
  "enable_entity_learning": true,    // Real-time learning
  "entity_scan_depth": 10,           // Messages to scan
  "max_auto_entries": 100,           // Maximum auto entries
  "auto_lorebook_no_prompt": false   // Skip confirmation prompts
}
```

### UI & Notifications
```javascript
{
  "enableHighlighting": true,        // Real-time noun highlighting
  "highlight_nouns": true,           // Visual highlighting
  "notificationTimeout": 5000,       // Notification display time
  "debugMode": false                 // Debug logging
}
```

## 🚀 Installation & Setup

### Prerequisites
- **SillyTavern**: Latest version recommended
- **API Access**: OpenAI, Claude, Gemini, OpenRouter, or local models
- **Browser**: Modern browser with ES6+ support

### Installation Steps

1. **Download & Extract**
   ```bash
   # Place in SillyTavern directory:
   /public/scripts/extensions/third-party/NemoLore/
   ```

2. **Enable Extension**
   - Start SillyTavern
   - Navigate to Extensions → Third-party Extensions
   - Find "NemoLore" and enable it
   - Refresh page if needed

3. **Initial Configuration**
   - Extension will auto-initialize on first load
   - Default settings optimized for most use cases
   - Customization available through settings panel

### First Use
1. **Start New Chat**: Extension activates automatically
2. **Entity Recognition**: Begins detecting story elements immediately  
3. **Auto-Lorebook Prompt**: System will offer to create lorebook for new characters
4. **Summary Generation**: Automatic summarization starts when threshold is reached
5. **Context Injection**: Use `{{nemolore_summaries}}` in your prompts to inject summaries

## 🎮 Usage Guide

### Macro Integration
```
{{nemolore_summaries}}  - Injects formatted conversation summaries
{{NemoLore}}           - Alternative macro name for same functionality
```

### Manual Controls
- **View Summaries**: Click "View Summaries" button to see all generated summaries
- **Export Data**: Use "Export Summaries" to download JSON data
- **System Check**: Run diagnostics with "System Check" button
- **Settings**: Modify behavior through extension settings panel

### Best Practices

1. **World Building**: Allow auto-lorebook creation for rich world development
2. **Core Memories**: Important moments are automatically preserved in summaries
3. **Context Management**: System automatically manages context size and relevance
4. **Entity Learning**: Frequent mentions improve entity recognition accuracy
5. **Performance**: Monitor system diagnostics for optimal performance

## 🔧 Advanced Features

### Cross-Chat Memory
- **Shared Entities**: Entity database can be shared across different chats
- **Relationship Tracking**: Monitors character interactions and developments  
- **Timeline Management**: Chronological organization of events and memories
- **Context Transfer**: Move relevant context between related conversations

### Vector Search Integration
- **Semantic Search**: Find relevant conversation segments using meaning-based search
- **Context Retrieval**: Automatically surface related memories during roleplay
- **Similarity Matching**: Identify similar scenarios and character interactions
- **Memory Clustering**: Group related memories for better organization

### Performance Optimization
- **Lazy Loading**: Components load on-demand for faster startup
- **Memory Pooling**: Efficient memory allocation and cleanup
- **Compression**: Automatic data compression for storage efficiency  
- **Caching**: Multi-level caching for improved response times

## 🛠️ API Integration

### Supported Providers
- **OpenAI**: GPT-3.5, GPT-4, GPT-4o models
- **Anthropic**: Claude 3 Haiku, Sonnet, Opus
- **Google**: Gemini Pro, Gemini Flash
- **OpenRouter**: Multi-provider access
- **Local**: Ollama, LM Studio, Text Generation WebUI

### API Configuration
```javascript
{
  "enable_async_api": false,         // Use independent API
  "api_provider": "openai",          // Provider selection
  "model": "gpt-4",                  // Model choice
  "endpoint": "auto",                // API endpoint
  "timeout": 30000                   // Request timeout
}
```

## 📊 Monitoring & Analytics

### Performance Metrics
- **Memory Usage**: Real-time memory pool statistics
- **Processing Times**: Summary generation and entity recognition speeds
- **Cache Hit Rates**: Efficiency of caching systems
- **Entity Discovery**: Rate of new entity detection

### Debug Information
- **Console Logging**: Detailed operation logs for development
- **Error Tracking**: Comprehensive error reporting and handling
- **Performance Profiling**: Built-in timing and optimization analytics
- **State Inspection**: Real-time system state monitoring

## 🔧 Troubleshooting

### Common Issues

**Extension Not Loading**
- Check file permissions and paths
- Verify SillyTavern version compatibility
- Review browser console for errors

**Summaries Not Generating** 
- Confirm API configuration and keys
- Check summary threshold settings
- Verify summarization is enabled

**Entity Recognition Issues**
- Adjust confidence thresholds
- Check minimum word length settings
- Review entity patterns configuration

**Memory/Performance Issues**
- Monitor memory pool usage
- Adjust cache sizes and cleanup intervals
- Enable performance monitoring

### Support Resources
- **Console Logs**: Enable debug mode for detailed logging
- **System Diagnostics**: Use built-in health checks
- **Settings Validation**: Verify configuration correctness
- **Performance Monitoring**: Track system resource usage

## 🎯 Roadmap & Future Features

### Planned Enhancements
- **Enhanced Vector Search**: Improved semantic search capabilities
- **Multi-Language Support**: Entity recognition in multiple languages
- **Advanced Analytics**: Detailed usage and performance analytics
- **API Expansion**: Additional AI provider integrations
- **Mobile Optimization**: Enhanced mobile experience

### Community Features
- **Shared Libraries**: Community-driven entity and summary libraries
- **Template Marketplace**: Custom summary and lorebook templates
- **Integration Plugins**: Extensions for popular roleplay tools
- **Collaborative Features**: Multi-user shared memory systems

---

**NemoLore v2.0** - Transforming roleplay through intelligent memory management, advanced entity recognition, and seamless AI integration.

## 📄 Technical Specifications

- **Version**: 2.0.0 - Fully Modularized Hybrid Architecture
- **Compatibility**: SillyTavern 1.12.0+
- **Architecture**: Enhanced Workflow System with specialized managers
- **Storage**: localStorage with chat-specific organization
- **Performance**: Optimized for real-time processing and minimal latency
- **Security**: Respects user privacy and API data handling preferences

**Built with ❤️ for the SillyTavern community**