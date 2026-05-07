import * as fs from 'fs';
import * as path from 'path';
import logger from '../utils/logger';

const QUEUE_FILE = path.resolve(__dirname, '../../data/review_queue.json');

export type ReviewEntry = {
  studentId: string;
  question: string;
  module: string;
  course: string;
  reason: string;
  timestamp: string;
};

// Serialised write lock: each call chains onto the previous promise so
// concurrent requests never interleave their read-modify-write cycle.
let _writeLock: Promise<void> = Promise.resolve();

function readQueue(): ReviewEntry[] {
  try {
    const raw = fs.readFileSync(QUEUE_FILE, 'utf8');
    return JSON.parse(raw) as ReviewEntry[];
  } catch (err: unknown) {
    // Missing file is expected on first run; any other error is re-thrown.
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

export async function addToReviewQueue(entry: ReviewEntry): Promise<void> {
  _writeLock = _writeLock.then(async () => {
    const queue = readQueue();
    queue.push(entry);
    await fs.promises.writeFile(QUEUE_FILE, JSON.stringify(queue, null, 2), 'utf8');
  });

  await _writeLock;

  logger.warn('Human review required', {
    studentId: entry.studentId,
    module: entry.module,
    course: entry.course,
    reason: entry.reason,
    timestamp: entry.timestamp,
    question: entry.question,
  });
}
