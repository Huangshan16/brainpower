# Persona Library And Conversation Workspace Expansion

## Goal

Expand Brainpower from a seeded demo matrix into a real persona library and conversation workstation.

This expansion has three concrete outcomes:

- import real personas already distilled by `alchaincyf/nuwa-skill` into the local persona library;
- treat `nuwa-skill` as an external distillation engine gateway for new persona creation;
- replace the current single-shot evaluation form with a conversation workspace that supports adding personas, direct chat, group chat, and stopping a running group conversation.

The system remains local-first, single-user, and backend-mediated. No account system is introduced.

## External Source Boundary

`nuwa-skill` is used in two ways, not one:

1. as a source of already distilled personas;
2. as an external engine that can distill new personas on demand.

The current public `nuwa-skill` README lists already distilled personas including Paul Graham, Zhang Yiming, Karpathy, Ilya Sutskever, MrBeast, Trump, Steve Jobs, Elon Musk, Munger, Feynman, Naval, and Taleb, and describes a four-step distillation method of research, validation, skill construction, and quality verification. Those facts are the basis for the import layer and engine gateway design, not an informal assumption.

Source references:

- `https://github.com/alchaincyf/nuwa-skill#已蒸馏人物`
- `https://github.com/alchaincyf/nuwa-skill#工作原理`

## Product Shape

The app still has three primary top-level modes, but the third mode changes identity:

- `研究`: research intake, source sync, persona discovery, and distillation task entry
- `蒸馏`: evidence review, skill structure review, import status, and distillation task status
- `对话`: conversation workspace for direct and group interaction with selected personas

The old `评审` page is removed as a standalone form workflow. Evaluation becomes one kind of conversation behavior inside the new conversation workspace.

## Architecture

This expansion introduces four product boundaries on top of the existing app:

1. `Persona Library`
   - durable local library of imported, manually created, and distilled personas
   - supports add, archive, soft delete, and search

2. `Distillation Engine Gateway`
   - backend adapter around `nuwa-skill`
   - imports existing personas and triggers new persona distillation
   - does not directly serve UI rendering

3. `Conversation Workspace`
   - frontend and backend surface for persona chat
   - consumes only local persona and skill snapshots

4. `Run Orchestration`
   - unified job and run layer for imports, distillations, and group chat progression

The core rule is strict: chat never depends on external engine runtime state. External engine output is normalized into local storage first, then consumed by the conversation layer.

## Persona And Skill Data Model

The existing `people`, `skills`, and `jobs` tables are expanded. New conversation tables are introduced. Roles remain separated.

### `people`

Add fields:

- `origin_type`: `seed | nuwa_import | manual | distilled`
- `origin_ref`: repository, example path, or engine reference
- `persona_kind`: `person | topic`
- `is_archived`: integer flag
- `is_deleted`: integer flag

Deletion is soft delete only. Existing conversations must remain readable even after a persona is removed from the visible library.

### `skills`

Add fields:

- `engine_type`: `local | nuwa_import | nuwa_cli`
- `engine_version`
- `source_snapshot_json`

Multiple skill versions per persona are allowed. Conversations bind to a concrete `skill_id` snapshot, never implicitly to "latest skill".

### `jobs`

Expand semantics:

- `job_type`: `import_personas | distill_person | sync_persona | group_chat_round`
- `job_status`: `queued | running | succeeded | failed | cancelled`
- `payload_json`
- `result_json`
- `error_json`

This table becomes the durable execution ledger for imports, distillations, and run orchestration.

### `conversations`

Fields:

- `id`
- `title`
- `mode`: `direct | group`
- `status`: `active | stopped | archived`
- `created_at`
- `updated_at`

### `conversation_participants`

Fields:

- `conversation_id`
- `person_id`
- `skill_id`
- `join_source`: `library | manual | distill_job`
- `position`
- `is_active`

