import 'dotenv/config';
import OpenAI from 'openai';
import { getIndex } from './vectorDb';

let _openai: OpenAI | null = null;

function openaiClient(): OpenAI {
  if (!_openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY env var is not set');
    _openai = new OpenAI({ apiKey });
  }
  return _openai;
}

// Keywords that indicate the query may involve medical/clinical decisions.
const HUMAN_REVIEW_KEYWORDS = [
  'symptoms',
  'diagnosis',
  'dosage',
  'medication',
  'supplement',
  'emergency',
  'treatment',
  'prescription',
  'overdose',
  'contraindication',
  'side effect',
];

export type SearchResultItem = {
  text: string;
  module: string;
  course: string;
  source: string;
  score: number;
};

export type SearchResponse = {
  results: SearchResultItem[];
  confidenceScore: number;
  needsHumanReview: boolean;
};

export type SearchOptions = {
  module?: string;
  course?: string;
};

function buildFilter(options: SearchOptions): object | undefined {
  if (options.course) {
    return { course: { $eq: options.course } };
  }
  if (options.module) {
    return { module: { $eq: options.module } };
  }
  return undefined;
}

function flagsHumanReview(query: string): boolean {
  const lower = query.toLowerCase();
  return HUMAN_REVIEW_KEYWORDS.some((kw) => lower.includes(kw));
}

export async function search(
  query: string,
  options: SearchOptions = {},
  topK = 5
): Promise<SearchResponse> {
  const embeddingResponse = await openaiClient().embeddings.create({
    model: 'text-embedding-3-small',
    input: query,
  });
  const queryVector = embeddingResponse.data[0].embedding;

  const filter = buildFilter(options);

  const queryResult = await getIndex().query({
    vector: queryVector,
    topK,
    includeMetadata: true,
    ...(filter ? { filter } : {}),
  });

  const results: SearchResultItem[] = queryResult.matches
    .filter((m) => m.metadata !== undefined)
    .map((m) => ({
      text: String(m.metadata!['text'] ?? ''),
      module: String(m.metadata!['module'] ?? ''),
      course: String(m.metadata!['course'] ?? ''),
      source: String(m.metadata!['source'] ?? ''),
      score: m.score ?? 0,
    }));

  const confidenceScore =
    results.length > 0
      ? Math.min(1, Math.max(0, results.reduce((sum, r) => sum + r.score, 0) / results.length))
      : 0;

  const needsHumanReview = flagsHumanReview(query);

  return { results, confidenceScore, needsHumanReview };
}

// ---------------------------------------------------------------------------
// Manual test — run with: npx ts-node src/services/searchService.ts
// ---------------------------------------------------------------------------
if (require.main === module) {
  (async () => {
    const cases: Array<{ label: string; query: string; options: SearchOptions }> = [
      {
        label: 'Full-program search (no filter)',
        query: 'rôle de l\'éducateur dans la communauté',
        options: {},
      },
      {
        label: 'Module-scoped search',
        query: 'nutrition et santé',
        options: { module: '611' },
      },
      {
        label: 'Course-scoped search + needsHumanReview trigger',
        query: 'dosage recommandé pour les suppléments vitaminiques',
        options: { course: 'Éducateur de la Santé' },
      },
    ];

    for (const tc of cases) {
      console.log(`\n── ${tc.label} ──`);
      console.log(`   query   : "${tc.query}"`);
      console.log(`   options : ${JSON.stringify(tc.options)}`);

      try {
        const response = await search(tc.query, tc.options, 3);
        console.log(`   confidence    : ${response.confidenceScore.toFixed(3)}`);
        console.log(`   humanReview   : ${response.needsHumanReview}`);
        console.log(`   matches (${response.results.length}):`);
        for (const r of response.results) {
          console.log(`     [${r.score.toFixed(3)}] [${r.module}/${r.course}] ${r.text.slice(0, 80)}…`);
        }
      } catch (err) {
        console.error('   ERROR:', err instanceof Error ? err.message : err);
      }
    }
  })();
}
