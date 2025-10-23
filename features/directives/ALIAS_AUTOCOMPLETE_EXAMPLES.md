# Smart Alias Autocomplete Examples

## 🎨 How Aliases Work

The autocomplete system now understands **natural language aliases** for values. Instead of remembering exact syntax, just type what you mean!

---

## 🎨 **@color** Examples

### Type Natural Color Names:

```
{{// @color red
```
→ **Autocompletes to:** `#FF6B6B`

```
{{// @color blue
```
→ **Autocompletes to:** `#45B7D1`

```
{{// @color green
```
→ **Autocompletes to:** `#98D8C8` (Mint green)

```
{{// @color purple
```
→ **Autocompletes to:** `#A78BFA`

```
{{// @color orange
```
→ **Autocompletes to:** `#FFA07A`

```
{{// @color yellow
```
→ **Autocompletes to:** `#FFD93D`

```
{{// @color pink
```
→ **Autocompletes to:** `#FB6F92`

```
{{// @color gray
```
→ **Autocompletes to:** `#6C757D`

```
{{// @color grey
```
→ **Also works!** → `#6C757D`

### Alternative Names:

```
{{// @color cyan
```
→ `#4ECDC4`

```
{{// @color mint
```
→ `#98D8C8`

```
{{// @color violet
```
→ `#A78BFA`

```
{{// @color electric
```
→ `#00D9FF` (Electric Blue)

---

## 🎭 **@icon** Examples

### Type Descriptive Words:

```
{{// @icon fire
```
→ **Autocompletes to:** `🔥`

```
{{// @icon warning
```
→ `⚠️`

```
{{// @icon sword
```
→ `⚔️`

```
{{// @icon heart
```
→ `❤️`

```
{{// @icon star
```
→ Could match `✨` (sparkles) OR `⭐` (star)

```
{{// @icon skull
```
→ `💀`

```
{{// @icon shield
```
→ `🛡️`

```
{{// @icon brain
```
→ `🧠`

### Type Concepts:

```
{{// @icon combat
```
→ `⚔️` (Swords)

```
{{// @icon battle
```
→ `⚔️` (Swords)

```
{{// @icon love
```
→ `❤️` (Heart)

```
{{// @icon romance
```
→ `❤️` (Heart)

```
{{// @icon death
```
→ `💀` (Skull)

```
{{// @icon horror
```
→ `💀` (Skull)

```
{{// @icon night
```
→ `🌙` (Moon)

```
{{// @icon dark
```
→ `🌙` (Moon)

```
{{// @icon day
```
→ `☀️` (Sun)

```
{{// @icon bright
```
→ `☀️` (Sun)

```
{{// @icon talk
```
→ `💬` (Speech)

```
{{// @icon dialogue
```
→ `💬` (Speech)

```
{{// @icon chat
```
→ `💬` (Speech)

```
{{// @icon rp
```
→ `🎭` (Theater mask)

```
{{// @icon roleplay
```
→ `🎭` (Theater mask)

```
{{// @icon book
```
→ `📚` (Books)

```
{{// @icon docs
```
→ `📚` (Books)

```
{{// @icon knowledge
```
→ `📚` (Books)

```
{{// @icon fast
```
→ `🚀` (Rocket)

```
{{// @icon speed
```
→ `🚀` (Rocket)

```
{{// @icon protect
```
→ `🛡️` (Shield)

```
{{// @icon defense
```
→ `🛡️` (Shield)

---

## 🧠 Smart Sorting

The autocomplete system uses **intelligent scoring** to show the best matches first:

### Priority Levels:

1. **Exact alias match** (Score: 1000)
   - Type: `red` → Shows `#FF6B6B` FIRST

2. **Exact value match** (Score: 900)
   - Type: `#FF6B6B` → Shows `#FF6B6B` FIRST

3. **Alias starts with** (Score: 500)
   - Type: `fi` → Shows 🔥 (fire) high in list

4. **Value starts with** (Score: 400)
   - Type: `#FF` → Shows colors starting with #FF

5. **Alias contains** (Score: 100)
   - Type: `hot` → Shows 🔥 (fire - hot, intense)

6. **Value contains** (Score: 50)
   - Type: `6B` → Shows `#FF6B6B`

7. **Description contains** (Score: 10)
   - Type: `danger` → Shows `#FF6B6B` (Red - Danger)

---

## 💡 Real-World Workflow

### Before (Hard):
```
{{// @color
```
User thinks: *"What was the hex code for red again? #FF... 6B6B? Or was it FF6B6C?"*

### After (Easy):
```
{{// @color red
```
→ Tab → `#FF6B6B` ✓

---

### Before (Hard):
```
{{// @icon
```
User thinks: *"How do I type the sword emoji? Do I copy-paste it?"*

### After (Easy):
```
{{// @icon sword
```
→ Tab → `⚔️` ✓

---

## 🎯 Multiple Aliases

Some values have multiple aliases so you can type what feels natural:

### Colors:
- **Green**: `green`, `mint`
- **Purple**: `purple`, `violet`
- **Gray**: `gray`, `grey`

### Icons:
- **Sparkles (✨)**: `sparkles`, `new`, `shine`, `star`
- **Swords (⚔️)**: `sword`, `swords`, `combat`, `battle`
- **Theater (🎭)**: `theater`, `mask`, `roleplay`, `rp`
- **Speech (💬)**: `speech`, `talk`, `dialogue`, `chat`
- **Books (📚)**: `book`, `books`, `docs`, `knowledge`
- **Fire (🔥)**: `fire`, `hot`, `flame`
- **Warning (⚠️)**: `warning`, `caution`, `alert`
- **Heart (❤️)**: `heart`, `love`, `romance`
- **Skull (💀)**: `skull`, `death`, `horror`, `spooky`

---

## 🚀 Pro Tips

### 1. **Type and Tab**
Don't overthink it - just type what you mean and press Tab:
```
{{// @color red [TAB] → #FF6B6B
{{// @icon fire [TAB] → 🔥
```

### 2. **Partial Matches Work**
You don't need to type the full word:
```
{{// @color bl → Shows blue
{{// @icon sk → Shows skull
```

### 3. **Comma-Separated Lists**
Works in lists too:
```
{{// @tags combat, [type here]
```

### 4. **Case Insensitive**
Capitalization doesn't matter:
```
{{// @color RED → Works!
{{// @color Red → Works!
{{// @color red → Works!
```

---

## 📊 Complete Alias List

### Colors (10):
- `red` → #FF6B6B
- `cyan` → #4ECDC4
- `blue` → #45B7D1
- `orange` → #FFA07A
- `mint`, `green` → #98D8C8
- `yellow` → #FFD93D
- `purple`, `violet` → #A78BFA
- `pink` → #FB6F92
- `gray`, `grey` → #6C757D
- `electric`, `bright-blue` → #00D9FF

### Icons (20 emojis, 60+ aliases):
See examples above for full list!

---

## ✨ The Magic

**Before:** Memorize hex codes and emoji unicode
**After:** Type what you mean

**Before:** Copy-paste from references
**After:** Just type and tab

**Before:** Look up documentation
**After:** Autocomplete teaches you

---

**This is how autocomplete should work everywhere!** 🎉
