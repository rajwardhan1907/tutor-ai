import 'dotenv/config';
import OpenAI from 'openai';
import type { SearchResultItem } from './searchService';

let _openai: OpenAI | null = null;

function openaiClient(): OpenAI {
  if (!_openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY env var is not set');
    _openai = new OpenAI({ apiKey });
  }
  return _openai;
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type AnswerMode =
  | 'explain'
  | 'summary'
  | 'quiz'
  | 'flashcards'
  | 'case_study'
  | 'exam_prep'
  | 'correction';

export type StudentContext = {
  /** The student's own attempt or answer, required when mode === 'correction'. */
  studentAnswer?: string;
  /** Student's preferred language for the response (e.g. "fr", "en"). */
  language?: string;
};

export type AnswerResponse = {
  answer: string;
  mode: AnswerMode;
  /** Deduplicated list of source filenames used in the context. */
  sourcesUsed: string[];
};

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `\
You are an expert tutor for CMDQ (Collège de la Médecine Douce du Québec), a natural health college.

Your role is to help students understand their course material.

Rules you must follow without exception:
1. Answer ONLY using the course passages provided in the user message.
2. Do not draw on any outside knowledge, even if you are confident it is correct.
3. If the provided passages do not contain enough information to answer the question, respond with exactly: "I could not find this in the course material."
4. Never speculate, extrapolate, or add information beyond what is explicitly stated in the passages.
5. Maintain a supportive, pedagogical tone appropriate for a health-education student.`;

const MODE_INSTRUCTIONS: Record<AnswerMode, string> = {
  explain:
    'Provide a clear explanation in plain, accessible language. ' +
    'Define any technical terms and use concrete examples where the passages support them.',

  summary:
    'Produce a concise bullet-point summary of the key points found in the passages. ' +
    'Each bullet should be a single, self-contained idea. Use at most 8 bullets.',

  quiz:
    'Generate exactly 3 multiple-choice questions based strictly on the passage content. ' +
    'For each question provide: the question, four labelled options (A–D), and the correct answer with a brief explanation. ' +
    'Format:\nQ1. <question>\nA) …\nB) …\nC) …\nD) …\nAnswer: <letter> — <explanation>\n(repeat for Q2, Q3)',

  flashcards:
    'Generate exactly 5 flashcard pairs based strictly on the passage content. ' +
    'Format each pair as:\nFront: <concept or question>\nBack: <definition or answer>\n',

  case_study:
    'Apply the content from the passages to a realistic patient or client scenario relevant to natural health practice. ' +
    'Describe the scenario briefly, then walk through how the course concepts apply. ' +
    'Do not invent clinical details that are not supported by the passages.',

  exam_prep:
    'Identify the most examinable concepts from the passages. ' +
    'For each concept, state why it is likely to appear on an exam and provide an example of the type of question that might be asked ' +
    '(e.g. definition, application, comparison). Keep the list focused — no more than 6 items.',

  correction:
    'The student has provided an incorrect or incomplete answer (given below). ' +
    'Using only the course passages, explain what the correct answer is and why. ' +
    'Be constructive and specific about what was right, what was wrong, and what the student should remember.',
};

function buildUserPrompt(
  question: string,
  chunks: SearchResultItem[],
  mode: AnswerMode,
  context: StudentContext
): string {
  const passageBlock = chunks
    .map((c, i) => `[Passage ${i + 1} | module: ${c.module} | source: ${c.source}]\n${c.text}`)
    .join('\n\n');

  const modeInstruction = MODE_INSTRUCTIONS[mode];

  const languageNote =
    context.language && context.language !== 'en'
      ? `\nRespond in the following language: ${context.language}.`
      : '';

  const studentAnswerBlock =
    mode === 'correction' && context.studentAnswer
      ? `\nStudent's answer to correct:\n"""\n${context.studentAnswer}\n"""`
      : '';

  return (
    `--- COURSE PASSAGES ---\n${passageBlock}\n--- END OF PASSAGES ---` +
    `\n\nQuestion: ${question}` +
    studentAnswerBlock +
    `\n\nInstruction: ${modeInstruction}` +
    languageNote
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function generateAnswer(
  question: string,
  retrievedChunks: SearchResultItem[],
  mode: AnswerMode,
  studentContext: StudentContext = {}
): Promise<AnswerResponse> {
  const userPrompt = buildUserPrompt(question, retrievedChunks, mode, studentContext);

  const completion = await openaiClient().chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 1000,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
  });

  const answer = completion.choices[0]?.message?.content?.trim() ?? '';

  const sourcesUsed = [...new Set(retrievedChunks.map((c) => c.source))];

  return { answer, mode, sourcesUsed };
}

// ---------------------------------------------------------------------------
// Manual test — run with: npx ts-node src/services/answerService.ts
// ---------------------------------------------------------------------------
if (require.main === module) {
  const MOCK_CHUNKS: SearchResultItem[] = [
    {
      text: "Le rôle de l'éducateur de la santé est de promouvoir des comportements sains au sein de la communauté. Il conçoit et met en œuvre des programmes d'éducation sanitaire adaptés aux besoins de la population cible.",
      module: '611',
      course: 'Éducateur de la Santé',
      source: 'module611.jsonl',
      score: 0.92,
    },
    {
      text: "La nutrition est un pilier fondamental de la santé publique. Une alimentation équilibrée comprend des macronutriments — glucides, lipides et protéines — ainsi que des micronutriments essentiels tels que les vitamines et les minéraux.",
      module: '611',
      course: 'Éducateur de la Santé',
      source: 'module611.jsonl',
      score: 0.87,
    },
  ];

  const cases: Array<{
    label: string;
    mode: AnswerMode;
    question: string;
    context?: StudentContext;
  }> = [
    {
      label: 'explain',
      mode: 'explain',
      question: "What is the role of a health educator?",
    },
    {
      label: 'summary',
      mode: 'summary',
      question: "Summarise the key ideas in these passages.",
    },
    {
      label: 'quiz',
      mode: 'quiz',
      question: "Create quiz questions from these passages.",
    },
    {
      label: 'correction',
      mode: 'correction',
      question: "What are macronutrients?",
      context: {
        studentAnswer: "Macronutrients are only vitamins and minerals.",
      },
    },
  ];

  (async () => {
    for (const tc of cases) {
      console.log(`\n${'─'.repeat(60)}`);
      console.log(`MODE: ${tc.label.toUpperCase()}`);
      console.log(`${'─'.repeat(60)}`);
      try {
        const result = await generateAnswer(tc.question, MOCK_CHUNKS, tc.mode, tc.context ?? {});
        console.log(`Sources: ${result.sourcesUsed.join(', ')}`);
        console.log(`\n${result.answer}`);
      } catch (err) {
        console.error('ERROR:', err instanceof Error ? err.message : err);
      }
    }
  })();
}
