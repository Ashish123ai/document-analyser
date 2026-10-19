import { AlertOctagon, AlertTriangle, Info } from 'lucide-react';
import { RISK_LABEL } from '../utils/format.js';

const STYLE = {
  high: { cls: 'bg-high-tint text-high', Icon: AlertOctagon },
  medium: { cls: 'bg-med-tint text-med', Icon: AlertTriangle },
  low: { cls: 'bg-low-tint text-low', Icon: Info },
};

// Level is always shown as text and an icon, never colour alone.
export default function RiskBadge({ level, compact = false }) {
  if (!level) return null;
  const { cls, Icon } = STYLE[level];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium ${cls}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {compact ? level[0].toUpperCase() + level.slice(1) : RISK_LABEL[level]}
    </span>
  );
}
