import * as path from 'path';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReviewStatus = 'pending' | 'approved' | 'not_required';

export type InteractionSource = {
  text: string;
  module: string;
  course: string;
  source: string;
};

export type LogEntry = {
  studentId: string;
  question: string;
  answer: string;
  sources: InteractionSource[];
  module: string;
  course: string;
  mode: string;
  confidence: number;
  reviewStatus: ReviewStatus;
};

export type InteractionRow = LogEntry & {
  id: string;
  createdAt: string;
};

// ---------------------------------------------------------------------------
// DB singleton
// ---------------------------------------------------------------------------

const DB_PATH = path.resolve(__dirname, '../../data/interactions.db');

let _db: Database.Database | null = null;

function db(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);

    // WAL mode gives better read/write concurrency at no correctness cost.
    _db.pragma('journal_mode = WAL');

    _db.exec(`
      CREATE TABLE IF NOT EXISTS interactions (
        id           TEXT PRIMARY KEY,
        studentId    TEXT NOT NULL,
        question     TEXT NOT NULL,
        answer       TEXT NOT NULL,
        sources      TEXT NOT NULL,
        module       TEXT NOT NULL,
        course       TEXT NOT NULL,
        mode         TEXT NOT NULL,
        confidence   REAL NOT NULL,
        reviewStatus TEXT NOT NULL,
        createdAt    TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_interactions_studentId
        ON interactions (studentId, createdAt DESC);
    `);
  }
  return _db;
}

// ---------------------------------------------------------------------------
// Prepared statements (lazily cached after first db() call)
// ---------------------------------------------------------------------------

let _insert: Database.Statement | null = null;
let _byStudent: Database.Statement | null = null;

function insertStmt(): Database.Statement {
  if (!_insert) {
    _insert = db().prepare(`
      INSERT INTO interactions
        (id, studentId, question, answer, sources, module, course, mode, confidence, reviewStatus, createdAt)
      VALUES
        (@id, @studentId, @question, @answer, @sources, @module, @course, @mode, @confidence, @reviewStatus, @createdAt)
    `);
  }
  return _insert;
}

function byStudentStmt(): Database.Statement {
  if (!_byStudent) {
    _byStudent = db().prepare(`
      SELECT * FROM interactions
      WHERE studentId = ?
      ORDER BY createdAt DESC
      LIMIT 20
    `);
  }
  return _byStudent;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function logInteraction(entry: LogEntry): string {
  const id = uuidv4();
  const createdAt = new Date().toISOString();
  const sourcesJson = JSON.stringify(entry.sources);

  insertStmt().run({
    id,
    studentId: entry.studentId,
    question: entry.question,
    answer: entry.answer,
    sources: sourcesJson,
    module: entry.module,
    course: entry.course,
    mode: entry.mode,
    confidence: entry.confidence,
    reviewStatus: entry.reviewStatus,
    createdAt,
  });

  logger.info('Interaction logged', {
    id,
    studentId: entry.studentId,
    module: entry.module,
    course: entry.course,
    mode: entry.mode,
    confidence: entry.confidence,
    reviewStatus: entry.reviewStatus,
    answerLength: entry.answer.length,
    sourceCount: entry.sources.length,
  });

  return id;
}

export function getStudentHistory(studentId: string): InteractionRow[] {
  const rows = byStudentStmt().all(studentId) as Array<
    Omit<InteractionRow, 'sources'> & { sources: string }
  >;

  return rows.map((row) => ({
    ...row,
    sources: JSON.parse(row.sources) as InteractionSource[],
  }));
}
