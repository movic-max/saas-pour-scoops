'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronRight, Clock3, Timer, XCircle } from 'lucide-react';
import { FARM_STORAGE_KEYS, readLocal, subscribeToFarmData } from '@/lib/farm-storage';
import { SectionHeading } from '@/components/ui';
import { StatusBadge } from '@/components/status-badge';
import { formatDate, formatFCFA } from '@/lib/format';
import { minutesFromTime, plannedEndTime, TASKS_TODAY, formatDuration, type DailyTask, type TaskUnitId } from '@/lib/daily-tasks';

const unitHrefs: Record<TaskUnitId, string> = { poulets: '/poulets/taches', chevrerie: '/chevrerie/taches', provenderie: '/provenderie/taches', bio: '/produits-bio/taches', pressoir: '/pressoir/taches', stocks: '/stocks/taches' };

/** Section « Tâches du jour » ajoutée aux rapports de chaque unité. */
export function DailyTasksReportSection({ unitId }: { unitId: TaskUnitId }) {
  const [instances, setInstances] = useState<DailyTask[]>([]);
  useEffect(() => {
    const load = () => setInstances(readLocal<DailyTask[]>(FARM_STORAGE_KEYS.dailyTasks, []));
    load();
    return subscribeToFarmData([FARM_STORAGE_KEYS.dailyTasks], load);
  }, []);
  const tasks = useMemo(() => instances.filter((task) => task.unitId === unitId && task.date === TASKS_TODAY).sort((a, b) => minutesFromTime(a.startTime) - minutesFromTime(b.startTime)), [instances, unitId]);
  const done = tasks.filter((task) => task.status === 'Terminée');
  const notDone = tasks.filter((task) => task.status !== 'Terminée');
  const gains = done.filter((task) => task.outcome === 'onTime');
  const losses = done.filter((task) => task.outcome === 'late');
  const proposedGain = done.reduce((sum, task) => sum + (task.outcome === 'onTime' ? task.bonusAmount : 0), 0);
  const proposedPenalty = done.reduce((sum, task) => sum + (task.outcome === 'late' ? task.penaltyAmount : 0), 0);
  const validationLabel = (task: DailyTask) => task.validation === 'pending' ? 'En attente' : task.validation === 'approved' ? 'Validée' : 'Rejetée';

  if (tasks.length === 0) return null;
  return <div className="surface overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf0eb] px-5 py-5 sm:px-6"><SectionHeading eyebrow={`Tâches du jour · ${formatDate(TASKS_TODAY)}`} title="Planning et primes de l’unité" description="Tâches accomplies et non accomplies, gains et pertes proposés, statut de validation RH." /><Link href={unitHrefs[unitId]} className="inline-flex items-center gap-1 text-[11px] font-bold text-[#4d8e4d] hover:text-forest">Ouvrir le planning<ChevronRight size={13} /></Link></div><div className="grid gap-3 px-5 py-4 sm:grid-cols-2 sm:px-6 xl:grid-cols-4"><SummaryBox icon={CheckCircle2} label="Accomplies" value={`${done.length}/${tasks.length}`} detail={gains.length ? `${gains.length} à temps · ${losses.length} en retard` : 'aucune terminée'} tone="green" /><SummaryBox icon={Clock3} label="Non accomplies" value={String(notDone.length)} detail={notDone.length ? 'à faire ou en cours' : 'journée bouclée'} tone="blue" /><SummaryBox icon={Timer} label="Gains proposés" value={proposedGain > 0 ? `+${formatFCFA(proposedGain)}` : '—'} detail={`${gains.length} prime(s) · validation RH`} tone="green" /><SummaryBox icon={XCircle} label="Pertes proposées" value={proposedPenalty > 0 ? `-${formatFCFA(proposedPenalty)}` : '—'} detail={`${losses.length} pénalité(s) · validation RH`} tone="orange" /></div><div className="table-scroll"><table className="w-full text-left"><thead><tr className="table-head"><th>Heure prévue</th><th>Tâche</th><th>Responsable</th><th>Statut</th><th>Résultat</th><th>Montant proposé</th><th>Validation RH</th></tr></thead><tbody>{tasks.map((task) => <tr className="table-row table-line" key={task.id}><td><strong className="text-ink">{task.startTime}</strong><span className="block text-[10px] text-[#9aa59f]">→ {plannedEndTime(task.startTime, task.durationMinutes)} · {formatDuration(task.durationMinutes)}</span></td><td>{task.title}{task.type === 'Pause' && <span className="ml-1.5 rounded-full bg-[#fdf3e3] px-1.5 py-0.5 text-[8px] font-black uppercase text-[#bd7737]">Pause</span>}</td><td>{task.employeeId ? task.employeeName : task.position || '—'}</td><td><StatusBadge status={task.status} /></td><td>{task.status === 'Terminée' ? (task.outcome === 'onTime' ? <span className="font-bold text-[#4d8f51]">À temps</span> : <span className="font-bold text-[#c25d55]">En retard</span>) : <span className="text-[#9aa59f]">—</span>}</td><td className="font-bold">{task.status === 'Terminée' ? (task.outcome === 'onTime' ? <span className="text-[#4d8f51]">+{formatFCFA(task.bonusAmount)}</span> : <span className="text-[#c25d55]">-{formatFCFA(task.penaltyAmount)}</span>) : <span className="text-[#9aa59f]">—</span>}</td><td>{task.status === 'Terminée' ? <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide ${task.validation === 'pending' ? 'bg-[#f7f2fc] text-[#70578f]' : task.validation === 'approved' ? 'bg-[#e2f3dd] text-[#4d8f51]' : 'bg-[#eef0ee] text-[#8b9891]'}`}>{validationLabel(task)}</span> : <span className="text-[#9aa59f]">—</span>}</td></tr>)}</tbody></table></div></div>;
}

function SummaryBox({ icon: Icon, label, value, detail, tone }: { icon: typeof CheckCircle2; label: string; value: string; detail: string; tone: 'green' | 'blue' | 'orange' }) {
  const tones = { green: 'bg-[#edf8ea] text-[#5b9d5b]', blue: 'bg-[#eaf1fe] text-[#4f77b8]', orange: 'bg-[#fff3df] text-[#bd7737]' };
  return <div className="flex items-center gap-3 rounded-xl border border-[#edf0eb] p-3"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}><Icon size={16} /></span><div className="min-w-0"><p className="text-[10px] font-semibold text-[#8b9891]">{label}</p><p className="text-[13px] font-black text-ink">{value}</p><p className="truncate text-[9px] text-[#a2ada6]">{detail}</p></div></div>;
}
