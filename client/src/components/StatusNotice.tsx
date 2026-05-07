export type NoticeType = 'review' | 'empty' | 'error';

const ICONS: Record<NoticeType, string> = {
  review: '⏳',
  empty:  '🔍',
  error:  '⚠️',
};

type Props = { type: NoticeType; message: string };

export function StatusNotice({ type, message }: Props) {
  return (
    <div className={`status-notice status-notice--${type}`}>
      <span className="status-notice__icon">{ICONS[type]}</span>
      <span>{message}</span>
    </div>
  );
}