This table binds participants to skill snapshots. That design prevents a new imported skill version from mutating old conversation history.

### `messages`

Fields:

- `id`
- `conversation_id`
- `sender_type`: `user | persona | system`
- `sender_id`
- `content`
- `round_index`
- `reply_to_message_id`
- `meta_json`
- `created_at`

Direct chat and group chat both use the same message ledger.

### `conversation_runs`

Fields:

- `id`
- `conversation_id`
- `run_mode`: `direct_once | group_broadcast | group_loop`
- `status`: `running | stopped | completed | failed`
- `stop_reason`
- `created_at`
- `updated_at`

Stopping group chat updates the active run record rather than mutating the whole conversation object into an ambiguous half-state.

## Backend Services

The backend is split into six service boundaries:

### `personaLibraryService`

Responsibilities:

- persona CRUD
- soft delete and archive
- dedupe on import
- read models for persona library UI

### `nuwaGatewayService`

Responsibilities:

- fetch already distilled persona metadata from `nuwa-skill`
- inspect example directories or repository metadata
- run `nuwa-skill` distillation as an external command or scripted workflow
- capture raw output, logs, and normalized engine result

It is an adapter layer only. It does not write business tables directly.

### `distillationService`

Responsibilities:

- create `distill_person` jobs
- call `nuwaGatewayService`
- normalize returned persona, skill, source, and fragment data
- write to local storage
- optionally auto-add distilled persona to a target conversation

### `conversationService`

Responsibilities:

- create and list conversations
- add or remove participants
- switch direct or group mode
- keep participant ordering stable

### `conversationRunService`

Responsibilities:

- trigger direct chat run
- trigger group chat run
- stop active group chat
- advance group runs by round

### `messageGenerationService`

Responsibilities:

- build prompts from message history, participant skill snapshots, and mode
- generate persona replies through the existing model service
- normalize reply payloads into `messages`

## Import Flow

The initial real-persona sync uses the import path:

1. user triggers "sync persona library";
2. backend creates `import_personas` job;
3. `nuwaGatewayService` reads public persona metadata from `nuwa-skill`;
4. `personaLibraryService` dedupes and writes `people`;
5. if importable skill metadata or example evidence is available, write normalized `skills`, `sources`, and `fragments`;
6. persist summary in `jobs.result_json` with imported, updated, skipped, and failed counts.

Import failures do not partially mutate conversations.

## New Persona Distillation Flow

The new distillation path supports both "distill only" and "distill and join conversation":

1. user submits a persona name and optional conversation target;
2. backend creates `distill_person` job;
3. `distillationService` calls `nuwaGatewayService`;
4. normalized output is written into `people`, `skills`, `sources`, and `fragments`;
5. if requested, the new persona is added to `conversation_participants`;
6. job status is finalized with result or structured error.

If `nuwa-skill` fails, the job fails and the conversation remains intact.

## Conversation Workspace

The third page is renamed from `评审` to `对话`.

### Left Panel

The existing left panel becomes a persona library browser:

- search personas
- add persona to current conversation
- remove or archive library personas
- manually create temporary personas
- trigger new persona distillation

### Center Panel

The center panel becomes the chat workstation:

- conversation title
- mode selection
- message timeline
- composer
- conversation action controls

Users can directly:

- add personas into the conversation;
- trigger a message;
- switch to direct mode;
- start group mode;
- stop group chat.

### Right Panel

The right panel shows active conversation evidence:

- current participants
- skill snapshot info
- key citations
- latest conclusions
- active run status

If participant count grows, the right panel scrolls internally rather than stretching the page height.

## Conversation Behaviors

### Direct Mode

- one selected participant is the speaking persona;
- user sends a message;
- only that persona replies;
- other participants remain in the conversation context but do not auto-speak.

### Group Mode

Group mode has two phases:

1. `group_broadcast`
   - after the user message, every active participant replies once

