import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';

import logger from '../utils/logger';
import { search } from '../services/searchService';
import { generateAnswer, type AnswerMode } from '../services/answerService';
import { checkAnswer } from '../middleware/qualityControl';
import { addToReviewQueue } from '../services/humanReviewQueue';

const router = Router();

// ---------------------------------------------------------------------------
// Validation
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
    .isString()
    .withMessage('question must be a string')
    .trim()
    .notEmpty()
    .withMessage('question is required'),

  body('studentId')
    .isString()
    .withMessage('studentId must be a string')
    .trim()
    .notEmpty()
    .withMessage('studentId is required'),

  body('module')
    .optional()
    .isString()
    .withMessage('module must be a string'),

  body('course')
    .optional()
    .isString()
    .withMessage('course must be a string'),

  body('mode')
    .optional()
    .isIn(VALID_MODES)
    .withMessage(`mode must be one of: ${VALID_MODES.join(', ')}`),
];

// ---------------------------------------------------------------------------
// POST /ask
// ---------------------------------------------------------------------------

router.post(
  '/ask',
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

        logger.warn('Question escalated to human review', {
          studentId,
          module: moduleId,
          course,
          question,
        });

        res.status(200).json({
          status: 'review_required',
          message: 'This question has been sent to a tutor for review.',
        });
        return;
      }

      // 3. Generate the answer with GPT-4o
      const { answer, sourcesUsed } = await generateAnswer(
        question,
        chunks,
        mode as AnswerMode,
        {},
      );

      // 4. Quality gate
      const qc = checkAnswer(question, answer, chunks, needsHumanReview);

      if (!qc.passed) {
        logger.warn('Answer failed quality check', {
          studentId,
          reason: qc.reason,
          module: moduleId,
          course,
          durationMs: Date.now() - startedAt,
        });

        res.status(200).json({
          status: 'no_answer',
          reason: qc.reason,
          message: 'I could not find this in the course material.',
        });
        return;
      }

      // 5. Log the full interaction for the audit pipeline
      logger.info('Tutor interaction completed', {
        studentId,
        module: moduleId,
        course,
        mode,
        question,
        confidenceScore,
        sourcesUsed,
        answerLength: answer.length,
        durationMs: Date.now() - startedAt,
      });

      // 6. Return the successful response
      res.status(200).json({
        answer,
        sources: chunks.map(({ text, module: mod, course: crs, source }) => ({
          text,
          module: mod,
          course: crs,
          source,
        })),
        confidence: confidenceScore,
        mode,
        needsHumanReview: false,
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
