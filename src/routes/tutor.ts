import { Router, Request, Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';

import logger from '../utils/logger';
import { search } from '../services/searchService';
import { generateAnswer, type AnswerMode } from '../services/answerService';
import { checkAnswer } from '../middleware/qualityControl';
import { addToReviewQueue, readReviewQueue } from '../services/humanReviewQueue';
import { logInteraction, getStudentHistory } from '../services/loggingService';

const router = Router();

// ---------------------------------------------------------------------------
// Rate limiter — 20 requests per minute, keyed on studentId from body
// ---------------------------------------------------------------------------

const askLimiter = rateLimit({
  windowMs: 60 * 1_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  // studentId is always present for valid requests; missing body fails validation
  keyGenerator: (req) =>
    (req.body as { studentId?: string }).studentId ?? 'anonymous',
  validate: { ip: false },   // suppress IPv6 warning — we key on studentId, not IP
  handler: (_req, res) => {
    res.status(429).json({
      status: 'error',
      message: 'Too many requests — limit is 20 per minute per student.',
    });
  },
});

// ---------------------------------------------------------------------------
// Validation rules
// ---------------------------------------------------------------------------

const VALID_MODES: AnswerMode[] = [
  'explain',
  'summary',
  'quiz',
  'flashcards',
  'case_study',
  'exam_prep',
  'correction',
];

const askValidators = [
  body('question')
    .isString().withMessage('question must be a string')
    .trim().notEmpty().withMessage('question is required'),

  body('studentId')
    .isString().withMessage('studentId must be a string')
    .trim().notEmpty().withMessage('studentId is required'),

  body('module').optional().isString().withMessage('module must be a string'),
  body('course').optional().isString().withMessage('course must be a string'),

  body('mode')
    .optional()
    .isIn(VALID_MODES)
    .withMessage(`mode must be one of: ${VALID_MODES.join(', ')}`),
];

const historyValidators = [
  param('studentId')
    .isString().withMessage('studentId must be a string')
    .trim().notEmpty().withMessage('studentId is required'),
];

// ---------------------------------------------------------------------------
// POST /ask
// ---------------------------------------------------------------------------

router.post(
  '/ask',
  askLimiter,
  askValidators,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ status: 'error', errors: errors.array() });
      return;
    }

    const {
      question,
      studentId,
      module: moduleId,
      course,
      mode = 'explain',
    } = req.body as {
      question: string;
      studentId: string;
      module?: string;
      course?: string;
      mode?: AnswerMode;
    };

    const startedAt = Date.now();

    try {
      // 1. Retrieve relevant passages from Pinecone
      const { results: chunks, confidenceScore, needsHumanReview } = await search(
        question,
        { module: moduleId, course },
      );

      // 2. Escalate to human review when the question touches clinical keywords
      if (needsHumanReview) {
        await addToReviewQueue({
          studentId,
          question,
          module: moduleId ?? '',
          course: course ?? '',
          reason: 'flagged_keywords',
          timestamp: new Date().toISOString(),
        });

        logInteraction({
          studentId,
          question,
          answer: '',
          sources: [],
          module: moduleId ?? '',
          course: course ?? '',
          mode,
          confidence: confidenceScore,
          reviewStatus: 'pending',
        });

        logger.warn('Question escalated to human review', {
          studentId, module: moduleId, course, question,
        });

        res.status(200).json({
          status: 'review_required',
          message: 'This question has been sent to a tutor for review.',
        });
        return;
      }

      // 3. Generate the answer with GPT-4o
      const { answer } = await generateAnswer(
        question,
        chunks,
        mode as AnswerMode,
        {},
      );

      // 4. Quality gate
      const qc = checkAnswer(question, answer, chunks, needsHumanReview);

      if (!qc.passed) {
        logger.warn('Answer failed quality check', {
          studentId, reason: qc.reason, module: moduleId, course,
          durationMs: Date.now() - startedAt,
        });

        res.status(200).json({
          status: 'no_answer',
          reason: qc.reason,
          message: 'I could not find this in the course material.',
        });
        return;
      }

      // 5. Persist and log the successful interaction
      const sources = chunks.map(({ text, module: mod, course: crs, source }) => ({
        text, module: mod, course: crs, source,
      }));

      logInteraction({
        studentId,
        question,
        answer,
        sources,
        module: moduleId ?? '',
        course: course ?? '',
        mode,
        confidence: confidenceScore,
        reviewStatus: 'not_required',
      });

      // 6. Return the successful response
      res.status(200).json({
        answer,
        sources,
        confidence: confidenceScore,
        mode,
        needsHumanReview: false,
      });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /history/:studentId
// ---------------------------------------------------------------------------

router.get(
  '/history/:studentId',
  historyValidators,
  (req: Request, res: Response, next: NextFunction): void => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ status: 'error', errors: errors.array() });
      return;
    }

    try {
      const { studentId } = req.params;
      const history = getStudentHistory(studentId);
      res.status(200).json({ studentId, count: history.length, interactions: history });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /review-queue  (admin)
// ---------------------------------------------------------------------------

router.get(
  '/review-queue',
  (_req: Request, res: Response, next: NextFunction): void => {
    try {
      const queue = readReviewQueue();
      res.status(200).json({ count: queue.length, entries: queue });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
