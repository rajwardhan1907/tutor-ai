# tutor-ai backend

AI-powered tutoring API for **CMDQ** (Collège de la Médecine Douce du Québec).
Students ask questions; the system retrieves relevant course passages from
Pinecone, generates a pedagogically-shaped answer with GPT-4o, and enforces a
quality gate before returning the response.

---

## Architecture overview

```
POST /ask
  │
  ├── searchService   → embed query (text-embedding-3-small) → Pinecone query
  │                     returns: chunks, confidenceScore, needsHumanReview
  │
  ├── [needsHumanReview] → humanReviewQueue (review_queue.json) → 200 review_required
  │
  ├── answerService   → GPT-4o with system prompt locked to course passages
  │
  ├── qualityControl  → checks: relevance score, AI leakage, answer length
  │                     fail → 200 no_answer
  │
  └── loggingService  → Winston log + SQLite (data/interactions.db) → 200 answer
```

---

## Running locally

### Prerequisites
- Node.js 18+
- A Pinecone account with an index named `tutor-cmdq` (dimension: 1536, metric: cosine)
- An OpenAI API key

### 1 — Environment

```bash
cp .env.example .env
# Fill in OPENAI_API_KEY and PINECONE_API_KEY
```

### 2 — Install dependencies

```bash
npm install
```

### 3 — Start the dev server

```bash
npm run dev          # nodemon + ts-node, hot-reload on src/ changes
```

Server starts on `http://localhost:3001`.

### 4 — Verify

```bash
curl http://localhost:3001/health
# → { "status": "ok", "version": "1.0.0", "timestamp": "...", "uptime": ... }
```

---

## Ingesting course content

Course material is stored as JSONL files — one JSON object per line, with a
`text` (or `content` / `answer` / `body`) field containing the passage.

```bash
# Full ingest
npx ts-node scripts/ingest.ts \
  --file ./data/module611.jsonl \
  --module 611 \
  --course "Éducateur de la Santé"

# Dry-run (no API calls — validates parsing only)
npx ts-node scripts/ingest.ts \
  --file ./data/module611.jsonl \
  --module 611 \
  --course "Éducateur de la Santé" \
  --dry-run
```

Chunks are ~500 tokens with 50-token overlap and are upserted to Pinecone in
batches of 100.

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `PORT` | No (default `3001`) | HTTP server port |
| `NODE_ENV` | No (default `development`) | `development` or `production` |
| `OPENAI_API_KEY` | **Yes** | Used for embeddings and GPT-4o completions |
| `PINECONE_API_KEY` | **Yes** | Pinecone project API key |
| `PINECONE_INDEX` | No (default `tutor-cmdq`) | Pinecone index name |

---

## API contract

### `POST /api/tutor-cmdq/ask`

**Rate limit:** 20 requests per minute per `studentId`.

**Request body**

```json
{
  "question":  "What is naturopathy?",
  "studentId": "stu-abc123",
  "module":    "611",
  "course":    "Éducateur de la Santé",
  "mode":      "explain"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `question` | string | Yes | |
| `studentId` | string | Yes | Used for logging and rate limiting |
| `module` | string | No | Narrows Pinecone filter to a module |
| `course` | string | No | Narrows Pinecone filter to a course (takes priority over module) |
| `mode` | string | No | Default `explain`. One of: `explain` `summary` `quiz` `flashcards` `case_study` `exam_prep` `correction` |

**Success response — 200**

```json
{
  "answer": "Naturopathy is a system of medicine…",
  "sources": [
    { "text": "…", "module": "611", "course": "Éducateur de la Santé", "source": "module611.jsonl" }
  ],
  "confidence": 0.82,
  "mode": "explain",
  "needsHumanReview": false
}
```

**Review required — 200**

Returned when the question contains clinical-safety keywords (`symptoms`,
`diagnosis`, `dosage`, `medication`, `supplement`, `emergency`, `treatment`,
`prescription`, `overdose`, `contraindication`, `side effect`).

```json
{
  "status": "review_required",
  "message": "This question has been sent to a tutor for review."
}
```

**No answer — 200**

```json
{
  "status": "no_answer",
  "reason": "no_relevant_content",
  "message": "I could not find this in the course material."
}
```

Possible `reason` values: `no_relevant_content` · `ai_leakage` · `too_short`

**Validation error — 400**

```json
{ "status": "error", "errors": [ { "msg": "question is required", ... } ] }
```

**Rate limit exceeded — 429**

```json
{ "status": "error", "message": "Too many requests — limit is 20 per minute per student." }
```

---

### `GET /api/tutor-cmdq/history/:studentId`

Returns the last 20 interactions for a student, newest first.

```json
{
  "studentId": "stu-abc123",
  "count": 3,
  "interactions": [ { "id": "...", "question": "...", "answer": "...", ... } ]
}
```

---

### `GET /api/tutor-cmdq/review-queue`

Returns all entries pending human review (admin use).

```json
{
  "count": 2,
  "entries": [
    {
      "studentId": "stu-abc123",
      "question": "What dosage of magnesium is recommended?",
      "module": "611",
      "course": "Éducateur de la Santé",
      "reason": "flagged_keywords",
      "timestamp": "2026-05-07T15:00:00.000Z"
    }
  ]
}
```

---

### `GET /health`

```json
{ "status": "ok", "version": "1.0.0", "timestamp": "...", "uptime": 42.3 }
```

---

## Running the integration test suite

With the dev server running:

```bash
npx ts-node scripts/testQueries.ts
```

Expected results (with a populated Pinecone index):
- **7+/10** answered successfully
- **Q04 & Q05** flagged for human review (clinical keywords)
- **Q10** returns `no_answer` (out-of-scope question)

---

## Data files

| Path | Description |
|---|---|
| `data/module611.jsonl` | Sample course content (3 entries) |
| `data/review_queue.json` | Append-only JSON array of escalated questions |
| `data/interactions.db` | SQLite database of all interactions (excluded from git) |

---

## Key source files

| Path | Responsibility |
|---|---|
| `src/index.ts` | Express app bootstrap and route mounting |
| `src/routes/tutor.ts` | `/ask`, `/history/:id`, `/review-queue` |
| `src/routes/health.ts` | `/health` |
| `src/services/vectorDb.ts` | Pinecone client, `upsertChunks()` |
| `src/services/ingestion.ts` | JSONL parsing and chunking |
| `src/services/searchService.ts` | Embedding + Pinecone query + `needsHumanReview` |
| `src/services/answerService.ts` | GPT-4o prompt construction per mode |
| `src/services/loggingService.ts` | SQLite persistence + Winston logging |
| `src/services/humanReviewQueue.ts` | `review_queue.json` append queue |
| `src/middleware/qualityControl.ts` | Answer quality gate |
