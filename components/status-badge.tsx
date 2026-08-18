import { CircleCheck, Clock3, FileText, AlertCircle, CircleDollarSign } from 'lucide-react';
import type { InvoiceStatus } from '@/lib/data';

const statusConfig: Record<string, { className: string; icon: typeof CircleCheck }> = {
  'Payée': { className: 'badge-success', icon: CircleCheck },
  'Envoyée': { className: 'badge-warning', icon: Clock3 },
  'Brouillon': { className: 'badge-neutral', icon: FileText },
  'En retard': { className: 'badge-danger', icon: AlertCircle },
  'Impayée': { className: 'badge-danger', icon: AlertCircle },
  'Partiellement payée': { className: 'badge-info', icon: CircleDollarSign },
  'En cours': { className: 'badge-success', icon: CircleCheck },
  'Prêt à vendre': { className: 'badge-warning', icon: Clock3 },
  'Terminé': { className: 'badge-neutral', icon: CircleCheck },
  'Archivée': { className: 'badge-neutral', icon: FileText },
  'Disponible': { className: 'badge-success', icon: CircleCheck },
  'Stocké': { className: 'badge-success', icon: CircleCheck },
  'Partiellement vendu': { className: 'badge-warning', icon: Clock3 },
  'Normal': { className: 'badge-success', icon: CircleCheck },
  'Faible': { className: 'badge-warning', icon: Clock3 },
  'Critique': { className: 'badge-danger', icon: AlertCircle },
  'Rupture': { className: 'badge-danger', icon: AlertCircle },
  'Expiré': { className: 'badge-danger', icon: AlertCircle },
  'Expire bientôt': { className: 'badge-warning', icon: Clock3 },
  'Consommé à 72%': { className: 'badge-info', icon: CircleDollarSign },
  'En production': { className: 'badge-info', icon: Clock3 },
  'Réceptionné': { className: 'badge-success', icon: CircleCheck },
  'En transit': { className: 'badge-warning', icon: Clock3 },
  'Demandée': { className: 'badge-info', icon: Clock3 },
  'Validé': { className: 'badge-success', icon: CircleCheck },
};

export function StatusBadge({ status }: { status: InvoiceStatus | string }) {
  const config = statusConfig[status] ?? { className: 'badge-neutral', icon: FileText };
  const Icon = config.icon;
  return (
    <span className={`status-badge ${config.className}`}>
      <Icon size={12} strokeWidth={2.4} />
      {status}
    </span>
  );
}
