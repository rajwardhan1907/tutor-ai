type Props = { value: number };

export function ConfidenceBar({ value }: Props) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div className="confidence-wrap">
      <div className="confidence-track">
        <div className="confidence-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="confidence-pct">{pct}%</span>
    </div>
  );
}
