# Digital Mentor Matrix Design

## Goal

Build a local-first web app that turns public information about investors and entrepreneurs into auditable digital skills, then uses those skills to evaluate startup ideas through an AI-powered matrix.

The app is not a social network and has no account system. It is a single-user research and decision workstation with local storage, a local backend proxy, and an OpenAI-compatible model interface.

## Product Shape

The first screen is the working product, not a landing page.

The app has three primary modes:

- `Research`: discover, crawl, extract, and store public materials about a person.
- `Distill`: transform stored evidence into a structured person skill with citations.
- `Evaluate`: run one project brief through selected digital investors or entrepreneurs, then ask other personas to critique prior evaluations.

The user should be able to answer three questions after each session:

- What evidence did this persona skill come from?
- How did each persona judge the project across person and business dimensions?
- Which critiques changed or sharpened the user's thinking?

## Architecture

Use a local web app with three boundaries:

- Frontend: Vite, React, TypeScript. It owns panels, interactions, local UI state, and rendering.
- Backend: Node and Express. It owns API routes, AI calls, crawler jobs, extraction, persistence, and retry behavior.
- Storage: SQLite. It owns durable local data: people, sources, fragments, skills, evaluations, critiques, and jobs.

API keys are read by the backend from `.env`. The frontend never stores or bundles provider secrets.

## Frontend Layout

Use a dense "Research Ops war room" interface inspired by Linear-like product UI: dark, restrained, evidence-heavy, and optimized for repeated work. Avoid a marketing hero and avoid decorative cards that hide the actual tool.

The layout has three persistent panels:

- Left panel: people matrix. Shows investors, entrepreneurs, AI builders, status, tags, and readiness.
- Center panel: current workflow. Shows the active Research, Distill, or Evaluate workspace.
- Right panel: evidence and output. Shows source fragments, skill citations, evaluation results, and critique chains.

The main navigation is a compact segmented control for `Research`, `Distill`, and `Evaluate`.

## Backend Services

Split backend behavior into services. Do not let route handlers become the business logic layer.

- `researchService`: search discovery, URL crawl, HTML fetch, text extraction, dedupe, source quality fields, and crawler job updates.
- `libraryService`: people, sources, fragments, and read models for the frontend.
- `skillService`: evidence selection, skill prompt construction, citation mapping, and skill persistence.
- `evaluationService`: project brief snapshots, matrix evaluation, invest or pass conclusion, person judgment, business judgment, risks, questions, and critique chain generation.
- `modelService`: OpenAI-compatible API client, provider config, timeout, retry, and response parsing.

## Database Tables

Use SQLite with explicit tables:

- `people`: id, name, role, region, tags, status, notes, created_at, updated_at.
- `sources`: id, person_id, url, title, source_type, trust_level, crawl_status, fetched_at, created_at.
- `fragments`: id, source_id, person_id, content, summary, timeline_tag, evidence_type, created_at.
- `skills`: id, person_id, version, mental_models_json, heuristics_json, voice_dna_json, anti_patterns_json, honesty_boundaries_json, citations_json, created_at.
- `evaluations`: id, project_title, project_brief, skill_id, person_id, verdict, person_judgment, business_judgment, risk_json, questions_json, score_json, created_at.
- `critiques`: id, evaluation_id, critic_person_id, target_person_id, stance, critique, created_at.
- `jobs`: id, type, status, input_json, output_json, error, created_at, updated_at.

Do not collapse crawler state, skills, and evaluations into one application state blob.

## Crawler Boundary

The crawler is a controlled research assistant, not a hostile scraper.

Version one supports:

- seed URL crawling;
- search query discovery where available through a configured search provider or manual URL import;
- HTML fetching;
- main text extraction;
- deduplication by URL and content hash;
- rate limiting;
- failed job retry;
- source metadata capture.

Version one does not:

- log into third-party websites;
- bypass paywalls;
- ignore robots or rate limits;
- promise complete coverage of the public internet.

## Skill Distillation

A person skill is a structured approximation from public evidence, not a claim about the real person's private thoughts.

Each skill contains:

- biographical context relevant to decision-making;
- investment or operating principles;
- mental models;
- decision heuristics for judging people and business;
- industry theses;
- portfolio or company-building patterns;
- voice DNA for output style;
- anti-patterns and known blind spots;
- honesty boundaries that state what public data cannot support;
- citations back to stored fragments.

The prompt should force citation-aware output. A conclusion without evidence should be labeled as inference.

## Evaluation Flow

The user enters a project brief with:

- title;
- target user;
- problem;
- proposed solution;
- market thesis;
- founder or team notes;
- current traction;
- open questions.

The user selects one or more people from the matrix. For each selected skill, the backend asks the model to produce:

- verdict: invest, pass, or needs more evidence;
- person judgment;
- business judgment;
- strongest reason to believe;
- strongest reason to reject;
- top risks;
- due diligence questions;
- sharp critique in the persona's voice;
- confidence and evidence limits.

The user can then select an evaluation and ask another persona to critique it. Critiques are stored as first-class records.

## Error Handling

Every long-running operation is represented as a `jobs` row.

The UI shows job status instead of freezing:

- queued;
- running;
- succeeded;
- failed.

Crawler failures keep the source URL and error message. Model failures show provider error, retry state, and a safe recovery action. Database write failures surface a direct error and do not pretend data was saved.

## Testing

Use test-first implementation for behavior-bearing code.

Minimum test targets:

- database migrations create expected tables;
- `modelService` builds requests and parses responses with a fake provider;
- `researchService` dedupes URLs and extracted text;
- `skillService` maps skill citations to fragment ids;
- `evaluationService` stores one evaluation per selected persona;
- frontend renders the three-panel layout and switches between Research, Distill, and Evaluate.

## Documentation

Follow the project's GEB protocol while implementing:

- create L1 `AGENTS.md` at project root when app structure is created;
- create L2 `AGENTS.md` for major modules such as `src`, `server`, and `docs`;
- add L3 INPUT/OUTPUT/POS headers to business files;
- update documentation whenever files, modules, or exported responsibilities change.

Project memory is separate from architecture documentation. During implementation, initialize `docs/MEMORY.md`, `docs/daily/`, and `docs/bank/` only after confirming the minimal memory seed content with the user.

## First Implementation Slice

The first build should deliver a usable vertical slice:

- project scaffold;
- SQLite setup and migrations;
- backend health route;
- basic people/source/fragment CRUD routes;
- local crawler for seed URLs;
- model proxy route;
- skill distillation route;
- matrix evaluation route;
- React three-panel interface;
- seed people for a small initial matrix;
- `.env.example`;
- verification scripts.

This slice proves the core loop: collect evidence, distill skill, evaluate project, critique an evaluation.

## Design Risks

- The crawler can expand without limit. Keep strict job boundaries, rate limits, and visible source status.
- Persona output can become fan fiction. Force evidence, confidence, and honesty boundaries.
- The UI can become a dashboard graveyard. Keep the three-panel workflow and make every panel serve Research, Distill, or Evaluate.
- The backend can become a pile of route handlers. Keep business logic in services and routes thin.
