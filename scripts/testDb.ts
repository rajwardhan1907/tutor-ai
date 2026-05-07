import { logInteraction, getStudentHistory } from '../src/services/loggingService';

const id1 = logInteraction({
  studentId: 'stu-001',
  question: 'What is the role of a health educator?',
  answer: 'A health educator promotes healthy behaviours in the community.',
  sources: [{ text: 'Le rôle de l\'éducateur…', module: '611', course: 'Éducateur de la Santé', source: 'module611.jsonl' }],
  module: '611',
  course: 'Éducateur de la Santé',
  mode: 'explain',
  confidence: 0.91,
  reviewStatus: 'not_required',
});

const id2 = logInteraction({
  studentId: 'stu-001',
  question: 'What are macronutrients?',
  answer: 'Macronutrients include carbohydrates, lipids, and proteins.',
  sources: [],
  module: '611',
  course: 'Éducateur de la Santé',
  mode: 'summary',
  confidence: 0.85,
  reviewStatus: 'not_required',
});

console.log('Inserted IDs:', id1, id2);

const history = getStudentHistory('stu-001');
console.log(`Rows for stu-001: ${history.length}`);
console.log('Newest question :', history[0].question);
console.log('sources is array:', Array.isArray(history[0].sources));
console.log('reviewStatus    :', history[0].reviewStatus);
