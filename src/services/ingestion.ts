import * as fs from 'fs';
import * as readline from 'readline';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { upsertChunks, type ChunkMetadata } from './vectorDb';

// ~500 tokens ≈ 2000 chars; ~50 tokens overlap ≈ 200 chars
const CHUNK_CHARS = 2000;
const OVERLAP_CHARS = 200;
const BATCH_SIZE = 100;

function extractText(record: Record<string, unknown>): string {
  const fields = ['text', 'content', 'answer', 'body', 'description'];
  const parts: string[] = [];

  for (const field of fields) {
    if (typeof record[field] === 'string') {
      parts.push(record[field] as string);
    }
  }

  if (parts.length === 0) {
    // Fallback: concatenate all string values
    for (const val of Object.values(record)) {
      if (typeof val === 'string') parts.push(val);
    }
  }

  return parts.join(' ').trim();
}

function splitIntoChunks(text: string): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + CHUNK_CHARS, text.length);
    chunks.push(text.slice(start, end));
    if (end === text.length) break;
    start = end - OVERLAP_CHARS;
  }

  return chunks;
}

export async function ingestJSONL(
  filePath: string,
  module: string,
  course: string
): Promise<void> {
  const resolvedPath = path.resolve(process.cwd(), filePath);
  const source = path.basename(resolvedPath);

  console.log(`Reading ${resolvedPath} …`);

  const rl = readline.createInterface({
    input: fs.createReadStream(resolvedPath),
    crlfDelay: Infinity,
  });

  let lineNum = 0;
  let totalChunks = 0;
  let batch: ChunkMetadata[] = [];

  const dryRun = process.env['INGEST_DRY_RUN'] === 'true';

  const flush = async () => {
    if (batch.length === 0) return;
    if (dryRun) {
      console.log(`  [dry-run] Would upsert ${batch.length} chunks (total so far: ${totalChunks})`);
    } else {
      console.log(`  Upserting batch of ${batch.length} chunks (total so far: ${totalChunks}) …`);
      await upsertChunks(batch);
    }
    batch = [];
  };

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    lineNum++;
    let record: Record<string, unknown>;

    try {
      record = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      console.warn(`  Line ${lineNum}: invalid JSON, skipping`);
      continue;
    }

    const text = extractText(record);
    if (!text) {
      console.warn(`  Line ${lineNum}: no text content found, skipping`);
      continue;
    }

    const chunks = splitIntoChunks(text);

    for (let i = 0; i < chunks.length; i++) {
      batch.push({
        chunkId: uuidv4(),
        text: chunks[i],
        module,
        course,
        source,
      });
      totalChunks++;

      if (batch.length >= BATCH_SIZE) {
        await flush();
      }
    }
  }

  await flush();

  console.log(`Done. Ingested ${lineNum} records → ${totalChunks} chunks.`);
}
