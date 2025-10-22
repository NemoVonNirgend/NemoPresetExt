# NemoLore Vectorization System - Technical White Paper

## Executive Summary

The NemoLore Vectorization System is a comprehensive semantic search and memory management solution designed for SillyTavern conversations. It combines machine learning-powered text embeddings with intelligent query systems to enable context-aware conversation recall, cross-chat references, and long-term memory management.

### Quick Start for Implementers

**What you need**:
- Transformers.js library (`@xenova/transformers`)
- IndexedDB-capable browser
- ~100MB storage space

**Core components to implement**:
1. **Vector Manager** - Generates and stores embeddings (Steps 1-5 in Section 4.2)
2. **Search System** - Multi-algorithm retrieval (Steps 6-10 in Section 4.2)
3. **Memory Manager** - Caching and optimization (Step 11 in Section 4.2)

**Time to implement**: 4-8 hours for basic system, 1-2 weeks for full production deployment

**Jump to**:
- [Prerequisites & Setup](#41-prerequisites) - Get started
- [Step-by-Step Guide](#42-step-by-step-implementation) - 12 detailed implementation steps
- [Full Integration Example](#step-12-full-integration-example) - Copy-paste starter code
- [Production Deployment](#46-deployment-and-production-considerations) - Go live checklist

---

## 1. What It Does

### Core Functionality

The vectorization system transforms conversational messages into mathematical vector representations (embeddings) that capture semantic meaning. These vectors enable:

- **Semantic Search**: Finding contextually relevant messages based on meaning rather than keyword matching
- **Memory Persistence**: Long-term storage of conversation context across sessions
- **Multi-Algorithm Search**: Hybrid search combining multiple ranking strategies
- **Cross-Chat References**: Linking related conversations across different chat sessions
- **Memory Optimization**: Intelligent caching and cleanup to maintain performance

### Key Capabilities

1. **Message Vectorization**: Converts text messages into 384-dimensional semantic vectors using the `Xenova/all-MiniLM-L6-v2` embedding model
2. **Advanced Query System**: Combines BM25, cosine similarity, semantic search, temporal relevance, and contextual algorithms
3. **Memory Management**: Implements LRU caching, compression, and adaptive memory thresholds
4. **Cross-Chat Networking**: Tracks references and connections between different conversations
5. **Result Fusion**: Uses Reciprocal Rank Fusion (RRF) and weighted sum methods to combine multiple search algorithms

---

## 2. How It Works

### Architecture Overview

The system consists of four major components:

```
┌─────────────────────────────────────────────────────────┐
│                   NemoLore Vectorization                │
├─────────────────────────────────────────────────────────┤
│  1. Vector Manager         - Core vectorization engine   │
│  2. Advanced Query System  - Multi-algorithm search      │
│  3. Memory Manager         - Storage & optimization      │
│  4. Cross-Chat Manager     - Inter-conversation links    │
└─────────────────────────────────────────────────────────┘
```

---

### 2.1 Vector Manager

**File**: `vectorization/vector-manager.js`

#### Embedding Pipeline

The system uses Transformers.js to run the `Xenova/all-MiniLM-L6-v2` model locally in the browser:

```javascript
// Model: Xenova/all-MiniLM-L6-v2
// Output: 384-dimensional Float32Array
// Pooling: Mean pooling with normalization
```

**Process Flow**:

1. **Message Reception** → Extract text content from incoming message
2. **Hash Generation** → Create unique hash for deduplication
3. **Embedding Generation** → Convert text to 384-dimensional vector using ML model
4. **Metadata Attachment** → Add timestamp, character info, message role
5. **Storage** → Save to IndexedDB with indices for fast retrieval
6. **Cache Update** → Add to LRU cache for quick access

#### IndexedDB Schema

```javascript
Store: "vectors"
Indices:
  - chatId: Non-unique, for filtering by conversation
  - timestamp: Non-unique, for temporal sorting
  - messageId: Non-unique, for message lookup
  - hash: Unique, for deduplication
```

#### Key Features

- **Singleton Model Loading**: Embedding model loaded once and reused
- **Deduplication**: Content hashing prevents duplicate vectors
- **LRU Cache**: 1000 most recent vectors kept in memory (configurable)
- **IndexedDB Storage**: Supports up to 10,000 vectors with browser persistence

---

### 2.2 Advanced Query System

**File**: `vectorization/advanced-query-system.js`

#### Multi-Algorithm Search

The query system employs five parallel search algorithms, each contributing unique strengths:

##### Algorithm Breakdown

| Algorithm | Weight | Purpose | Implementation |
|-----------|--------|---------|----------------|
| **BM25** | 30% | Term frequency analysis | Okapi BM25 with k1=1.2, b=0.75 |
| **Cosine Similarity** | 25% | Vector angle comparison | Dot product / magnitude calculation |
| **Semantic Search** | 25% | Meaning-based matching | Jaccard similarity on word sets |
| **Temporal Relevance** | 10% | Recency scoring | Exponential decay (30-day half-life) |
| **Contextual Relevance** | 10% | Same-chat/character bonus | Rule-based scoring |

##### BM25 Algorithm

```
BM25 Score = Σ (IDF × (tf × (k1 + 1)) / (tf + k1 × (1 - b + b × (|D| / avgdl))))

Where:
- IDF = Inverse Document Frequency
- tf = Term frequency in document
- k1 = 1.2 (term saturation parameter)
- b = 0.75 (length normalization)
- |D| = Document length
- avgdl = Average document length
```

##### Cosine Similarity

```
Cosine Similarity = (A · B) / (||A|| × ||B||)

Where:
- A, B = Vector embeddings
- · = Dot product
- ||A|| = Magnitude of vector A
```

##### Temporal Decay

```
Temporal Score = e^(-age_in_days / 30)

Gives higher scores to recent messages
30-day half-life means score drops 50% every month
```

#### Result Fusion Methods

**1. Reciprocal Rank Fusion (RRF)**

```javascript
RRF_Score(item) = Σ 1 / (k + rank_in_algorithm_i)
// k = 60 (standard RRF parameter)
```

Advantages:
- Robust to score scale differences
- Emphasizes top-ranked items
- No parameter tuning needed

**2. Weighted Sum Fusion**

```javascript
Weighted_Score(item) = Σ (score_in_algorithm_i × weight_i)
```

Advantages:
- Respects original scores
- Configurable algorithm importance
- Intuitive interpretation

**3. Hybrid Fusion** (Default)

Combines RRF and Weighted Sum with equal weight (50/50) for balanced results.

---

### 2.3 Memory Manager

**File**: `vectorization/memory-manager.js`

#### Memory Pool Architecture

The system maintains four isolated memory pools:

```
Total: 100MB
├── Vectors:   50MB (embeddings & metadata)
├── Summaries: 20MB (conversation summaries)
├── Lorebook:  15MB (knowledge entries)
└── Cache:     15MB (temporary data)
```

#### Optimization Strategies

**1. Adaptive Thresholds**

```javascript
Usage Levels:
- High:   >80% → Aggressive cleanup (free 30%)
- Medium: >60% → Moderate cleanup (free 15%)
- Low:    >40% → Light cleanup (free 5%)
```

**2. Cleanup Algorithms**

- **LRU** (Least Recently Used): Remove items with oldest access time
- **LFU** (Least Frequently Used): Remove items with lowest access count
- **FIFO** (First In First Out): Remove oldest created items
- **SIZE**: Remove largest items first
- **AGE**: Remove items by creation age

**3. Compression**

```javascript
Threshold: Items >1KB
Method: Run-Length Encoding (RLE)
Benefit Required: >20% size reduction
```

#### Summary System Integration

The Memory Manager includes an integrated summarization system that:

1. **Detects Conversation Type**: Action, dialogue, description, narrative, or general
2. **Pairs Messages**: Groups messages 0+1, 2+3, 4+5 for paired summarization
3. **Generates AI Summaries**: Uses LLM to create concise summaries (≤200 chars)
4. **Core Memory Detection**: Identifies `<CORE_MEMORY>` tags for important information
5. **Lorebook Integration**: Automatically creates lorebook entries from core memories

**Pairing Logic**:

```
Message 0: Individual summary (full content)
Messages 1-2: Paired summary
Messages 3-4: Paired summary
...etc
```

---

### 2.4 Cross-Chat Manager

**File**: `vectorization/cross-chat-manager.js`

#### Reference Detection

Analyzes messages for patterns indicating cross-chat references:

```javascript
Patterns:
- Continuation: "continue", "resumed", "where we left off"
- Callback: "remember", "recall", "mentioned earlier"
- Related: "similar to", "like before", "as we did"
- Follow-up: "following up", "next step"
- Branched: "alternative", "what if", "instead"
```

#### Connection Strength Calculation

```javascript
Strength = (reference_count × 0.2) +
           (recent_references × 0.3) +
           (avg_confidence × 0.5)

Max: 1.0 (strongest connection)
```

#### Network Analysis

- **Centrality**: Identifies hub conversations
- **Clustering**: Groups related chats
- **Pathfinding**: Finds conversation chains
- **Circular Detection**: Prevents infinite reference loops

---

## 3. The Ideal Scenario

### Perfect Use Case

The vectorization system excels in these scenarios:

#### 1. **Long-Running Character Roleplay**

**Scenario**: User has 50+ conversations with a character over months

**Benefits**:
- AI recalls specific events from weeks ago
- Cross-chat references maintain continuity
- Summaries prevent context loss
- Temporal decay ensures recent events prioritized

**Example Query**: *"What did we discuss about the magic system?"*

**System Response**:
1. BM25 finds keyword matches for "magic" and "system"
2. Semantic search identifies conceptually related messages
3. Temporal algorithm prioritizes recent discussions
4. Contextual algorithm boosts same-character messages
5. Fusion combines all signals → Top 10 relevant messages returned

#### 2. **Complex Multi-Session Projects**

**Scenario**: Planning a story arc across multiple brainstorming sessions

**Benefits**:
- Cross-chat manager links related planning sessions
- Memory manager maintains context across sessions
- Advanced query finds relevant ideas from any session
- Core memories automatically saved to lorebook

#### 3. **Character Development Tracking**

**Scenario**: Tracking character evolution over time

**Benefits**:
- Vectorization captures personality traits semantically
- Temporal search shows character changes over time
- Summaries highlight key developmental moments
- Cross-references show character consistency

---

### Performance Characteristics

**Optimal Conditions**:

```
Messages in DB:     1,000 - 5,000
Vectors in Cache:   500 - 1,000
Search Latency:     <100ms
Memory Usage:       <75MB
Embedding Time:     ~50ms per message
Query Time:         ~200ms (5 algorithms)
```

**Scalability**:

- **Small chats** (<100 messages): Instant results, minimal overhead
- **Medium chats** (100-1,000 messages): Optimal performance, full benefits
- **Large chats** (1,000-5,000 messages): Excellent recall, slight query delay
- **Huge chats** (>5,000 messages): May require cleanup, cache optimization

---

### Configuration Recommendations

#### For Best Performance:

```javascript
Settings:
- enableVectorization: true
- maxVectors: 5000
- cacheSize: 1000
- algorithms: ['bm25', 'cosine', 'semantic', 'temporal', 'contextual']
- fusionMethod: 'hybrid'
- enableCompression: true
- autoCleanup: true
```

#### Memory-Constrained Environments:

```javascript
Settings:
- maxVectors: 2000
- cacheSize: 500
- algorithms: ['cosine', 'temporal'] // Fewer algorithms
- fusionMethod: 'rrf' // Faster fusion
- enableCompression: true
```

#### Maximum Accuracy:

```javascript
Settings:
- maxVectors: 10000
- cacheSize: 2000
- algorithms: ['bm25', 'cosine', 'semantic', 'temporal', 'contextual']
- fusionMethod: 'hybrid'
- enableCoreMemories: true
```

---

## 4. Implementation Guide

This section provides step-by-step instructions for implementing the vectorization system in your own project.

### 4.1 Prerequisites

**Required Dependencies**:

```json
{
  "dependencies": {
    "@xenova/transformers": "^2.6.0"
  }
}
```

**Browser Requirements**:
- Modern browser with IndexedDB support
- ES6+ JavaScript support
- Minimum 100MB available storage
- WebAssembly support (for Transformers.js)

**Load Transformers.js**:

```html
<!-- Add to your HTML -->
<script type="module">
  import { pipeline } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.6.0';
  window.pipeline = pipeline;
</script>
```

---

### 4.2 Step-by-Step Implementation

#### Step 1: Set Up IndexedDB

Create the database structure for vector storage:

```javascript
// Initialize IndexedDB
function initializeDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('VectorDatabase', 2);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Create object store
      if (!db.objectStoreNames.contains('vectors')) {
        const store = db.createObjectStore('vectors', {
          keyPath: 'id',
          autoIncrement: true
        });

        // Create indices for fast queries
        store.createIndex('chatId', 'chatId', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('messageId', 'messageId', { unique: false });
        store.createIndex('hash', 'hash', { unique: true });
      }
    };
  });
}

// Usage
const db = await initializeDatabase();
```

#### Step 2: Initialize the Embedding Pipeline

Load the ML model using Transformers.js:

```javascript
class EmbeddingPipeline {
  static task = 'feature-extraction';
  static model = 'Xenova/all-MiniLM-L6-v2';
  static instance = null;

  static async getInstance(progress_callback = null) {
    if (this.instance === null) {
      if (!window.pipeline) {
        throw new Error('Transformers.js not loaded');
      }

      console.log('Loading embedding model...');
      this.instance = await window.pipeline(
        this.task,
        this.model,
        { progress_callback }
      );
      console.log('Model loaded successfully');
    }
    return this.instance;
  }
}

// Usage
const extractor = await EmbeddingPipeline.getInstance((progress) => {
  console.log(`Loading: ${progress.progress}%`);
});
```

#### Step 3: Implement Vector Generation

Convert text to embeddings:

```javascript
async function generateEmbedding(text) {
  // Validate input
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    console.warn('Invalid text for embedding');
    return null;
  }

  try {
    // Get embedding pipeline
    const extractor = await EmbeddingPipeline.getInstance();

    // Generate embedding with mean pooling and normalization
    const output = await extractor(text, {
      pooling: 'mean',
      normalize: true
    });

    // Convert Float32Array to regular array for IndexedDB
    return Array.from(output.data);

  } catch (error) {
    console.error('Embedding generation failed:', error);
    return null;
  }
}

// Usage
const embedding = await generateEmbedding("This is a test message");
console.log(embedding); // [0.123, -0.456, 0.789, ...]
```

#### Step 4: Store Vectors in IndexedDB

Save vectors with metadata:

```javascript
async function storeVector(db, vectorData) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['vectors'], 'readwrite');
    const store = transaction.objectStore('vectors');

    // Check for duplicate using hash
    const hashIndex = store.index('hash');
    const checkRequest = hashIndex.get(vectorData.hash);

    checkRequest.onsuccess = () => {
      if (checkRequest.result) {
        console.log('Vector already exists, skipping');
        resolve(null);
      } else {
        // Store new vector
        const addRequest = store.add(vectorData);

        addRequest.onsuccess = () => {
          console.log(`Vector stored with ID: ${addRequest.result}`);
          resolve(addRequest.result);
        };

        addRequest.onerror = () => reject(addRequest.error);
      }
    };

    checkRequest.onerror = () => reject(checkRequest.error);
  });
}

// Usage
const vector = {
  chatId: 'chat_123',
  messageId: 'msg_456',
  content: 'Hello world',
  embedding: await generateEmbedding('Hello world'),
  timestamp: Date.now(),
  hash: generateHash('Hello world'),
  role: 'user',
  metadata: {
    character: 'Alice',
    length: 11,
    wordCount: 2
  }
};

await storeVector(db, vector);
```

#### Step 5: Implement Content Hashing

Create unique hashes for deduplication:

```javascript
function generateHash(content) {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

// Usage
const hash = generateHash('Hello world'); // "1234abc"
```

#### Step 6: Implement Cosine Similarity

Calculate similarity between vectors:

```javascript
function calculateCosineSimilarity(vec1, vec2) {
  // Validate inputs
  if (!vec1 || !vec2 || vec1.length !== vec2.length) {
    return 0;
  }

  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;

  // Calculate dot product and magnitudes
  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    magnitude1 += vec1[i] * vec1[i];
    magnitude2 += vec2[i] * vec2[i];
  }

  // Calculate cosine similarity
  magnitude1 = Math.sqrt(magnitude1);
  magnitude2 = Math.sqrt(magnitude2);

  if (magnitude1 === 0 || magnitude2 === 0) {
    return 0;
  }

  return dotProduct / (magnitude1 * magnitude2);
}

// Usage
const similarity = calculateCosineSimilarity(
  [0.1, 0.2, 0.3],
  [0.15, 0.25, 0.35]
); // Returns: 0.9998 (very similar)
```

#### Step 7: Implement Vector Search

Search vectors by similarity:

```javascript
async function searchVectors(db, queryText, limit = 10) {
  // Generate query embedding
  const queryEmbedding = await generateEmbedding(queryText);
  if (!queryEmbedding) return [];

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['vectors'], 'readonly');
    const store = transaction.objectStore('vectors');
    const request = store.getAll();

    request.onsuccess = () => {
      const vectors = request.result;
      const results = [];

      // Calculate similarity for each vector
      for (const vector of vectors) {
        if (vector.embedding) {
          const similarity = calculateCosineSimilarity(
            queryEmbedding,
            vector.embedding
          );

          if (similarity > 0) {
            results.push({ vector, similarity });
          }
        }
      }

      // Sort by similarity (highest first) and return top results
      const topResults = results
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);

      resolve(topResults);
    };

    request.onerror = () => reject(request.error);
  });
}

// Usage
const results = await searchVectors(db, 'What is the magic system?', 5);
results.forEach(result => {
  console.log(`Similarity: ${result.similarity.toFixed(3)} - ${result.vector.content}`);
});
```

#### Step 8: Implement BM25 Algorithm

Add keyword-based search:

```javascript
class BM25 {
  constructor(k1 = 1.2, b = 0.75) {
    this.k1 = k1;
    this.b = b;
  }

  calculateScore(queryTerms, document, avgDocLength = 100) {
    const content = (document.content || '').toLowerCase();
    const docLength = content.split(/\s+/).length;
    let score = 0;

    for (const term of queryTerms) {
      const termLower = term.toLowerCase();
      const tf = (content.match(new RegExp(termLower, 'g')) || []).length;

      if (tf > 0) {
        // Simplified IDF calculation
        const idf = Math.log(1000 / (tf + 1));

        // BM25 formula
        const termScore = (idf * tf * (this.k1 + 1)) /
          (tf + this.k1 * (1 - this.b + this.b * (docLength / avgDocLength)));

        score += termScore;
      }
    }

    return score;
  }

  search(queryText, vectors) {
    const queryTerms = queryText.toLowerCase().split(/\s+/);
    const results = [];

    for (const vector of vectors) {
      const score = this.calculateScore(queryTerms, vector);
      if (score > 0) {
        results.push({ vector, score });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }
}

// Usage
const bm25 = new BM25();
const bm25Results = bm25.search('magic system', allVectors);
```

#### Step 9: Implement Temporal Scoring

Add recency bias to results:

```javascript
function calculateTemporalScore(timestamp, currentTime = Date.now()) {
  const ageInDays = (currentTime - timestamp) / (1000 * 60 * 60 * 24);

  // Exponential decay with 30-day half-life
  return Math.exp(-ageInDays / 30);
}

function addTemporalScoring(results) {
  const now = Date.now();

  return results.map(result => {
    const temporalScore = calculateTemporalScore(
      result.vector.timestamp,
      now
    );

    return {
      ...result,
      temporalScore,
      // Combine with original score (70% original, 30% temporal)
      combinedScore: (result.score || result.similarity) * 0.7 + temporalScore * 0.3
    };
  });
}

// Usage
const resultsWithTemporal = addTemporalScoring(searchResults);
```

#### Step 10: Implement Result Fusion

Combine multiple search algorithms:

```javascript
function reciprocalRankFusion(algorithmResults, k = 60) {
  const scoreMap = new Map();

  for (const [algorithmName, results] of Object.entries(algorithmResults)) {
    results.forEach((result, rank) => {
      const vectorId = result.vector.id || result.vector.hash;

      // RRF formula: 1 / (k + rank + 1)
      const rrfScore = 1 / (k + rank + 1);

      // Accumulate scores
      if (scoreMap.has(vectorId)) {
        scoreMap.get(vectorId).score += rrfScore;
      } else {
        scoreMap.set(vectorId, {
          vector: result.vector,
          score: rrfScore
        });
      }
    });
  }

  // Convert to array and sort
  return Array.from(scoreMap.values())
    .sort((a, b) => b.score - a.score);
}

// Usage
const fusedResults = reciprocalRankFusion({
  cosine: cosineResults,
  bm25: bm25Results,
  temporal: temporalResults
});
```

#### Step 11: Implement LRU Cache

Add in-memory caching for performance:

```javascript
class LRUCache {
  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
    this.cache = new Map();
    this.order = [];
  }

  get(key) {
    if (!this.cache.has(key)) return null;

    // Move to end (most recently used)
    this.order = this.order.filter(k => k !== key);
    this.order.push(key);

    return this.cache.get(key);
  }

  set(key, value) {
    // Remove if exists
    if (this.cache.has(key)) {
      this.order = this.order.filter(k => k !== key);
    }

    // Add to end
    this.cache.set(key, value);
    this.order.push(key);

    // Evict oldest if over size
    while (this.cache.size > this.maxSize) {
      const oldest = this.order.shift();
      this.cache.delete(oldest);
    }
  }

  has(key) {
    return this.cache.has(key);
  }

  clear() {
    this.cache.clear();
    this.order = [];
  }
}

// Usage
const vectorCache = new LRUCache(1000);
vectorCache.set('vec_123', vectorData);
const cached = vectorCache.get('vec_123');
```

#### Step 12: Full Integration Example

Put it all together:

```javascript
class VectorSearchSystem {
  constructor() {
    this.db = null;
    this.cache = new LRUCache(1000);
    this.bm25 = new BM25();
  }

  async initialize() {
    this.db = await initializeDatabase();
    console.log('Vector search system initialized');
  }

  async indexMessage(message) {
    // Generate embedding
    const embedding = await generateEmbedding(message.content);
    if (!embedding) return null;

    // Create vector object
    const vector = {
      chatId: message.chatId,
      messageId: message.id,
      content: message.content,
      embedding: embedding,
      timestamp: Date.now(),
      hash: generateHash(message.content),
      role: message.role,
      metadata: {
        character: message.character,
        length: message.content.length,
        wordCount: message.content.split(/\s+/).length
      }
    };

    // Store in database
    const id = await storeVector(this.db, vector);

    // Add to cache
    if (id) {
      vector.id = id;
      this.cache.set(id, vector);
    }

    return vector;
  }

  async search(query, options = {}) {
    const limit = options.limit || 10;

    // Get all vectors
    const allVectors = await this.getAllVectors();

    // Run multiple search algorithms
    const cosineResults = await searchVectors(this.db, query, limit * 2);
    const bm25Results = this.bm25.search(query, allVectors).slice(0, limit * 2);

    // Add temporal scoring
    const cosineWithTemporal = addTemporalScoring(cosineResults);
    const bm25WithTemporal = addTemporalScoring(bm25Results);

    // Fuse results
    const fusedResults = reciprocalRankFusion({
      cosine: cosineWithTemporal,
      bm25: bm25WithTemporal
    });

    return fusedResults.slice(0, limit);
  }

  async getAllVectors() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['vectors'], 'readonly');
      const store = transaction.objectStore('vectors');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}

// Usage
const searchSystem = new VectorSearchSystem();
await searchSystem.initialize();

// Index messages
await searchSystem.indexMessage({
  chatId: 'chat_123',
  id: 'msg_1',
  content: 'The magic system is based on elemental forces',
  role: 'assistant',
  character: 'Wizard'
});

// Search
const results = await searchSystem.search('How does magic work?', { limit: 5 });
results.forEach(result => {
  console.log(`Score: ${result.score.toFixed(3)} - ${result.vector.content}`);
});
```

---

### 4.3 Common Implementation Challenges

#### Challenge 1: Model Loading Time

**Problem**: Initial model load takes 5-10 seconds

**Solution**:
```javascript
// Show loading indicator
function showLoadingIndicator() {
  const indicator = document.createElement('div');
  indicator.id = 'model-loading';
  indicator.textContent = 'Loading AI model...';
  document.body.appendChild(indicator);
}

// Preload model on page load
window.addEventListener('DOMContentLoaded', async () => {
  showLoadingIndicator();
  await EmbeddingPipeline.getInstance((progress) => {
    document.getElementById('model-loading').textContent =
      `Loading: ${Math.round(progress.progress)}%`;
  });
  document.getElementById('model-loading').remove();
});
```

#### Challenge 2: IndexedDB Storage Limits

**Problem**: Browsers limit IndexedDB to ~50MB in some cases

**Solution**:
```javascript
// Implement automatic cleanup
async function cleanupOldVectors(db, maxAge = 30) {
  const cutoff = Date.now() - (maxAge * 24 * 60 * 60 * 1000);

  const transaction = db.transaction(['vectors'], 'readwrite');
  const store = transaction.objectStore('vectors');
  const index = store.index('timestamp');
  const range = IDBKeyRange.upperBound(cutoff);

  const request = index.openCursor(range);
  let deletedCount = 0;

  request.onsuccess = (event) => {
    const cursor = event.target.result;
    if (cursor) {
      cursor.delete();
      deletedCount++;
      cursor.continue();
    } else {
      console.log(`Cleaned up ${deletedCount} old vectors`);
    }
  };
}
```

#### Challenge 3: Search Performance on Large Datasets

**Problem**: Searching 10,000+ vectors is slow

**Solution**:
```javascript
// Use Web Workers for parallel processing
const searchWorker = new Worker('search-worker.js');

searchWorker.postMessage({
  action: 'search',
  query: queryEmbedding,
  vectors: allVectors
});

searchWorker.onmessage = (event) => {
  const results = event.data.results;
  displayResults(results);
};

// search-worker.js
self.onmessage = (event) => {
  const { query, vectors } = event.data;

  const results = vectors.map(vector => ({
    vector,
    similarity: calculateCosineSimilarity(query, vector.embedding)
  }))
  .filter(r => r.similarity > 0.5)
  .sort((a, b) => b.similarity - a.similarity)
  .slice(0, 10);

  self.postMessage({ results });
};
```

---

### 4.4 Testing Your Implementation

#### Unit Tests

```javascript
// Test embedding generation
async function testEmbedding() {
  const text = "Hello world";
  const embedding = await generateEmbedding(text);

  console.assert(embedding !== null, 'Embedding should not be null');
  console.assert(embedding.length === 384, 'Embedding should be 384-dimensional');
  console.assert(typeof embedding[0] === 'number', 'Embedding values should be numbers');

  console.log('✓ Embedding generation test passed');
}

// Test similarity calculation
function testSimilarity() {
  const vec1 = [1, 0, 0];
  const vec2 = [1, 0, 0];
  const vec3 = [0, 1, 0];

  const sim1 = calculateCosineSimilarity(vec1, vec2);
  const sim2 = calculateCosineSimilarity(vec1, vec3);

  console.assert(Math.abs(sim1 - 1.0) < 0.001, 'Identical vectors should have similarity 1.0');
  console.assert(Math.abs(sim2 - 0.0) < 0.001, 'Orthogonal vectors should have similarity 0.0');

  console.log('✓ Similarity calculation test passed');
}

// Test search
async function testSearch() {
  const system = new VectorSearchSystem();
  await system.initialize();

  // Index test messages
  await system.indexMessage({
    chatId: 'test',
    id: '1',
    content: 'The cat sat on the mat',
    role: 'user'
  });

  await system.indexMessage({
    chatId: 'test',
    id: '2',
    content: 'The dog ran in the park',
    role: 'user'
  });

  // Search
  const results = await system.search('cat on mat', { limit: 5 });

  console.assert(results.length > 0, 'Should return results');
  console.assert(results[0].vector.content.includes('cat'), 'Top result should be about cat');

  console.log('✓ Search test passed');
}

// Run all tests
async function runTests() {
  await testEmbedding();
  testSimilarity();
  await testSearch();
  console.log('✅ All tests passed!');
}
```

---

### 4.5 Performance Optimization Tips

1. **Batch Processing**: Index multiple messages at once
```javascript
async function indexBatch(messages) {
  const embeddings = await Promise.all(
    messages.map(msg => generateEmbedding(msg.content))
  );

  const transaction = db.transaction(['vectors'], 'readwrite');
  const store = transaction.objectStore('vectors');

  embeddings.forEach((embedding, i) => {
    store.add({
      ...messages[i],
      embedding
    });
  });

  return new Promise((resolve) => {
    transaction.oncomplete = () => resolve();
  });
}
```

2. **Lazy Loading**: Don't load all vectors at once
```javascript
async function searchWithCursor(db, queryEmbedding, limit) {
  const results = [];

  return new Promise((resolve) => {
    const transaction = db.transaction(['vectors'], 'readonly');
    const store = transaction.objectStore('vectors');
    const request = store.openCursor();

    request.onsuccess = (event) => {
      const cursor = event.target.result;

      if (cursor && results.length < limit * 2) {
        const vector = cursor.value;
        const similarity = calculateCosineSimilarity(
          queryEmbedding,
          vector.embedding
        );

        if (similarity > 0.5) {
          results.push({ vector, similarity });
        }

        cursor.continue();
      } else {
        resolve(results.sort((a, b) => b.similarity - a.similarity).slice(0, limit));
      }
    };
  });
}
```

3. **Debounce Indexing**: Don't index every keystroke
```javascript
let indexTimeout;

function debounceIndex(message, delay = 1000) {
  clearTimeout(indexTimeout);
  indexTimeout = setTimeout(async () => {
    await searchSystem.indexMessage(message);
  }, delay);
}
```

---

### 4.6 Deployment and Production Considerations

#### Deployment Checklist

```markdown
□ Transformers.js library loaded via CDN or bundled
□ IndexedDB fallback for unsupported browsers
□ Error handling for embedding failures
□ Loading indicators for model initialization
□ Performance monitoring enabled
□ Memory cleanup scheduled
□ User settings for cache size/limits
□ Backup/export functionality for vectors
□ Privacy considerations (local-only storage)
□ CORS headers configured if using external APIs
```

#### Production Configuration

```javascript
// Production-ready configuration
const productionConfig = {
  // Database settings
  database: {
    name: 'VectorSearchDB',
    version: 2,
    storeName: 'vectors',
    maxVectors: 5000,
    autoCleanup: true,
    cleanupInterval: 3600000 // 1 hour
  },

  // Cache settings
  cache: {
    enabled: true,
    maxSize: 1000,
    strategy: 'LRU'
  },

  // Model settings
  model: {
    name: 'Xenova/all-MiniLM-L6-v2',
    quantized: true,
    preload: true,
    progressCallback: true
  },

  // Search settings
  search: {
    algorithms: ['bm25', 'cosine', 'temporal'],
    fusionMethod: 'hybrid',
    defaultLimit: 10,
    minSimilarity: 0.3
  },

  // Performance settings
  performance: {
    batchSize: 10,
    workerEnabled: true,
    debounceDelay: 500,
    lazyLoad: true
  },

  // Error handling
  errorHandling: {
    retryCount: 3,
    fallbackEnabled: true,
    logErrors: true
  }
};
```

#### Monitoring and Analytics

```javascript
// Track performance metrics
class VectorMetrics {
  constructor() {
    this.metrics = {
      embeddingsGenerated: 0,
      searchesPerformed: 0,
      averageSearchTime: 0,
      cacheHitRate: 0,
      storageUsed: 0,
      errors: []
    };
  }

  recordEmbedding(duration) {
    this.metrics.embeddingsGenerated++;
    // Log to analytics service
  }

  recordSearch(duration, resultCount) {
    this.metrics.searchesPerformed++;
    this.metrics.averageSearchTime =
      (this.metrics.averageSearchTime * (this.metrics.searchesPerformed - 1) + duration) /
      this.metrics.searchesPerformed;
  }

  recordError(error) {
    this.metrics.errors.push({
      message: error.message,
      timestamp: Date.now(),
      stack: error.stack
    });
    console.error('[Vector Metrics]', error);
  }

  getReport() {
    return {
      ...this.metrics,
      uptime: Date.now() - this.startTime,
      cacheEfficiency: this.calculateCacheEfficiency()
    };
  }
}

// Usage
const metrics = new VectorMetrics();
metrics.recordSearch(150, 10);
console.log(metrics.getReport());
```

#### Error Recovery

```javascript
// Robust error handling with fallbacks
class RobustVectorSearch {
  async search(query, options = {}) {
    const maxRetries = 3;
    let lastError;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await this.performSearch(query, options);
      } catch (error) {
        lastError = error;
        console.warn(`Search attempt ${attempt + 1} failed:`, error);

        // Wait before retry (exponential backoff)
        await this.delay(Math.pow(2, attempt) * 1000);
      }
    }

    // All retries failed, use fallback
    console.error('All search attempts failed, using fallback');
    return this.fallbackSearch(query, options);
  }

  async fallbackSearch(query, options) {
    // Simple keyword search as fallback
    const allVectors = await this.getAllVectors();
    const queryTerms = query.toLowerCase().split(/\s+/);

    return allVectors
      .filter(vector =>
        queryTerms.some(term =>
          vector.content.toLowerCase().includes(term)
        )
      )
      .slice(0, options.limit || 10);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

#### Security Considerations

```javascript
// Sanitize user input before embedding
function sanitizeInput(text) {
  // Remove potentially harmful content
  let sanitized = text
    .replace(/<script[^>]*>.*?<\/script>/gi, '') // Remove scripts
    .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '') // Remove iframes
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .substring(0, 10000); // Limit length

  return sanitized;
}

// Validate vector data before storage
function validateVector(vector) {
  const required = ['chatId', 'content', 'embedding', 'timestamp'];

  for (const field of required) {
    if (!vector[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  if (!Array.isArray(vector.embedding)) {
    throw new Error('Embedding must be an array');
  }

  if (vector.embedding.length !== 384) {
    throw new Error('Embedding must be 384-dimensional');
  }

  return true;
}

// Usage
async function safeIndexMessage(message) {
  const sanitized = sanitizeInput(message.content);
  const embedding = await generateEmbedding(sanitized);

  const vector = {
    ...message,
    content: sanitized,
    embedding
  };

  validateVector(vector);
  await storeVector(db, vector);
}
```

---

### 4.7 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Interface Layer                      │
├─────────────────────────────────────────────────────────────────┤
│  • Chat Interface                                                │
│  • Search UI                                                     │
│  • Settings Panel                                                │
│  • Dashboard                                                     │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Application Layer                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐ │
│  │  Vector Manager  │  │  Query System    │  │  Memory Mgr  │ │
│  │                  │  │                  │  │              │ │
│  │ • Index messages │  │ • Multi-algo     │  │ • LRU Cache  │ │
│  │ • Generate hash  │  │   search         │  │ • Cleanup    │ │
│  │ • Deduplication  │  │ • Result fusion  │  │ • Compress   │ │
│  │ • Cache update   │  │ • Ranking        │  │ • Monitor    │ │
│  └────────┬─────────┘  └────────┬─────────┘  └──────┬───────┘ │
│           │                     │                     │          │
│           └─────────────────────┼─────────────────────┘          │
│                                 │                                │
└─────────────────────────────────┼────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                      ML/AI Layer                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │        Transformers.js (Xenova/all-MiniLM-L6-v2)         │  │
│  │                                                            │  │
│  │  Input: "The cat sat on the mat"                         │  │
│  │    │                                                      │  │
│  │    ▼                                                      │  │
│  │  [Tokenization] → [Transformer] → [Pooling]             │  │
│  │    │                                │                     │  │
│  │    ▼                                ▼                     │  │
│  │  Output: [0.123, -0.456, 0.789, ... ] (384-dim vector)  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Storage Layer                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌───────────────────┐       ┌──────────────────┐              │
│  │   IndexedDB       │       │   In-Memory      │              │
│  │   (Persistent)    │       │   LRU Cache      │              │
│  │                   │       │                  │              │
│  │ • 10K vectors     │◄─────►│ • 1K hot vectors │              │
│  │ • Full metadata   │       │ • O(1) access    │              │
│  │ • Indexed queries │       │ • Fast retrieval │              │
│  │ • Cross-session   │       │ • Auto-evict     │              │
│  └───────────────────┘       └──────────────────┘              │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘


Data Flow: Message Indexing
════════════════════════════

User sends message
      │
      ▼
[Sanitize & validate]
      │
      ▼
[Generate embedding] ──→ Transformers.js
      │                         │
      ▼                         │
[Create vector object] ◄────────┘
      │
      ├─→ [Check hash for duplicates] ──→ IndexedDB
      │                                        │
      │                                        ▼
      │                                   [Already exists?]
      │                                        │
      │                                 No ────┤──── Yes
      │                                        │      │
      │                                        ▼      ▼
      ├────────────────────────────────→ [Store] [Skip]
      │
      └─→ [Update LRU cache]
                │
                ▼
           [Complete]


Search Flow: Multi-Algorithm Query
═══════════════════════════════════

User query: "magic system"
      │
      ▼
[Generate query embedding]
      │
      ├──────────────────┬──────────────┬──────────────┐
      ▼                  ▼              ▼              ▼
   [BM25]          [Cosine]       [Semantic]    [Temporal]
   │                  │              │              │
   │                  │              │              │
   ▼                  ▼              ▼              ▼
Results (30%)   Results (25%)  Results (25%)  Results (10%)
   │                  │              │              │
   └──────────────────┴──────────────┴──────────────┘
                      │
                      ▼
              [Result Fusion]
               • RRF (50%)
               • Weighted Sum (50%)
                      │
                      ▼
              [Post-process]
               • Deduplicate
               • Apply threshold
               • Sort by score
                      │
                      ▼
              [Top 10 results]
                      │
                      ▼
               Display to user
```

---

### 4.8 Integration Examples

#### Integration with SillyTavern

```javascript
// Hook into SillyTavern's event system
eventSource.on(event_types.MESSAGE_SENT, async (data) => {
  const message = {
    chatId: getCurrentChatId(),
    id: data.messageId,
    content: data.mes,
    role: data.is_user ? 'user' : 'assistant',
    character: active_character,
    timestamp: Date.now()
  };

  await vectorSearchSystem.indexMessage(message);
});

// Add search command
eventSource.on(event_types.CHAT_CHANGED, () => {
  // Register slash command
  registerSlashCommand('search', async (args) => {
    const query = args.join(' ');
    const results = await vectorSearchSystem.search(query, { limit: 5 });

    // Display results in chat
    const resultText = results.map((r, i) =>
      `${i + 1}. ${r.vector.content.substring(0, 100)}... (${(r.score * 100).toFixed(1)}%)`
    ).join('\n');

    toastr.info(resultText, 'Search Results', { timeOut: 10000 });
  }, [], 'Search conversation history');
});
```

#### Integration with Express Backend

```javascript
// server.js
const express = require('express');
const app = express();

// Store vectors server-side for multi-device sync
app.post('/api/vectors/store', async (req, res) => {
  const { userId, vector } = req.body;

  // Validate
  if (!validateVector(vector)) {
    return res.status(400).json({ error: 'Invalid vector' });
  }

  // Store in database (MongoDB, PostgreSQL, etc.)
  await db.collection('vectors').insertOne({
    userId,
    ...vector,
    createdAt: new Date()
  });

  res.json({ success: true });
});

// Search endpoint
app.post('/api/vectors/search', async (req, res) => {
  const { userId, query, limit = 10 } = req.body;

  // Get user's vectors
  const userVectors = await db.collection('vectors')
    .find({ userId })
    .toArray();

  // Perform search (you'd need to run embeddings server-side)
  const results = performSearch(query, userVectors, limit);

  res.json({ results });
});
```

#### Integration with React

```javascript
// VectorSearch.jsx
import React, { useState, useEffect } from 'react';
import { VectorSearchSystem } from './vectorSearch';

export function VectorSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [system, setSystem] = useState(null);

  useEffect(() => {
    const initSystem = async () => {
      const sys = new VectorSearchSystem();
      await sys.initialize();
      setSystem(sys);
    };
    initSystem();
  }, []);

  const handleSearch = async () => {
    if (!system || !query) return;

    setLoading(true);
    try {
      const searchResults = await system.search(query, { limit: 10 });
      setResults(searchResults);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="vector-search">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
        placeholder="Search conversations..."
      />
      <button onClick={handleSearch} disabled={loading}>
        {loading ? 'Searching...' : 'Search'}
      </button>

      <div className="results">
        {results.map((result, i) => (
          <div key={i} className="result-item">
            <div className="score">{(result.score * 100).toFixed(1)}%</div>
            <div className="content">{result.vector.content}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## 5. Summary System Implementation

The NemoLore system includes an advanced conversation summarization feature integrated into the Memory Manager. This section details how to implement AI-powered message summarization with core memory detection.

### 5.1 Overview

The summary system automatically condenses conversation history into concise summaries to:
- **Reduce context bloat** - Keep AI prompts within token limits
- **Preserve key information** - Maintain important details from old messages
- **Enable long conversations** - Support indefinite chat lengths
- **Detect core memories** - Identify and save critical information to lorebook

### 5.2 Architecture

```
Message Flow → Grouping → AI Summarization → Core Memory Detection → Storage
     │             │              │                    │                  │
     │             │              │                    │                  ▼
     │             │              │                    │            [Summary Cache]
     │             │              │                    │                  │
     │             │              │                    └──────────→ [Lorebook Entry]
     │             │              │
     │             │              └──────────────→ [LLM API Call]
     │             │
     │             └──────→ [Paired Messages: 0, (1-2), (3-4), ...]
     │
     └──────────→ [New Messages]
```

---

### 5.3 Implementation Steps

#### Step 1: Summary Templates

Define templates for different conversation types:

```javascript
const summaryTemplates = {
  conversation: "Summarize the following conversation section, focusing on key topics, decisions, and important information:",

  narrative: "Provide a concise summary of this narrative section, highlighting main events and character actions:",

  dialogue: "Summarize this dialogue section, capturing the main points and emotional context:",

  description: "Condense this descriptive text while preserving important details:",

  action: "Summarize this action sequence, focusing on outcomes and consequences:"
};
```

#### Step 2: Message Grouping Strategy

Implement paired message grouping:

```javascript
function groupMessagesForSummarization(messages) {
  const groups = [];

  if (messages.length === 0) return groups;

  // Special case: First message (index 0) gets its own summary
  if (messages[0]) {
    groups.push([messages[0]]);
  }

  // Pair subsequent messages (1-2, 3-4, 5-6, etc.)
  for (let i = 1; i < messages.length; i += 2) {
    if (i + 1 < messages.length) {
      // Pair of messages
      groups.push([messages[i], messages[i + 1]]);
    } else {
      // Odd message at end
      groups.push([messages[i]]);
    }
  }

  return groups;
}

// Example output:
// Input: [msg0, msg1, msg2, msg3, msg4]
// Output: [[msg0], [msg1, msg2], [msg3, msg4]]
```

**Why paired summarization?**
- Message 0 often contains important setup/context
- Pairing creates natural conversation units
- Balances granularity vs. context preservation
- Reduces API calls compared to per-message summarization

#### Step 3: Content Type Detection

Detect the type of conversation for optimal summarization:

```javascript
function detectMessageGroupType(messageGroup) {
  // Combine all message content
  const combinedContent = messageGroup
    .map(msg => msg.content.toLowerCase())
    .join(' ');

  // Pattern matching for content types
  const patterns = {
    action: /\b(moves|walks|runs|attacks|casts|performs|does|action)\b/,
    dialogue: /["']|says?|tells?|asks?|replies?|responds?/,
    description: /\b(looks?|appears?|seems?|describes?|detailed?|beautiful)\b/,
    narrative: /\b(then|next|after|before|during|while|when)\b/
  };

  // Check patterns in priority order
  for (const [type, pattern] of Object.entries(patterns)) {
    if (pattern.test(combinedContent)) {
      return type;
    }
  }

  return 'conversation'; // Default
}

// Usage
const type = detectMessageGroupType([
  { content: "The wizard casts a fireball spell at the dragon" }
]);
console.log(type); // "action"
```

#### Step 4: Format Messages for AI

Prepare messages for the LLM prompt:

```javascript
function formatMessagesForSummarization(messageGroup) {
  return messageGroup.map((msg, index) => {
    const role = msg.is_user ? 'User' : msg.name || 'Assistant';
    const content = msg.content.substring(0, 1000); // Limit length
    return `[${index + 1}] ${role}: ${content}`;
  }).join('\n\n');
}

// Example output:
// [1] User: I want to explore the ancient ruins
//
// [2] Gandalf: The ruins are dangerous, but I'll guide you there
```

#### Step 5: Create Summarization Prompt

Build the complete prompt for the LLM:

```javascript
function createSummarizationPrompt(template, formattedMessages, groupType, maxLength = 200) {
  return `${template}

Context: This is a ${groupType} section from a conversation.
Target length: ${maxLength} characters or less.
Focus on: Key information, decisions made, important events, and character development.

IMPORTANT: If this message contains critical information that should be permanently remembered
(character details, world facts, plot points, relationships), wrap your summary with
<CORE_MEMORY> tags. Only use these tags for truly important information.

Messages to summarize:
${formattedMessages}

Summary:`;
}

// Example prompt:
// Summarize the following conversation section...
// Context: This is an action section from a conversation.
// Target length: 200 characters or less.
// ...
// [1] User: I cast fireball at the dragon
// [2] Wizard: The dragon roars and takes damage
//
// Summary:
```

#### Step 6: Generate Summary with AI

Call the LLM API to generate the summary:

```javascript
async function generateSummaryWithAI(prompt, apiEndpoint = '/api/generate') {
  try {
    // Option 1: Use SillyTavern's built-in generation
    if (typeof generateQuietPrompt === 'function') {
      const response = await generateQuietPrompt(prompt, false, false);
      return cleanSummaryText(response);
    }

    // Option 2: Direct API call
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: prompt,
        max_tokens: 150,
        temperature: 0.7,
        stop: ['\n\n', 'User:', 'Assistant:']
      })
    });

    const data = await response.json();
    return cleanSummaryText(data.text || data.content);

  } catch (error) {
    console.error('AI summary generation failed:', error);
    return null;
  }
}

function cleanSummaryText(text) {
  return text
    .trim()
    .replace(/^(Here's a summary|Summary:|In summary)/i, '')
    .replace(/^[^\w]*/, '')
    .trim();
}

// Example output:
// Input: "Here's a summary: The user explored ancient ruins with the wizard."
// Output: "The user explored ancient ruins with the wizard."
```

#### Step 7: Core Memory Detection

Detect and handle core memories:

```javascript
function detectCoreMemory(summaryText) {
  const hasCoreMemoryTag = /<CORE_MEMORY>/.test(summaryText);
  const cleanSummary = summaryText.replace(/<\/?CORE_MEMORY>/g, '').trim();

  return {
    isCoreMemory: hasCoreMemoryTag,
    text: cleanSummary
  };
}

async function handleCoreMemory(summaryData, lorebookManager) {
  if (!summaryData.isCoreMemory) return;

  console.log('🌟 CORE MEMORY DETECTED:', summaryData.text);

  // Create lorebook entry
  const lorebookEntry = {
    keys: extractKeywords(summaryData.text),
    content: summaryData.text,
    priority: 100, // High priority for core memories
    selective: true,
    constant: false,
    position: 'after_char',
    created: Date.now(),
    source: 'core_memory'
  };

  // Add to lorebook
  await lorebookManager.addEntry(lorebookEntry);

  // Show notification to user
  showNotification('Core Memory Saved', summaryData.text, 'success');
}

function extractKeywords(text) {
  // Simple keyword extraction (can be improved with NLP)
  const words = text.toLowerCase().split(/\s+/);
  const stopWords = ['the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or'];

  return words
    .filter(word => word.length > 3 && !stopWords.includes(word))
    .slice(0, 5); // Top 5 keywords
}
```

#### Step 8: Summary Storage

Store summaries in chat metadata:

```javascript
class SummaryCache {
  constructor() {
    this.cache = new Map();
    this.chatId = null;
  }

  async load(chatId) {
    this.chatId = chatId;

    try {
      // Load from SillyTavern's chat_metadata
      if (chat_metadata && chat_metadata.nemolore_summaries) {
        const stored = chat_metadata.nemolore_summaries;

        for (const [key, summary] of Object.entries(stored)) {
          this.cache.set(parseInt(key), summary);
        }

        console.log(`Loaded ${this.cache.size} summaries from chat metadata`);
      }
    } catch (error) {
      console.error('Failed to load summary cache:', error);
    }
  }

  async save() {
    try {
      // Convert Map to object for storage
      const cacheObj = {};
      for (const [key, value] of this.cache.entries()) {
        cacheObj[key] = value;
      }

      // Save to SillyTavern's chat_metadata
      if (chat_metadata) {
        chat_metadata.nemolore_summaries = cacheObj;

        if (typeof saveMetadata === 'function') {
          await saveMetadata();
          console.log(`Saved ${this.cache.size} summaries to chat metadata`);
        }
      }
    } catch (error) {
      console.error('Failed to save summary cache:', error);
    }
  }

  set(messageIndex, summary) {
    this.cache.set(messageIndex, {
      text: summary.text,
      isCoreMemory: summary.isCoreMemory,
      type: summary.type,
      created: Date.now(),
      messageCount: summary.messageCount
    });
  }

  get(messageIndex) {
    return this.cache.get(messageIndex);
  }

  has(messageIndex) {
    return this.cache.has(messageIndex);
  }

  getAllSummaries() {
    return Array.from(this.cache.values())
      .sort((a, b) => b.created - a.created);
  }
}
```

#### Step 9: Proactive Summarization

Automatically summarize new messages:

```javascript
async function processNewMessage(message, messageIndex, summaryCache) {
  // Skip if already summarized
  if (summaryCache.has(messageIndex)) {
    return;
  }

  // Message 0: Individual summary
  if (messageIndex === 0) {
    const summary = {
      text: message.content, // Use full content for first message
      isFullContent: true,
      created: Date.now(),
      messageCount: 1,
      type: 'conversation'
    };

    summaryCache.set(0, summary);
    await summaryCache.save();
    return;
  }

  // Even-numbered messages: Pair with previous
  if (messageIndex % 2 === 0 && messageIndex > 0) {
    const previousMessage = chat[messageIndex - 1];

    if (previousMessage) {
      const messageGroup = [previousMessage, message];
      const summary = await summarizeMessageGroup(messageGroup);

      if (summary) {
        // Store summary on the AI's message (or user's, depending on setting)
        const targetIndex = message.is_user ? messageIndex - 1 : messageIndex;
        summaryCache.set(targetIndex, summary);

        // Store marker on the other message
        const markerIndex = targetIndex === messageIndex ? messageIndex - 1 : messageIndex;
        summaryCache.set(markerIndex, {
          text: `[Summarized with message ${targetIndex}]`,
          isMarker: true
        });

        await summaryCache.save();

        // Handle core memory
        if (summary.isCoreMemory) {
          await handleCoreMemory(summary, lorebookManager);
        }
      }
    }
  }
}

// Hook into message events
eventSource.on(event_types.MESSAGE_RECEIVED, async (messageIndex) => {
  const message = chat[messageIndex];
  await processNewMessage(message, messageIndex, summaryCache);
});
```

#### Step 10: Context Injection

Inject summaries into AI context:

```javascript
function getSummariesForInjection(summaryCache, options = {}) {
  const maxSummaries = options.maxSummaries || 5;
  const maxLength = options.maxLength || 500;

  // Get recent summaries
  const summaries = summaryCache.getAllSummaries()
    .filter(s => !s.isMarker && s.text)
    .slice(0, maxSummaries);

  if (summaries.length === 0) {
    return '';
  }

  // Format for injection
  const formattedSummaries = summaries
    .map(s => `• ${s.text}`)
    .join('\n');

  // Truncate if too long
  const finalText = formattedSummaries.length > maxLength
    ? formattedSummaries.substring(0, maxLength) + '...'
    : formattedSummaries;

  return `**Previous Conversation Summary:**\n${finalText}\n\n`;
}

// Inject before AI generation
async function generateWithContext(prompt, summaryCache) {
  const summaryContext = getSummariesForInjection(summaryCache);
  const fullPrompt = summaryContext + prompt;

  return await generateQuietPrompt(fullPrompt);
}
```

---

### 5.4 Complete Summary System Example

Full working implementation:

```javascript
class ConversationSummarizer {
  constructor(settings) {
    this.settings = settings;
    this.summaryCache = new SummaryCache();
    this.templates = summaryTemplates;
  }

  async initialize(chatId) {
    await this.summaryCache.load(chatId);
    console.log('Conversation Summarizer initialized');
  }

  async processMessage(message, messageIndex) {
    if (!this.settings.enableSummarization) return;
    if (this.summaryCache.has(messageIndex)) return;

    // Message 0: Full content
    if (messageIndex === 0) {
      this.summaryCache.set(0, {
        text: message.content,
        isFullContent: true,
        created: Date.now(),
        messageCount: 1,
        type: 'conversation'
      });
      await this.summaryCache.save();
      return;
    }

    // Even messages: Pair and summarize
    if (messageIndex % 2 === 0 && messageIndex > 0) {
      const prevMessage = chat[messageIndex - 1];
      if (!prevMessage) return;

      const messageGroup = [prevMessage, message];

      // Detect type
      const type = detectMessageGroupType(messageGroup);

      // Format messages
      const formatted = formatMessagesForSummarization(messageGroup);

      // Create prompt
      const template = this.templates[type] || this.templates.conversation;
      const prompt = createSummarizationPrompt(template, formatted, type);

      // Generate summary
      const summaryText = await generateSummaryWithAI(prompt);

      if (summaryText) {
        // Detect core memory
        const { isCoreMemory, text } = detectCoreMemory(summaryText);

        const summary = {
          text: text,
          isCoreMemory: isCoreMemory,
          type: type,
          messageCount: 2,
          created: Date.now(),
          metadata: {
            originalLength: messageGroup.reduce((sum, msg) =>
              sum + msg.content.length, 0),
            summaryLength: text.length
          }
        };

        // Store summary
        const targetIndex = message.is_user ? messageIndex - 1 : messageIndex;
        this.summaryCache.set(targetIndex, summary);

        // Store marker
        const markerIndex = targetIndex === messageIndex ? messageIndex - 1 : messageIndex;
        this.summaryCache.set(markerIndex, {
          text: `[Summarized with message ${targetIndex}]`,
          isMarker: true
        });

        await this.summaryCache.save();

        // Handle core memory
        if (isCoreMemory && this.settings.enableCoreMemories) {
          await handleCoreMemory(summary, this.lorebookManager);
        }

        console.log(`✅ Summarized messages ${messageIndex-1}-${messageIndex}`);
      }
    }
  }

  getContextInjection() {
    return getSummariesForInjection(this.summaryCache, {
      maxSummaries: this.settings.maxSummariesInContext || 5,
      maxLength: this.settings.maxSummaryLength || 500
    });
  }
}

// Usage
const summarizer = new ConversationSummarizer({
  enableSummarization: true,
  enableCoreMemories: true,
  maxSummariesInContext: 5
});

await summarizer.initialize(getCurrentChatId());

// Hook into messages
eventSource.on(event_types.MESSAGE_RECEIVED, async (index) => {
  await summarizer.processMessage(chat[index], index);
});

// Use in generation
const context = summarizer.getContextInjection();
const response = await generateWithContext(userPrompt, context);
```

---

### 5.5 Advanced Features

#### Batch Summarization

Summarize multiple message groups at once:

```javascript
async function batchSummarize(messages, startIndex = 0) {
  const groups = groupMessagesForSummarization(messages);
  const summaries = [];

  // Process in batches of 5 to avoid rate limits
  const batchSize = 5;

  for (let i = 0; i < groups.length; i += batchSize) {
    const batch = groups.slice(i, i + batchSize);

    const batchPromises = batch.map(async (group) => {
      const type = detectMessageGroupType(group);
      const formatted = formatMessagesForSummarization(group);
      const template = summaryTemplates[type];
      const prompt = createSummarizationPrompt(template, formatted, type);

      return await generateSummaryWithAI(prompt);
    });

    const batchResults = await Promise.all(batchPromises);
    summaries.push(...batchResults);

    // Wait between batches
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return summaries;
}
```

#### Summary Quality Scoring

Rate summary quality:

```javascript
function scoreSummaryQuality(summary, originalMessages) {
  let score = 0;

  // Length check (not too short, not too long)
  const idealLength = 150;
  const lengthRatio = summary.text.length / idealLength;
  if (lengthRatio > 0.5 && lengthRatio < 1.5) {
    score += 25;
  }

  // Information density (keywords preserved)
  const originalText = originalMessages.map(m => m.content).join(' ');
  const originalKeywords = extractKeywords(originalText);
  const summaryKeywords = extractKeywords(summary.text);

  const preservedKeywords = originalKeywords.filter(k =>
    summaryKeywords.includes(k)
  );
  score += (preservedKeywords.length / originalKeywords.length) * 50;

  // Coherence (proper sentence structure)
  const hasPunctuation = /[.!?]/.test(summary.text);
  const hasCapitalization = /^[A-Z]/.test(summary.text);
  if (hasPunctuation && hasCapitalization) {
    score += 25;
  }

  return Math.min(100, score);
}
```

#### Regenerate Summary

Allow users to regenerate poor summaries:

```javascript
async function regenerateSummary(messageIndex, summaryCache) {
  // Get original messages
  const summary = summaryCache.get(messageIndex);
  if (!summary || summary.isMarker) return;

  const messages = summary.messageCount === 1
    ? [chat[messageIndex]]
    : [chat[messageIndex - 1], chat[messageIndex]];

  // Regenerate with different temperature
  const type = detectMessageGroupType(messages);
  const formatted = formatMessagesForSummarization(messages);
  const template = summaryTemplates[type];
  const prompt = createSummarizationPrompt(template, formatted, type);

  const newSummaryText = await generateSummaryWithAI(prompt + '\n\n(Provide an alternative summary)');

  if (newSummaryText) {
    const { isCoreMemory, text } = detectCoreMemory(newSummaryText);

    summaryCache.set(messageIndex, {
      ...summary,
      text: text,
      isCoreMemory: isCoreMemory,
      regenerated: true,
      regeneratedAt: Date.now()
    });

    await summaryCache.save();
    console.log('Summary regenerated');
  }
}
```

---

### 5.6 Testing the Summary System

```javascript
// Test summary generation
async function testSummarization() {
  const testMessages = [
    { content: "Let's explore the ancient ruins", is_user: true },
    { content: "The ruins are dangerous. I'll guide you there.", is_user: false, name: "Gandalf" }
  ];

  const type = detectMessageGroupType(testMessages);
  console.assert(type === 'narrative', 'Should detect narrative type');

  const formatted = formatMessagesForSummarization(testMessages);
  console.assert(formatted.includes('User:'), 'Should format user messages');
  console.assert(formatted.includes('Gandalf:'), 'Should format character messages');

  const prompt = createSummarizationPrompt(
    summaryTemplates.narrative,
    formatted,
    'narrative'
  );
  console.assert(prompt.includes('narrative section'), 'Should include type');

  console.log('✓ Summarization tests passed');
}

// Test core memory detection
function testCoreMemory() {
  const text1 = "The user explored ruins.";
  const result1 = detectCoreMemory(text1);
  console.assert(!result1.isCoreMemory, 'Should not detect core memory without tags');

  const text2 = "<CORE_MEMORY>The ancient artifact grants immortality.</CORE_MEMORY>";
  const result2 = detectCoreMemory(text2);
  console.assert(result2.isCoreMemory, 'Should detect core memory with tags');
  console.assert(!result2.text.includes('<CORE_MEMORY>'), 'Should remove tags from text');

  console.log('✓ Core memory tests passed');
}

await testSummarization();
testCoreMemory();
```

---

### 5.7 Configuration Options

```javascript
const summaryConfig = {
  // Enable/disable summarization
  enableSummarization: true,

  // Enable core memory detection
  enableCoreMemories: true,

  // Auto-create lorebook entries for core memories
  coreMemoryToLorebook: true,

  // Maximum summary length
  maxSummaryLength: 200,

  // Number of summaries to include in context
  maxSummariesInContext: 5,

  // Link summaries to AI or user messages
  linkSummariesToAI: true,

  // Minimum message length to summarize
  minMessageLength: 50,

  // API settings for summary generation
  summaryAPI: {
    endpoint: '/api/generate',
    maxTokens: 150,
    temperature: 0.7,
    model: 'gpt-4'
  },

  // Storage settings
  storage: {
    useMetadata: true, // Use chat_metadata instead of localStorage
    autoSave: true,
    saveInterval: 5000 // ms
  }
};
```

---

### 5.8 NemoLore Implementation Deep Dive

This section explains how NemoLore specifically implements paired summaries and core memories in production.

#### The Paired Summary System

**Design Philosophy**:

NemoLore's paired summary approach solves a fundamental problem in long conversations: **how to preserve context without overwhelming the AI's token limit**. Traditional approaches either:
- Summarize every message (expensive, slow, loses granularity)
- Summarize in large chunks (loses important details)
- Don't summarize (hits token limits)

Paired summarization strikes an optimal balance.

**How Pairing Works in NemoLore**:

```
Chat Timeline:
┌──────────────────────────────────────────────────────────┐
│ Message 0:  "Let's start an adventure"                   │
│             [Full Content Stored - No Pairing]           │
│             ↓                                            │
│ Message 1:  "I'm ready! Where do we go?"                │ ├─ Pair 1
│ Message 2:  "To the ancient ruins in the north"         │ ┘
│             [Summarized Together]                        │
│             ↓                                            │
│ Message 3:  "What dangers await us there?"              │ ├─ Pair 2
│ Message 4:  "Dragons and ancient traps"                 │ ┘
│             [Summarized Together]                        │
│             ↓                                            │
│ Message 5:  "I cast a protection spell"                 │ ├─ Pair 3
│ Message 6:  "The spell shimmers around you"             │ ┘
│             [Summarized Together]                        │
└──────────────────────────────────────────────────────────┘
```

**Implementation Details**:

```javascript
// NemoLore's Message Processing Logic
async processNewMessage(message, messageIndex) {
    // Special Case: Message 0
    if (messageIndex === 0) {
        // Message 0 is ALWAYS preserved in full
        // Rationale: First message often contains critical setup
        // Examples: Character intro, scene setting, roleplay rules
        const summaryData = {
            text: message.content,  // Full content, not summarized
            isFullContent: true,
            created: Date.now(),
            messageCount: 1,
            isPaired: false
        };

        this.summaryCache.set(0, summaryData);
        await this.saveSummaryCache();

        console.log('[NemoLore] Message 0 preserved in full');
        return;
    }

    // Paired Summarization: Even-numbered messages only
    if (messageIndex % 2 === 0 && messageIndex > 0) {
        const prevMessage = chat[messageIndex - 1];

        if (prevMessage) {
            console.log(`[NemoLore] Pairing messages ${messageIndex - 1} and ${messageIndex}`);

            // Summarize the pair
            const summaryData = await this.summarizeMessageGroup([
                prevMessage,
                message
            ]);

            if (summaryData) {
                // Determine where to store the summary
                // linkSummariesToAI setting controls this behavior
                const targetIndex = this.settings.linkSummariesToAI && !message.is_user
                    ? messageIndex      // Store on AI message
                    : messageIndex - 1; // Store on user message

                const markerIndex = targetIndex === messageIndex
                    ? messageIndex - 1
                    : messageIndex;

                // Store the FULL summary on target message
                this.summaryCache.set(targetIndex, {
                    ...summaryData,
                    isPaired: true,
                    pairedIndices: [messageIndex - 1, messageIndex]
                });

                // Store a MARKER on the other message
                this.summaryCache.set(markerIndex, {
                    text: `[Summarized with message ${targetIndex}]`,
                    isMarker: true,
                    linkedTo: targetIndex
                });

                await this.saveSummaryCache();
            }
        }
    }
}
```

**Why This Design?**

1. **Message 0 Special Treatment**:
   - Often contains character card information
   - May include roleplay rules or scene setup
   - Too important to summarize away
   - Example: "You are Gandalf, a wise wizard who speaks in riddles..."

2. **Pairing Benefits**:
   - Natural conversation units (user → AI → user → AI)
   - Reduces API calls by 50% vs per-message summarization
   - Maintains context flow better than larger chunks
   - Each pair represents a complete "exchange"

3. **Odd Message Handling**:
   - If chat ends on an odd-numbered message, it waits
   - Next message will pair it automatically
   - No orphaned messages

**Storage Strategy**:

```javascript
// Example stored data structure in chat_metadata
chat_metadata.nemolore_summaries = {
    0: {
        text: "Full first message content here...",
        isFullContent: true,
        messageCount: 1,
        isPaired: false
    },
    1: {
        text: "[Summarized with message 2]",
        isMarker: true,
        linkedTo: 2
    },
    2: {
        text: "User asked about adventure destinations. AI suggested ancient ruins.",
        isPaired: true,
        pairedIndices: [1, 2],
        messageCount: 2,
        type: "narrative"
    },
    3: {
        text: "[Summarized with message 4]",
        isMarker: true,
        linkedTo: 4
    },
    4: {
        text: "User inquired about dangers. AI warned of dragons and traps.",
        isPaired: true,
        pairedIndices: [3, 4],
        messageCount: 2,
        type: "dialogue"
    }
};
```

---

#### Core Memory System

**What Are Core Memories?**

Core memories are **critically important pieces of information** that the AI identifies as worth permanently remembering. Unlike regular summaries that can be pruned, core memories are:
- Automatically saved to the character's lorebook
- Given high priority in context injection
- Preserved across chat sessions
- Searchable via the vector system

**Examples of Core Memories**:
- ✅ "Alice's sister was killed by the Dragon Lord"
- ✅ "The ancient artifact is hidden in the Temple of Light"
- ✅ "Bob made a blood oath to protect the princess"
- ❌ "They walked through the forest" (too mundane)
- ❌ "She said hello" (not important long-term)

**How NemoLore Detects Core Memories**:

```javascript
// Step 1: Prompt the AI to tag core memories
function createSummarizationPrompt(template, formattedMessages, groupType, maxLength = 200) {
  return `${template}

Context: This is a ${groupType} section from a conversation.
Target length: ${maxLength} characters or less.
Focus on: Key information, decisions made, important events, and character development.

⚠️ IMPORTANT: If this message contains CRITICAL information that should be PERMANENTLY remembered
(character backstory, world facts, plot developments, character relationships, important events),
wrap your summary with <CORE_MEMORY> tags.

Examples of CORE MEMORY:
- Character revelations: <CORE_MEMORY>Alice revealed she is the lost heir to the throne.</CORE_MEMORY>
- World facts: <CORE_MEMORY>Magic is forbidden in the kingdom and punishable by death.</CORE_MEMORY>
- Important events: <CORE_MEMORY>The hero obtained the legendary Sword of Light.</CORE_MEMORY>

Only use <CORE_MEMORY> tags for TRULY IMPORTANT information. Do NOT use them for:
- Normal conversation flow
- Routine actions or dialogue
- Temporary events

Messages to summarize:
${formattedMessages}

Summary:`;
}

// Step 2: Detect tags in AI response
function detectCoreMemory(summaryText) {
    const hasCoreMemoryTag = /<CORE_MEMORY>/.test(summaryText);

    // Extract content between tags
    const match = summaryText.match(/<CORE_MEMORY>(.*?)<\/CORE_MEMORY>/s);
    const coreMemoryContent = match ? match[1].trim() : summaryText;

    // Remove all tags from the summary
    const cleanSummary = summaryText.replace(/<\/?CORE_MEMORY>/g, '').trim();

    return {
        isCoreMemory: hasCoreMemoryTag,
        text: cleanSummary,
        coreMemoryContent: hasCoreMemoryTag ? coreMemoryContent : null
    };
}

// Example AI responses:
// Regular summary: "The user asked about the weather. The AI described it as sunny."
// Core memory: "The user asked about their past. <CORE_MEMORY>The character revealed their mother was murdered by the Shadow King when they were 5 years old.</CORE_MEMORY>"
```

**Processing Core Memories**:

```javascript
async handleCoreMemory(summaryData) {
    console.log('🌟 CORE MEMORY DETECTED:', summaryData.coreMemoryContent);

    // Visual notification to user
    this.showCoreMemoryAnimation(summaryData.text);

    // Check if auto-lorebook is enabled
    if (!this.settings.enableCoreMemories) {
        console.log('Core memories disabled in settings');
        return;
    }

    if (!this.settings.coreMemoryPromptLorebook) {
        console.log('Lorebook integration disabled');
        return;
    }

    // Get lorebook manager
    const autoLorebookManager = window.nemoLoreWorkflowState?.autoLorebookManager;

    if (!autoLorebookManager) {
        console.warn('Auto-lorebook manager not available');
        return;
    }

    // Create lorebook entry
    await autoLorebookManager.addCoreMemoryToLorebook(summaryData);

    // Notify user
    this.notificationManager.success(
        'Core Memory Saved',
        `📚 "${summaryData.text.substring(0, 50)}..." added to lorebook`,
        { duration: 5000 }
    );
}
```

**Lorebook Entry Creation**:

```javascript
async addCoreMemoryToLorebook(summaryData) {
    // Extract keywords for triggering
    const keywords = this.extractKeywords(summaryData.text);

    // Create lorebook entry
    const lorebookEntry = {
        // Trigger keys (when these appear, inject this entry)
        keys: keywords,

        // The core memory content
        content: summaryData.text,

        // High priority ensures it's included in context
        priority: 100,

        // Selective means it only triggers on keywords
        selective: true,

        // Constant false means it's not always injected
        constant: false,

        // Position in prompt
        position: 'after_char',

        // Metadata
        created: Date.now(),
        source: 'core_memory_auto',
        originalMessageIndex: summaryData.messageIndex,

        // Visual marker
        comment: '🌟 Auto-generated from core memory'
    };

    // Add to character's lorebook
    await this.addToCharacterLorebook(lorebookEntry);

    console.log(`✅ Core memory added to lorebook with keys: ${keywords.join(', ')}`);
}

// Keyword extraction
extractKeywords(text) {
    // Simple extraction (NemoLore may use more advanced NLP)
    const words = text.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 3);

    // Remove stop words
    const stopWords = ['this', 'that', 'with', 'from', 'have', 'been', 'were', 'they'];
    const filtered = words.filter(word => !stopWords.includes(word));

    // Get top keywords (proper nouns, important words)
    const properNouns = text.match(/\b[A-Z][a-z]+\b/g) || [];
    const keywords = [...new Set([...properNouns, ...filtered.slice(0, 3)])];

    return keywords.slice(0, 5); // Maximum 5 keywords
}
```

**Core Memory in Context**:

```javascript
// When generating AI responses, core memories are injected
async generateAIResponse(userPrompt) {
    // 1. Get regular summaries
    const regularSummaries = this.getSummariesForInjection();

    // 2. Get core memories (from lorebook)
    // These are automatically injected by SillyTavern's lorebook system
    // when keywords match

    // 3. Build full context
    const fullContext = `
${regularSummaries}

${userPrompt}
`;

    // Core memories will be injected by SillyTavern based on keyword matching
    return await generateQuietPrompt(fullContext);
}
```

**Visual Feedback**:

```javascript
// NemoLore shows visual indication when core memory is detected
showCoreMemoryAnimation(text) {
    // Create animated notification
    const notification = document.createElement('div');
    notification.className = 'nemolore-core-memory-notification';
    notification.innerHTML = `
        <div class="core-memory-icon">🌟</div>
        <div class="core-memory-text">
            <strong>Core Memory Detected</strong>
            <p>${text.substring(0, 100)}...</p>
        </div>
    `;

    // Animate in
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 20px;
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.3);
        animation: slideInRight 0.5s ease-out;
        z-index: 10000;
    `;

    document.body.appendChild(notification);

    // Remove after 5 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.5s ease-in';
        setTimeout(() => notification.remove(), 500);
    }, 5000);
}
```

---

#### Storage and Persistence

**How NemoLore Stores Data**:

```javascript
// Storage hierarchy in NemoLore
NemoLore Storage Strategy:
┌─────────────────────────────────────────────────────────┐
│                                                           │
│  1. Chat Metadata (per-chat storage)                    │
│     ├─ Summaries (all summary data)                     │
│     ├─ Vector references (IDs)                          │
│     └─ Settings overrides                               │
│                                                           │
│  2. IndexedDB (browser storage)                          │
│     ├─ Vector embeddings                                 │
│     ├─ Large metadata objects                            │
│     └─ Performance data                                  │
│                                                           │
│  3. Character Lorebook (character-level)                 │
│     ├─ Core memories                                     │
│     ├─ Auto-generated entries                            │
│     └─ Manual lorebook entries                           │
│                                                           │
│  4. Global Settings (extension-level)                    │
│     └─ User preferences                                  │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

**Migration and Compatibility**:

```javascript
// NemoLore handles migration from old storage formats
async loadSummaryCache() {
    try {
        const chatId = getCurrentChatId();
        if (!chatId || !chat_metadata) return;

        // NEW FORMAT: Load from chat_metadata (v2.0+)
        const cached = chat_metadata.nemolore_summaries;

        if (cached) {
            for (const [key, value] of Object.entries(cached)) {
                this.summaryCache.set(parseInt(key), value);
            }
            console.log(`✅ Loaded ${this.summaryCache.size} summaries from chat metadata`);
        } else {
            // OLD FORMAT: Migrate from localStorage (v1.x)
            const storageKey = `nemolore_summaries_${chatId}`;
            const legacyData = localStorage.getItem(storageKey);

            if (legacyData) {
                console.log('⚠️ Found legacy summary data, migrating...');
                const parsedCache = JSON.parse(legacyData);

                for (const [key, value] of Object.entries(parsedCache)) {
                    this.summaryCache.set(parseInt(key), value);
                }

                // Save to new format
                await this.saveSummaryCache();

                // Clean up old data
                localStorage.removeItem(storageKey);

                console.log(`✅ Migrated ${this.summaryCache.size} summaries to chat metadata`);
            }
        }

    } catch (error) {
        console.warn('[NemoLore Memory Manager] Failed to load summary cache:', error);
    }
}
```

---

#### The Complete Flow

**User sends message → Core memory detected and saved**:

```
1. User Message: "My character's name is Elara, and I'm the last of the Shadow Mages"
   ↓
2. AI Response: "Greetings, Elara. The Shadow Mages were thought extinct..."
   ↓
3. NemoLore Detects: messageIndex = 2 (even number)
   ↓
4. Pairs Messages: [message 1, message 2]
   ↓
5. Sends to AI for Summary:
   "Summarize: [1] User: My character's name is Elara..."
   ↓
6. AI Returns:
   "<CORE_MEMORY>Elara is the last surviving Shadow Mage.</CORE_MEMORY>"
   ↓
7. NemoLore Processes:
   - Detects <CORE_MEMORY> tag ✅
   - Extracts: "Elara is the last surviving Shadow Mage"
   - Shows notification to user 🌟
   ↓
8. Creates Lorebook Entry:
   {
     keys: ["Elara", "Shadow", "Mage"],
     content: "Elara is the last surviving Shadow Mage.",
     priority: 100,
     source: "core_memory_auto"
   }
   ↓
9. Saves Everything:
   - Summary → chat_metadata.nemolore_summaries[2]
   - Lorebook entry → character.data.character_book.entries[]
   - Marker → chat_metadata.nemolore_summaries[1]
   ↓
10. Future messages mentioning "Elara" or "Shadow Mage" will
    automatically inject this core memory into context
```

---

#### Benefits of NemoLore's Approach

**For Users**:
1. ✅ Transparent - Visual feedback when core memories detected
2. ✅ Automatic - No manual lorebook management needed
3. ✅ Intelligent - AI decides what's important
4. ✅ Persistent - Survives across sessions
5. ✅ Searchable - Vector system can find core memories

**For Developers**:
1. ✅ Efficient - Paired approach reduces API calls
2. ✅ Scalable - Works with unlimited message lengths
3. ✅ Modular - Easy to enable/disable features
4. ✅ Compatible - Works with existing SillyTavern lorebook
5. ✅ Extensible - Easy to add new summary types

**Performance Impact**:

```
Without NemoLore Summarization:
- 100 messages = 100 messages in context
- Context limit: ~50-100 messages (depending on length)
- Token usage: Very high

With NemoLore Summarization:
- 100 messages = 50 paired summaries + recent messages
- Context limit: Effectively unlimited
- Token usage: Reduced by 60-80%
- Core memories: Always available when relevant

Example:
Original: 10,000 tokens for 50 messages
With summaries: 3,000 tokens for 50 message summaries + 2,000 for recent messages = 5,000 tokens
Savings: 50% token reduction while maintaining context
```

---

## 6. Technical Deep Dive

### Embedding Model Details

**Model**: `Xenova/all-MiniLM-L6-v2`

**Specifications**:
- Architecture: Transformer-based sentence encoder
- Dimensions: 384
- Max Sequence Length: 256 tokens
- Pooling: Mean pooling with normalization
- Model Size: ~23MB (quantized)
- Inference Speed: ~50ms on modern hardware

**Why This Model?**

1. **Small Size**: Runs efficiently in browser
2. **Good Quality**: Balances size vs. accuracy
3. **Fast**: Real-time inference possible
4. **Well-Supported**: Maintained by Hugging Face
5. **Multilingual**: Supports multiple languages

### Storage Strategy

**IndexedDB Advantages**:
- Persistent across browser sessions
- Can store gigabytes of data
- Fast indexed queries
- Asynchronous (non-blocking)
- Structured data storage

**Cache Strategy**:
- LRU eviction for hot data
- In-memory Map for O(1) access
- Lazy loading from IndexedDB
- Prefetching for common patterns

---

## 5. Future Enhancements

### Potential Improvements

1. **GPU Acceleration**: Use WebGL for faster vector operations
2. **Incremental Indexing**: Update vectors without full recompute
3. **Query Optimization**: Learn optimal algorithm weights per user
4. **Distributed Storage**: Sync vectors across devices
5. **Advanced Clustering**: Automatic conversation topic grouping
6. **Attention Mechanisms**: Weight different message parts differently

### Experimental Features

- **Multi-Modal Embeddings**: Combine text + image vectors
- **Graph Neural Networks**: Better cross-chat relationship modeling
- **Active Learning**: User feedback improves relevance
- **Temporal Attention**: Dynamic recency weighting

---

## 6. Conclusion

The NemoLore Vectorization System represents a comprehensive approach to semantic memory in conversational AI. By combining machine learning embeddings with sophisticated search algorithms and intelligent memory management, it enables unprecedented conversation recall and contextual understanding.

**Key Strengths**:
- ✅ Semantic search beyond keywords
- ✅ Efficient browser-based implementation
- ✅ Multi-algorithm robustness
- ✅ Scalable architecture
- ✅ Cross-conversation intelligence

**Best For**:
- Long-term character roleplay
- Complex multi-session projects
- Character development tracking
- Research/brainstorming conversations
- Knowledge base creation

---

## Appendix A: File Reference

| Component | File | Lines | Purpose |
|-----------|------|-------|---------|
| Vector Manager | `vectorization/vector-manager.js` | 575 | Core embedding & storage |
| Query System | `vectorization/advanced-query-system.js` | 619 | Multi-algorithm search |
| Memory Manager | `vectorization/memory-manager.js` | 1342 | Memory optimization |
| Cross-Chat Manager | `vectorization/cross-chat-manager.js` | 775 | Inter-conversation links |

---

## Appendix B: Algorithm Comparison

### Search Algorithm Performance

| Algorithm | Speed | Accuracy | Memory | Use Case |
|-----------|-------|----------|--------|----------|
| BM25 | ⚡⚡⚡ | ⭐⭐⭐ | 💾 | Keyword matching |
| Cosine | ⚡⚡ | ⭐⭐⭐⭐ | 💾💾 | Semantic similarity |
| Semantic | ⚡⚡⚡ | ⭐⭐⭐ | 💾 | Concept matching |
| Temporal | ⚡⚡⚡⚡ | ⭐⭐ | 💾 | Recent context |
| Contextual | ⚡⚡⚡⚡ | ⭐⭐⭐ | 💾 | Same-chat relevance |
| **Hybrid (All)** | ⚡⚡ | ⭐⭐⭐⭐⭐ | 💾💾 | Best overall results |

---

*Document Version: 1.0*
*Last Updated: 2025-10-09*
*System Version: NemoLore Vector Manager v2.0*
