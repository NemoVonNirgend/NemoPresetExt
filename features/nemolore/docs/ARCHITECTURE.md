# Nemo Lore Architecture

Nemo Lore is designed as a coordinator, not a replacement for SillyTavern's existing memory primitives.

## Layers

| Layer | Purpose | Storage | Injection |
| --- | --- | --- | --- |
| Live context | Recent unsummarized chat | SillyTavern chat | Normal chat prompt |
| Timeline summaries | Chronological continuity | localforage | Extension prompt |
| Entity memory | Stable facts and relationships | World Info | World Info activation |
| Preference memory | Cross-chat user taste and rules | localforage | Extension prompt / Author's Note adjacent |
| Archive retrieval | Raw details hidden from API context | vector/archive store | Relevant snippets |

## Safety Invariant

Nemo Lore must not hide a message from API context unless its source turn has a valid stored summary and is outside the live context window.

The current implementation also stores the raw source turn in the per-chat archive before the hide check runs. This gives Nemo Lore a recoverable detail layer even before vector retrieval is added.

## Background Queue

Memory calls are concurrent with user chatting but serialized inside Nemo Lore. This avoids blocking roleplay while preserving chronological ordering.

```text
assistant reply rendered
  -> completed turn detected
  -> job queued
  -> memory profile summarizes pair
  -> summary validated
  -> timeline store updated
  -> old source messages become eligible to hide
```

## Operation Schema

LLM output is treated as proposed memory operations. Nemo Lore validates and applies them.

```json
{
  "summary": "Alice tried to hide her fear; Mira noticed and teased her gently.",
  "importance": 2,
  "entities": ["Alice", "Mira"],
  "candidates": [
    {
      "type": "relationship",
      "subject": "Alice and Mira",
      "content": "Mira is perceptive about Alice's emotional state.",
      "keywords": ["Alice", "Mira"],
      "confidence": 0.72,
      "importance": 2,
      "scope": "chat"
    }
  ]
}
```

Candidates enter the Memory Inbox first. The user can edit, accept, reject, create a new lorebook entry, or append the candidate to Nemo Lore's highest-scoring matching entry in the selected managed lorebook.

The first matching pass is deliberately explainable: score the selected lorebook's comments, primary keys, and content against the candidate subject and keywords. This is not the final merge engine; it is a conservative bridge toward richer conflict-aware lorebook maintenance.

For matched entries, Nemo Lore can also ask the selected memory model profile to propose a full lorebook update. The model receives the current entry and candidate, then returns an `update`, `append`, or `skip` decision with revised content and keys. The proposal is shown through editable review popups before saving, so the lorebook is never silently rewritten.

## Archive Retrieval

Archive items preserve the raw user/assistant source turn, the paired summary, extracted entities, importance, vector hash, vectorization status, and source message IDs.

The archive supports two retrieval modes:

- lexical search over entities, summaries, and raw text
- vector search through SillyTavern's built-in `/api/vector/insert` and `/api/vector/query` endpoints

Vector retrieval uses the user's existing Vector Storage source/model settings and injects matching archive snippets into a separate Nemo Lore prompt block. WebLLM and KoboldCpp embeddings are skipped for now because the built-in extension prepares their embedding payloads in private helpers.

## Cross-Chat Preferences

Preference memories are global and injected deterministically, not retrieved opportunistically. This is intentional: user taste and boundaries should be reliable once accepted.

The first implementation supports explicit teaching through the settings panel. If a memory model profile is selected, Nemo Lore normalizes the note into typed JSON; otherwise it stores the user note directly. Preference cards can be edited, disabled, or deleted.

Inferred preferences from swipes and edits enter the preference list disabled. This borrows the Prose Polisher pattern: collect repeated signals, wait for a threshold, then surface reviewable candidates instead of silently mutating behavior.

Nemo Lore tracks the previously selected swipe for each assistant message; when the user moves away from it, n-grams from that rejected text are scored. When the user sends the next message, Nemo treats the current selected swipe as the accepted continuation and compares every alternate swipe against it. Phrases that appear in rejected alternates but not in the accepted swipe become stronger `swipe_choice` evidence. It also snapshots assistant message text, and when the user edits a message, phrases that were present before the edit but absent afterward become edit signals.

Phrase extraction follows the Prose Polisher shape: strip markup, split by sentence to avoid cross-sentence junk, normalize simple variants with a small lemma map, ignore low-information common phrases, cull substrings, and keep evidence source counts. Repeated phrases become disabled style-preference candidates.

Every swipe/edit observation is also written to a local preference evidence log with source type, candidate signals, and small accepted/rejected text snippets. The manual reflection pass sends recent log entries plus aggregate signal counts to the selected memory model profile and asks for zero to five conservative preference candidates. Reflected candidates are disabled by default, preserving the same review-before-injection rule as programmatic inference.

Candidate discovery raises a review toast rather than silently changing behavior. Preference cards expose a discussion flow where the user can clarify the inferred pattern in natural language; the memory model then returns a bounded action: save, keep disabled, or delete. This keeps preference learning conversational and user-led instead of treating n-gram evidence as final truth.

The review console surfaces both aggregate signals and raw evidence snippets. Signals can be converted into disabled candidates, discussed immediately, or ignored. Evidence entries can be reflected, removed, or used to ignore their associated signals. Ignored signal keys are stored separately so noisy phrases do not reappear after a rejected candidate.

Borrowing the selection workflow from Rewrite Extension, Nemo Lore can expose a small context action when the user selects text inside a single assistant message. Instead of rewriting the text, **Report Problem Line** captures the selected span, full target message, and user explanation as preference evidence. This gives the memory model concrete problem lines during later discussion or reflection.
