import { useState } from 'react';
import type { FormEvent } from 'react';

const MODULES = [
  { value: '', label: 'All modules' },
  { value: '611', label: '611' },
  { value: '711', label: '711' },
  { value: '811', label: '811' },
  { value: '821', label: '821' },
  { value: '911', label: '911' },
];

const MODES = [
  { value: 'explain',    label: 'Explain' },
  { value: 'summary',    label: 'Summary' },
  { value: 'quiz',       label: 'Quiz' },
  { value: 'flashcards', label: 'Flashcards' },
  { value: 'case_study', label: 'Case Study' },
  { value: 'exam_prep',  label: 'Exam Prep' },
  { value: 'correction', label: 'Correction' },
];

export type FormValues = {
  question: string;
  module: string;
  course: string;
  mode: string;
};

type Props = {
  onSubmit: (values: FormValues) => Promise<void>;
  loading: boolean;
};

export function QuestionForm({ onSubmit, loading }: Props) {
  const [question, setQuestion] = useState('');
  const [module,   setModule]   = useState('');
  const [course,   setCourse]   = useState('');
  const [mode,     setMode]     = useState('explain');

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!question.trim() || loading) return;
    await onSubmit({ question, module, course, mode });
  };

  return (
    <div className="question-card">
      <h1 className="question-card__heading">Ask your course material a question</h1>

      <form onSubmit={handleSubmit}>
        <textarea
          className="question-textarea"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a question about your course material…"
          rows={4}
          required
          disabled={loading}
        />

        <div className="question-controls">
          <div className="question-selects">
            <label className="form-label">
              Module
              <select
                className="form-select"
                value={module}
                onChange={(e) => setModule(e.target.value)}
              >
                {MODULES.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </label>

            <label className="form-label">
              Course
              <input
                type="text"
                className="form-input"
                value={course}
                onChange={(e) => setCourse(e.target.value)}
                placeholder="e.g. Éducateur de la Santé"
              />
            </label>

            <label className="form-label">
              Mode
              <select
                className="form-select"
                value={mode}
                onChange={(e) => setMode(e.target.value)}
              >
                {MODES.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="question-footer">
            <button
              type="submit"
              className="submit-btn"
              disabled={loading || !question.trim()}
            >
              {loading ? (
                <>
                  <span className="submit-spinner" />
                  Thinking…
                </>
              ) : (
                'Ask Tutor'
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
