import { useState } from 'react';
import type { AskResponse, InteractionRow } from './api/tutor';
import { askQuestion } from './api/tutor';
import { TopBar } from './components/TopBar';
import { QuestionForm } from './components/QuestionForm';
import type { FormValues } from './components/QuestionForm';
import { AnswerDisplay } from './components/AnswerDisplay';
import { HistoryPanel } from './components/HistoryPanel';
import { StatusNotice } from './components/StatusNotice';

export default function App() {
  const [studentId,     setStudentId]     = useState('stu-001');
  const [loading,       setLoading]       = useState(false);
  const [response,      setResponse]      = useState<AskResponse | null>(null);
  const [answerVisible, setAnswerVisible] = useState(false);
  const [networkError,  setNetworkError]  = useState<string | null>(null);
  const [historyKey,    setHistoryKey]    = useState(0);

  const showAnswer = (r: AskResponse) => {
    setResponse(r);
    setAnswerVisible(false);
    // Double rAF: let React commit the initial hidden state before animating in
    requestAnimationFrame(() =>
      requestAnimationFrame(() => setAnswerVisible(true)),
    );
  };

  const handleSubmit = async (values: FormValues) => {
    if (!studentId.trim()) {
      setNetworkError('Please enter a Student ID before asking a question.');
      return;
    }

    setLoading(true);
    setNetworkError(null);

    try {
      const payload = {
        question:  values.question,
        studentId: studentId.trim(),
        mode:      values.mode,
        ...(values.module ? { module: values.module }          : {}),
        ...(values.course.trim() ? { course: values.course.trim() } : {}),
      };

      const result = await askQuestion(payload);
      showAnswer(result);
      setHistoryKey((k) => k + 1);
    } catch {
      setNetworkError(
        'Could not reach the tutor server. Is it running?',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleHistorySelect = (row: InteractionRow) => {
    let restored: AskResponse;

    if (row.reviewStatus === 'pending') {
      restored = {
        status:  'review_required',
        message: 'This question was previously sent to a tutor for review.',
      };
    } else {
      restored = {
        answer:           row.answer,
        sources:          row.sources,
        confidence:       row.confidence,
        mode:             row.mode,
        needsHumanReview: false,
      };
    }

    showAnswer(restored);
  };

  return (
    <div className="app-shell">
      <TopBar studentId={studentId} onChange={setStudentId} />

      <div className="content-wrap">
        <div className="content-grid">
          <main className="main-column">
            <QuestionForm onSubmit={handleSubmit} loading={loading} />

            {networkError && (
              <StatusNotice type="error" message={networkError} />
            )}

            {response !== null && (
              <AnswerDisplay response={response} visible={answerVisible} />
            )}
          </main>

          <HistoryPanel
            studentId={studentId}
            onSelect={handleHistorySelect}
            refreshKey={historyKey}
          />
        </div>
      </div>
    </div>
  );
}
