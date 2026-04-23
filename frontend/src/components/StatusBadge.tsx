import { clsx } from 'clsx';

const STYLES: Record<string, string> = {
  success:    'badge-success',
  completed:  'badge-success',
  pending:    'badge-warning',
  processing: 'badge-warning',
  provisioning:'badge-warning',
  failed:     'badge-danger',
  refunded:   'badge-muted',
  reversed:   'badge-muted',
};

export function StatusBadge({ status }: { status: string }) {
  const cls = STYLES[status] ?? 'badge-muted';
  return <span className={clsx(cls)}>{status.replace('_', ' ')}</span>;
}
