import type { ReactNode } from 'react';
import type { AskResponse, AskSuccess } from '../api/tutor';
import { ConfidenceBar } from './ConfidenceBar';
import { StatusNotice } from './StatusNotice';

type Props = {
  response: AskResponse;
  visible: boolean;
};

export function AnswerDisplay({ response, visible }: Props) {
  return (
    <div className={`answer-card${visible ? ' answer-card--visible' : ''}`}>
      {renderResponse(response)}
    </div>
  );
}

function renderResponse(r: AskResponse): ReactNode {
  if ('answer' in r) {
    return <SuccessContent data={r} />;
  }
  if (r.status === 'review_required') {
    return (
      <StatusNotice
        type="review"
        message="Your question has been sent to a tutor for personal review."
      />
    );
  }
  if (r.status === 'no_answer') {
    return (
      <StatusNotice
        type="empty"
        message="This topic wasn't found in the course material."
      />
    );
  }
  // validation error
  const msg = r.errors.map((e) => e.msg).join(' · ');
  return <StatusNotice type="error" message={msg} />;
}

function SuccessContent({ data }: { data: AskSuccess }) {
  const uniqueSources = [...new Set(data.sources.map((s) => s.source))];
  return (
    <>
      <div className="answer-meta">
        <span className={`mode-badge mode-badge--${data.mode}`}>{data.mode}</span>
        <ConfidenceBar value={data.confidence} />
      </div>

      <div className="answer-body">{formatAnswer(data.answer)}</div>

      {uniqueSources.length > 0 && (
        <div className="answer-sources">
          <span className="answer-sources__label">Sources</span>
          <div className="answer-sources__pills">
            {uniqueSources.map((src) => (
              <span key={src} className="source-pill">{src}</span>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// ── Inline formatter ──────────────────────────────────────────────────────────

function inlineFmt(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (/^`[^`]+`$/.test(part))       return <code key={i}>{part.slice(1, -1)}</code>;
    return part;
  });
}

function formatAnswer(raw: string): ReactNode {
  const lines = raw.split('\n');
  const out: ReactNode[] = [];
  let olItems: ReactNode[] = [];
  let ulItems: ReactNode[] = [];
  let pLines:  string[]    = [];
  let k = 0;

  const flushOl = () => {
    if (olItems.length) {
      out.push(<ol key={k++} className="answer-list">{olItems}</ol>);
      olItems = [];
    }
  };
  const flushUl = () => {
    if (ulItems.length) {
      out.push(<ul key={k++} className="answer-list">{ulItems}</ul>);
      ulItems = [];
    }
  };
  const flushP = () => {
    const t = pLines.join(' ').trim();
    if (t) out.push(<p key={k++}>{inlineFmt(t)}</p>);
    pLines = [];
  };

  for (const line of lines) {
    const t = line.trim();
    if (!t) {
      flushOl(); flushUl(); flushP();
    } else if (/^\d+\.\s/.test(t)) {
      flushUl(); flushP();
      olItems.push(<li key={olItems.length}>{inlineFmt(t.replace(/^\d+\.\s*/, ''))}</li>);
    } else if (/^[-•*]\s/.test(t)) {
      flushOl(); flushP();
      ulItems.push(<li key={ulItems.length}>{inlineFmt(t.replace(/^[-•*]\s*/, ''))}</li>);
    } else if (/^#{1,4}\s/.test(t)) {
      flushOl(); flushUl(); flushP();
      const lvl  = (t.match(/^(#+)/)?.[1].length ?? 1);
      const text = t.replace(/^#+\s*/, '');
      const tags = ['h3', 'h3', 'h4', 'h5'] as const;
      const Tag  = tags[Math.min(lvl - 1, 3)];
      out.push(<Tag key={k++} className="answer-heading">{text}</Tag>);
    } else {
      flushOl(); flushUl();
      pLines.push(t);
    }
  }

  flushOl(); flushUl(); flushP();
  return <>{out}</>;
}
