import 'dotenv/config';
import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';

const INDEX_NAME = process.env.PINECONE_INDEX ?? 'tutor-cmdq';

let _pinecone: Pinecone | null = null;
let _openai: OpenAI | null = null;

function pinecone(): Pinecone {
  if (!_pinecone) {
    const apiKey = process.env.PINECONE_API_KEY;
    if (!apiKey) throw new Error('PINECONE_API_KEY env var is not set');
    _pinecone = new Pinecone({ apiKey });
  }
  return _pinecone;
}

function openaiClient(): OpenAI {
  if (!_openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY env var is not set');
    _openai = new OpenAI({ apiKey });
  }
  return _openai;
}

export function getIndex() {
  return pinecone().index(INDEX_NAME);
}

export type ChunkMetadata = {
  text: string;
  module: string;
  course: string;
  chunkId: string;
  source: string;
};

export async function upsertChunks(chunks: ChunkMetadata[]): Promise<void> {
  if (chunks.length === 0) return;

  const response = await openaiClient().embeddings.create({
    model: 'text-embedding-3-small',
    input: chunks.map((c) => c.text),
  });

  await getIndex().upsert({
    records: chunks.map((chunk, i) => ({
      id: chunk.chunkId,
      values: response.data[i].embedding,
      metadata: {
        text: chunk.text,
        module: chunk.module,
        course: chunk.course,
        chunkId: chunk.chunkId,
        source: chunk.source,
      },
    })),
  });
}
