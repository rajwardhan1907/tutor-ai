type Props = {
  studentId: string;
  onChange: (id: string) => void;
};

export function TopBar({ studentId, onChange }: Props) {
  return (
    <header className="top-bar">
      <div className="top-bar__logo">
        <span className="top-bar__brand">CMDQ Tutor</span>
        <span className="top-bar__tagline">Médecines Douces du Québec</span>
      </div>

      <div className="top-bar__student">
        <label htmlFor="student-id" className="top-bar__label">
          Student ID
        </label>
        <input
          id="student-id"
          type="text"
          className="top-bar__input"
          value={studentId}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. stu-001"
          autoComplete="off"
          spellCheck={false}
        />
      </div>
    </header>
  );
}
