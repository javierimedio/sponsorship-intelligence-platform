// src/components/empty-state.tsx

import Link from 'next/link';

interface EmptyStateProps {
  message: string;
  actionHref?: string;
  actionLabel?: string;
}

export function EmptyState({ message, actionHref, actionLabel }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <p style={{ margin: 0 }}>
        {message}
        {actionHref && actionLabel && (
          <>
            {' '}
            <Link href={actionHref}>{actionLabel} →</Link>
          </>
        )}
      </p>
    </div>
  );
}