2. `group_loop`
   - participants may continue to respond to each other in rounds
   - the run continues until stopped, completed by a configured limit, or failed

### Stop Group Chat

Stopping group chat:

- sets the active `conversation_run` to `stopped`;
- prevents new automatic rounds;
- preserves existing messages and participants;
- allows a new run to start later from the same conversation.

## Frontend Component Split

The chat workspace must not become a monolith. Minimum component boundaries:

- `ConversationWorkspace`: conversation page shell and top-level state
- `ConversationHeader`: title, mode, run state, stop action
- `ParticipantTray`: active participants with remove action
- `MessageTimeline`: message rendering only
- `Composer`: input, send, direct, group controls
- `PersonaPicker`: add persona from library
- `JobPanel`: import, distill, and run status

The current `EvaluateWorkspace` is replaced by this tree.

## API Surface

Add or replace routes with the following stable backend contract:

- `GET /api/personas`
- `POST /api/personas/import/nuwa`
- `POST /api/personas`
- `DELETE /api/personas/:id`
- `POST /api/personas/distill`
- `GET /api/jobs/:id`

- `GET /api/conversations`
- `POST /api/conversations`
- `POST /api/conversations/:id/participants`
- `DELETE /api/conversations/:id/participants/:personId`
- `POST /api/conversations/:id/messages`
- `POST /api/conversations/:id/run/direct`
- `POST /api/conversations/:id/run/group`
- `POST /api/conversations/:id/run/stop`

Route handlers stay thin. All branching logic lives in services.

## Failure Handling

Every long-running import, distillation, or chat run is represented as a durable job or run record.

Required failure behaviors:

- `nuwa-skill` import failure must not create half-linked participants;
- distillation timeout or process failure must surface a structured job error;
- deleting a library persona must not break history because conversations bind to snapshots;
- stopping group chat must not delete messages or orphan the conversation;
- external engine output parse failures must be logged with request or job context.

## Testing

Minimum test coverage expands in four layers:

### Service Tests

- `nuwaGatewayService` imports persona metadata correctly
- `distillationService` normalizes external engine output into local tables
- `conversationService` adds and removes participants safely
- `conversationRunService` starts and stops group runs correctly

### Frontend Component Tests

- personas can be added to and removed from a conversation
- direct mode triggers one persona reply path
- group mode enters running state
- stop group chat transitions the run to stopped

### End-To-End Tests

- import real personas
- add multiple personas to a conversation
- send a message
- switch direct mode
- start group chat
- stop group chat
- verify message timeline and run state

### Failure Path Tests

- `nuwa-skill` import failure
- distillation job timeout
- group chat interruption
- deleting a persona with existing conversation history

## Delivery Slice

The first implementation slice for this expansion should be:

1. replace seed-only personas with imported `nuwa-skill` personas in the library;
2. add database migrations for conversation tables and expanded persona fields;
3. add `nuwaGatewayService` with import-only path first;
4. replace `EvaluateWorkspace` with `ConversationWorkspace`;
5. implement add participant, remove participant, direct chat, group chat start, and stop group chat using local stubbed model replies or existing model service;
6. add browser evidence tests for add/send/group/stop flow;
7. add the second slice for external distillation execution once import and chat are stable.

This keeps the system coherent while still honoring the dual-track requirement: import existing personas now, and support `nuwa-skill`-driven new persona distillation as the next bounded step.

## Risks

- Import and live distillation can easily get entangled. Keep them as separate job types.
- Deleting personas can corrupt history if conversations reference mutable persona rows without skill snapshots.
- Group chat can degenerate into runaway loops. Enforce explicit run records, round limits, and stop semantics.
- `nuwa-skill` as an external engine can drift in output shape. Normalize through a gateway and version the imported snapshot.
- Replacing `Evaluate` with `Conversation` will touch both frontend semantics and tests. Keep the migration narrow and explicit rather than carrying both models at once.
