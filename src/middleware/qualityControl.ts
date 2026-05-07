import type { SearchResultItem } from '../services/searchService';

// Phrases that indicate the model answered from its own training data rather
// than the retrieved course passages.
const AI_LEAKAGE_PHRASES = [
  'as an ai',
  "i don't have access",
  'i do not have access',
  'my training data',
  'as a language model',
  'as an llm',
  'i was trained',
  'my knowledge cutoff',
  'i cannot access',
];

const MIN_SCORE_THRESHOLD = 0.6;
const MIN_ANSWER_LENGTH = 50;

export type QualityCheckResult = {
  passed: boolean;
  reason?: 'no_relevant_content' | 'ai_leakage' | 'too_short';
  review_required: boolean;
};

export function checkAnswer(
  _question: string,
  answer: string,
  retrievedChunks: SearchResultItem[],
  needsHumanReview = false
): QualityCheckResult {
  const review_required = needsHumanReview;

  // 1. No chunks at all, or every chunk scored below the relevance threshold.
  if (
    retrievedChunks.length === 0 ||
    retrievedChunks.every((c) => c.score < MIN_SCORE_THRESHOLD)
  ) {
    return { passed: false, reason: 'no_relevant_content', review_required };
  }

  // 2. Model leaked its own training knowledge instead of using the passages.
  const answerLower = answer.toLowerCase();
  if (AI_LEAKAGE_PHRASES.some((phrase) => answerLower.includes(phrase))) {
    return { passed: false, reason: 'ai_leakage', review_required };
  }

  // 3. Answer is too short to be useful.
  if (answer.trim().length < MIN_ANSWER_LENGTH) {
    return { passed: false, reason: 'too_short', review_required };
  }

  return { passed: true, review_required };
}
