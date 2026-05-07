/**
 * Live integration test against POST /api/tutor-cmdq/ask on localhost:3001.
 * Run with: npx ts-node scripts/testQueries.ts
 */

const BASE_URL = 'http://localhost:3001/api/tutor-cmdq/ask';
const STUDENT_ID = 'test-runner-001';

// ---------------------------------------------------------------------------
// Test cases
// ---------------------------------------------------------------------------

type TestCase = {
  question: string;
  module?: string;
  mode: string;
  label: string;
};

const TEST_CASES: TestCase[] = [
  {
    label: 'Q01',
    question: 'What is naturopathy?',
    module: '611',
    mode: 'explain',
  },
  {
    label: 'Q02',
    question: 'Summarise the key principles of homeopathy',
    module: '711',
    mode: 'summary',
  },
  {
    label: 'Q03',
    question: 'Give me flashcards on bioenergetics',
    module: '811',
    mode: 'flashcards',
  },
  {
    label: 'Q04 [→ review]',
    question: 'What are the symptoms of vitamin D deficiency?',
    module: '611',
    mode: 'explain',
  },
  {
    label: 'Q05 [→ review]',
    question: 'What dosage of magnesium is recommended?',
    module: '611',
    mode: 'explain',
  },
  {
    label: 'Q06',
    question: 'Create a quiz on cellular health',
    module: '821',
    mode: 'quiz',
  },
  {
    label: 'Q07',
    question: 'Prepare me for my exam on detoxification',
    module: '911',
    mode: 'exam_prep',
  },
  {
    label: 'Q08',
    question: 'My answer was that homeopathy uses full doses. Correct me.',
    module: '711',
    mode: 'correction',
  },
  {
    label: 'Q09',
    question: 'Give me a case study for nutrition counselling',
    module: '811',
    mode: 'case_study',
  },
  {
    label: 'Q10 [→ no_answer]',
    question: 'What is the moon phase today?',
    mode: 'explain',
  },
];

// ---------------------------------------------------------------------------
// Types for the three possible response shapes
// ---------------------------------------------------------------------------

type AskSuccess = {
  answer: string;
  sources: Array<{ text: string; module: string; course: string; source: string }>;
  confidence: number;
  mode: string;
  needsHumanReview: false;
};

type AskReview = {
  status: 'review_required';
  message: string;
};

type AskNoAnswer = {
  status: 'no_answer';
  reason: string;
  message: string;
};

type AskError = {
  status: 'error';
  errors: unknown[];
};

type AskResponse = AskSuccess | AskReview | AskNoAnswer | AskError;

// ---------------------------------------------------------------------------
// Result record accumulated per test
// ---------------------------------------------------------------------------

type Result = {
  label: string;
  question: string;
  mode: string;
  outcome: 'passed' | 'review_required' | 'no_answer' | 'error';
  confidence: number | null;
  answerPreview: string | null;
  reason: string | null;
  durationMs: number;
};

// ---------------------------------------------------------------------------
// HTTP helper (Node 18+ native fetch)
// ---------------------------------------------------------------------------

