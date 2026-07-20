# Bundled NemoLore audit

## Decision

The copy under `features/nemolore` is retired and must not initialize. It is not a compatibility implementation of the standalone NemoLore repository: it is a separate, older product design with different storage, settings, prompt tags, and lifecycle assumptions. Running both can duplicate summarization, hiding, vector collections, lore operations, and prompt injection.

The source remains temporarily in this branch as migration reference. Its persisted localforage records are not deleted.

## Capability comparison

| Area | Bundled implementation | Standalone implementation | Decision |
| --- | --- | --- | --- |
| Memory model | Timeline summaries, inbox candidates, raw archive | Typed atomic, episode, relationship, state, entity, and core records with revisions and provenance | Standalone wins |
| Retrieval | Raw archive lexical/vector search | Deterministic scoring blended with semantic similarity, redundancy filtering, and token budgeting | Standalone wins; evaluate raw-source retrieval separately |
| Maintenance | Serialized summary queue | Deduplication, contradictions, importance, aging, consolidation, episode promotion, and core promotion | Standalone wins |
| Profiles | Numerous exposed settings | Short RP, Long Form, Episodic, and Epic policies with controlled overrides | Standalone wins |
| Lore updates | Reviewable inbox and manual promotion | Managed repository plus generated preview/apply workflows | Preserve the review-first principle, not the old runtime |
| Observability | Bespoke inspector/debug globals | Integrated context, job, memory, and semantic diagnostics | Standalone wins |
| Cross-chat preferences | Swipe/edit/problem-line evidence with review | No equivalent subsystem | Candidate for a new reviewed preference module |
| Raw source archive | Stores full paired source text before hiding | Stores source identity, hashes, and structured memory provenance | Candidate enhancement for Epic precision and recovery |
| Guides/tools | Rule setup, scene assessment, planning, prose checks, DM notes, dice, custom tools, and stealth/preflight modes | General helper-agent framework, but not these user-facing tools | Extract as a separate NemoGuides product or rebuild atop Ember/helper APIs |

## Do not port directly

- Direct private-path imports into SillyTavern internals.
- A second message-hiding or extension-prompt coordinator.
- The old settings panel and root feature toggle.
- Duplicate vector request construction.
- Global debug objects and broad event wiring.
- localforage records without versioned migration and validation.

## Preserve as product ideas

### Reviewed preference learning

The strongest unique idea is evidence-driven, cross-chat preference learning. Swipe rejection, accepted continuation, edits, and explicitly reported problem lines can produce *disabled candidates* for user review. This should be rebuilt with bounded evidence, transparent provenance, false-positive controls, and explicit acceptance before prompt injection.

### Recoverable raw-source archive

The old safety invariant—never hide source turns before a valid summary and recoverable source copy exist—is valuable. Standalone NemoLore should evaluate an optional compressed raw-source layer, especially for Epic chats, without treating raw chat text as another canonical memory database.

### Nemo Guides

The Guides collection is not memory management. It should become its own optional extension or an Ember artifact/tool pack, using supported SillyTavern APIs and the shared helper/provider abstractions rather than remaining coupled to NemoLore.

## Migration requirements before deletion

1. Detect `nemo_lore:*` localforage records without activating the old runtime.
2. Offer an explicit import/export report rather than silently rewriting data.
3. Map accepted timeline/inbox records into standalone typed memory records with legacy provenance.
4. Preserve raw archives until the user confirms migration or deletion.
5. Export accepted preferences independently until a maintained preference subsystem exists.
6. Remove `features/nemolore` only after migration tests cover partial, repeated, and failed imports.
