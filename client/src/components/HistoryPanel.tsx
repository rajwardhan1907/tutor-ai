import { useState, useEffect } from 'react';
import type { InteractionRow } from '../api/tutor';
import { getHistory } from '../api/tutor';
import { ConfidenceBar } from './ConfidenceBar';

type Props = {
  studentId: string;
  onSelect: (row: InteractionRow) => void;
  refreshKey: number;
};

export function HistoryPanel({ studentId, onSelect, refreshKey }: Props) {
  const [rows,    setRows]    = useState<InteractionRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!studentId.trim()) { setRows([]); return; }
    let cancelled = false;
    setLoading(true);
    getHistory(studentId)
      .then((r) => { if (!cancelled) setRows(r.interactions); })
      .catch(() => { if (!cancelled) setRows([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [studentId, refreshKey]);

  return (
    <aside className="history-panel">
      <div className="history-panel__header">
        <h2 className="history-panel__title">Recent Questions</h2>
      </div>

      <div className="history-panel__body">
        {!studentId.trim() && (
          <p className="history-panel__placeholder">
            Enter a Student ID to view your history.
          </p>
        )}

        {studentId.trim() && loading && (
          <p className="history-panel__placeholder">Loading…</p>
        )}

        {studentId.trim() && !loading && rows.length === 0 && (
          <p className="history-panel__placeholder">No history yet for this student.</p>
        )}

        {!loading && rows.length > 0 && (
          <ul className="history-list">
            {rows.map((row) => (
              <li key={row.id} className="history-item" onClick={() => onSelect(row)}>
                <p className="history-item__question">
                  {row.question.length > 85
                    ? `${row.question.slice(0, 82)}…`
                    : row.question}
                </p>
                <div className="history-item__meta">
                  <span className={`mode-badge mode-badge--${row.reviewStatus === 'pending' ? 'pending' : row.mode}`}>
                    {row.reviewStatus === 'pending' ? 'review' : row.mode}
                  </span>
                  {row.confidence > 0 && <ConfidenceBar value={row.confidence} />}
                  <span className="history-item__time">{relTime(row.createdAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString('fr-CA');
}
