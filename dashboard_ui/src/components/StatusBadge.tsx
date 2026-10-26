// ---------------------------------------------------------------------------
// StatusBadge – coloured pill badge
// ---------------------------------------------------------------------------

interface StatusBadgeProps {
  value: boolean | string;
  trueLabel?: string;
  falseLabel?: string;
  variant?: 'hit' | 'failover' | 'tier';
}

export function StatusBadge({ value, trueLabel, falseLabel, variant = 'hit' }: StatusBadgeProps) {
  if (variant === 'tier') {
    const tier = String(value);
    return (
      <span className={`badge badge-tier-${tier}`}>
        {tier === 'fast' ? '⚡ Fast' : '🧠 Reasoning'}
      </span>
    );
  }

  const isTrue = value === true;
  const label = isTrue ? (trueLabel ?? 'Yes') : (falseLabel ?? 'No');
  const cls =
    variant === 'failover'
      ? isTrue ? 'badge badge-warn' : 'badge badge-ok'
      : isTrue ? 'badge badge-ok' : 'badge badge-muted';

  return <span className={cls}>{label}</span>;
}