async function askEndpoint(tc: TestCase): Promise<{ data: AskResponse; durationMs: number }> {
  const body: Record<string, string> = {
    question: tc.question,
    studentId: STUDENT_ID,
    mode: tc.mode,
  };
  if (tc.module) body['module'] = tc.module;

  const t0 = Date.now();
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const durationMs = Date.now() - t0;

  if (!res.ok && res.status !== 200) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  const data = (await res.json()) as AskResponse;
  return { data, durationMs };
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

const RESET  = '\x1b[0m';
const BOLD   = '\x1b[1m';
const GREEN  = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED    = '\x1b[31m';
const CYAN   = '\x1b[36m';
const DIM    = '\x1b[2m';

function colour(text: string, c: string): string {
  return `${c}${text}${RESET}`;
}

function outcomeTag(outcome: Result['outcome']): string {
  switch (outcome) {
    case 'passed':          return colour('  PASSED  ', GREEN);
    case 'review_required': return colour('  REVIEW  ', YELLOW);
    case 'no_answer':       return colour(' NO ANSWER ', RED);
    case 'error':           return colour('  ERROR   ', RED + BOLD);
  }
}

function bar(value: number, width = 20): string {
  const filled = Math.round(value * width);
  return colour('█'.repeat(filled), CYAN) + colour('░'.repeat(width - filled), DIM);
}

function printResult(r: Result, idx: number): void {
  console.log();
  console.log(colour(`─── ${r.label} `, BOLD) + colour('─'.repeat(50 - r.label.length), DIM));
  console.log(`  Question : ${r.question}`);
  console.log(`  Mode     : ${r.mode}`);
  console.log(`  Status   : ${outcomeTag(r.outcome)}   ${DIM}(${r.durationMs} ms)${RESET}`);

  if (r.confidence !== null) {
    console.log(`  Confidence: ${bar(r.confidence)} ${(r.confidence * 100).toFixed(1)}%`);
  }

  if (r.reason) {
    console.log(`  Reason   : ${colour(r.reason, YELLOW)}`);
  }

  if (r.answerPreview) {
    const preview = r.answerPreview.length > 200
      ? r.answerPreview.slice(0, 197) + '…'
      : r.answerPreview;
    console.log(`  Preview  : ${DIM}${preview}${RESET}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log(colour('\n══════════════════════════════════════════════════════', BOLD));
  console.log(colour('  TUTOR-CMDQ  Live Endpoint Test  (10 queries)', BOLD));
  console.log(colour('══════════════════════════════════════════════════════', BOLD));
  console.log(`  Target : ${BASE_URL}`);
  console.log(`  Student: ${STUDENT_ID}\n`);

  const results: Result[] = [];

  for (let i = 0; i < TEST_CASES.length; i++) {
    const tc = TEST_CASES[i];
    process.stdout.write(`  Running ${tc.label}… `);

    let result: Result;

    try {
      const { data, durationMs } = await askEndpoint(tc);

      if ('answer' in data) {
        result = {
          label: tc.label, question: tc.question, mode: tc.mode,
          outcome: 'passed',
          confidence: data.confidence,
          answerPreview: data.answer.replace(/\n+/g, ' '),
          reason: null,
          durationMs,
        };
      } else if (data.status === 'review_required') {
        result = {
          label: tc.label, question: tc.question, mode: tc.mode,
          outcome: 'review_required',
          confidence: null,
          answerPreview: null,
          reason: 'flagged_keywords',
          durationMs,
        };
      } else if (data.status === 'no_answer') {
        result = {
          label: tc.label, question: tc.question, mode: tc.mode,
          outcome: 'no_answer',
          confidence: null,
          answerPreview: null,
          reason: data.reason,
          durationMs,
        };
      } else {
        result = {
          label: tc.label, question: tc.question, mode: tc.mode,
          outcome: 'error',
          confidence: null,
          answerPreview: JSON.stringify(data),
          reason: 'validation_error',
          durationMs,
        };
      }
    } catch (err) {
      result = {
        label: tc.label, question: tc.question, mode: tc.mode,
        outcome: 'error',
        confidence: null,
        answerPreview: null,
        reason: err instanceof Error ? err.message : String(err),
        durationMs: 0,
      };
    }

    process.stdout.write(`${outcomeTag(result.outcome)}\n`);
    results.push(result);
  }

  // Detailed per-question report
  console.log(colour('\n══════════════════════════════════════════════════════', BOLD));
  console.log(colour('  DETAILED RESULTS', BOLD));
  console.log(colour('══════════════════════════════════════════════════════', BOLD));

  results.forEach((r, i) => printResult(r, i));

  // Summary
  const passed   = results.filter((r) => r.outcome === 'passed').length;
  const review   = results.filter((r) => r.outcome === 'review_required').length;
  const noAnswer = results.filter((r) => r.outcome === 'no_answer').length;
  const errors   = results.filter((r) => r.outcome === 'error').length;
  const avgMs    = Math.round(results.reduce((s, r) => s + r.durationMs, 0) / results.length);
  const avgConf  = (() => {
    const scored = results.filter((r) => r.confidence !== null);
    return scored.length
      ? scored.reduce((s, r) => s + (r.confidence ?? 0), 0) / scored.length
      : null;
  })();

  console.log(colour('\n══════════════════════════════════════════════════════', BOLD));
  console.log(colour('  SUMMARY', BOLD));
  console.log(colour('══════════════════════════════════════════════════════', BOLD));
  console.log(`  Total queries  : ${results.length}`);
  console.log(`  ${colour('Passed', GREEN)}          : ${passed}/${results.length}`);
  console.log(`  ${colour('Review required', YELLOW)} : ${review}`);
  console.log(`  ${colour('No answer', RED)}      : ${noAnswer}`);
  if (errors > 0) console.log(`  ${colour('Errors', RED + BOLD)}         : ${errors}`);
  console.log(`  Avg latency    : ${avgMs} ms`);
  if (avgConf !== null) {
    console.log(`  Avg confidence : ${bar(avgConf)} ${(avgConf * 100).toFixed(1)}%`);
  }
  console.log();
}

main().catch((err) => {
  console.error('\nFatal error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
