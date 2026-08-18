'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, Check, CheckCircle2, ClipboardCheck, Clock3, Coffee, ListChecks, PauseCircle, Play, ShieldCheck, Timer } from 'lucide-react';
import { units } from '@/lib/data';
import { FARM_STORAGE_KEYS, readLocal, subscribeToFarmData, writeLocal } from '@/lib/farm-storage';
import { DEFAULT_HR_SETTINGS, type HRSettings } from '@/components/hr-settings-view';
import { Modal, SectionHeading, StatCard } from '@/components/ui';
import { StatusBadge } from '@/components/status-badge';
import { formatDate, formatFCFA } from '@/lib/format';
import { computeOutcome, ensureDayPlan, formatDuration, isoNow, minutesFromTime, plannedEndTime, startPunctuality, TASKS_TODAY, taskLabel, timeFromIso, type DailyTask, type TaskEmployee, type TaskTemplate, type TaskUnitId } from '@/lib/daily-tasks';

const unitConfig: Record<TaskUnitId, { href: string; dashboardHref: string; label: string }> = {
  poulets: { href: '/poulets/taches', dashboardHref: '/dashboard/poulets', label: 'Élevage de poulets bio' },
  chevrerie: { href: '/chevrerie/taches', dashboardHref: '/dashboard/chevrerie', label: 'Chèvrerie' },
  provenderie: { href: '/provenderie/taches', dashboardHref: '/dashboard/provenderie', label: 'Provenderie' },
  bio: { href: '/produits-bio/taches', dashboardHref: '/dashboard/bio', label: 'Produits bio' },
  pressoir: { href: '/pressoir/taches', dashboardHref: '/dashboard/pressoir', label: 'Pressoir à huile' },
  stocks: { href: '/stocks/taches', dashboardHref: '/dashboard/stocks', label: 'Magasin central' },
};

export function UnitTasksView({ unitId }: { unitId: TaskUnitId }) {
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [instances, setInstances] = useState<DailyTask[]>([]);
  const [employees, setEmployees] = useState<TaskEmployee[]>([]);
  const [settings, setSettings] = useState<HRSettings>(DEFAULT_HR_SETTINGS);
  const [date, setDate] = useState(TASKS_TODAY);
  const [hydrated, setHydrated] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [completing, setCompleting] = useState<DailyTask | null>(null);
  const [comment, setComment] = useState('');

  useEffect(() => {
    const load = () => {
      const savedTemplates = readLocal<Partial<TaskTemplate>[]>(FARM_STORAGE_KEYS.rhTaskTemplates, []);
      const savedInstances = readLocal<DailyTask[]>(FARM_STORAGE_KEYS.dailyTasks, []);
      setTemplates(savedTemplates as TaskTemplate[]);
      setEmployees(readLocal<TaskEmployee[]>(FARM_STORAGE_KEYS.rhEmployees, []));
      setSettings({ ...DEFAULT_HR_SETTINGS, ...readLocal<Partial<HRSettings>>(FARM_STORAGE_KEYS.rhSettings, {}) });
      setInstances(savedInstances);
      setHydrated(true);
    };
    load();
    return subscribeToFarmData([FARM_STORAGE_KEYS.rhTaskTemplates, FARM_STORAGE_KEYS.dailyTasks, FARM_STORAGE_KEYS.rhEmployees, FARM_STORAGE_KEYS.rhSettings], load);
  }, []);

  // Génération automatique du planning du jour (aucune action manuelle requise).
  useEffect(() => {
    if (!hydrated) return;
    setInstances((current) => {
      const next = ensureDayPlan(unitId, date, templates, current, employees);
      if (next !== current) writeLocal(FARM_STORAGE_KEYS.dailyTasks, next);
      return next;
    });
  }, [hydrated, unitId, date, templates, employees]);

  const dayTasks = useMemo(() => instances.filter((task) => task.unitId === unitId && task.date === date).sort((a, b) => minutesFromTime(a.startTime) - minutesFromTime(b.startTime)), [instances, unitId, date]);
  const done = dayTasks.filter((task) => task.status === 'Terminée');
  const onTime = done.filter((task) => task.outcome === 'onTime').length;
  const late = done.filter((task) => task.outcome === 'late').length;
  const inProgress = dayTasks.filter((task) => task.status === 'En cours').length;
  const pending = done.filter((task) => task.validation === 'pending').length;
  const unit = units.find((item) => item.id === unitId);
  const config = unitConfig[unitId];

  function notify(message: string) { setFeedback(message); window.setTimeout(() => setFeedback(''), 4000); }
  function startTask(task: DailyTask) {
    const next = instances.map((item) => item.id === task.id ? { ...item, status: 'En cours' as const, startedAt: isoNow() } : item);
    setInstances(next);
    writeLocal(FARM_STORAGE_KEYS.dailyTasks, next);
    notify(`« ${task.title} » démarrée à ${timeFromIso(isoNow())}.`);
  }
  function submitCompletion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!completing) return;
    const text = comment.trim();
    if (!text) return;
    const completedAt = isoNow();
    const updated: DailyTask = { ...completing, status: 'Terminée', completedAt, comment: text, outcome: computeOutcome({ ...completing, completedAt }), bonusAmount: 0, penaltyAmount: 0, validation: 'pending', validatedAt: null };
    const actual = updated.outcome === 'onTime' ? settings.taskBonusAmount : settings.taskPenaltyAmount;
    if (updated.outcome === 'onTime') updated.bonusAmount = actual;
    else updated.penaltyAmount = actual;
    const next = instances.map((item) => item.id === updated.id ? updated : item);
    setInstances(next);
    writeLocal(FARM_STORAGE_KEYS.dailyTasks, next);
    setCompleting(null);
    setComment('');
    notify(updated.outcome === 'onTime' ? `« ${updated.title} » terminée à temps · prime de ${formatFCFA(actual)} proposée.` : `« ${updated.title} » terminée en retard · pénalité de ${formatFCFA(actual)} proposée.`);
  }

  return <div className="fade-in space-y-7"><div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><Link href={config.dashboardHref} className="mb-4 inline-flex items-center gap-2 text-[11px] font-bold text-[#6c8176] hover:text-forest">← Retour au dashboard {unit?.shortLabel ?? unitId}</Link><p className="eyebrow mb-2">Unité · Tâches quotidiennes</p><h1 className="page-title">Planning du jour</h1><p className="muted mt-2 max-w-2xl text-[13px]">La journée complète de l’unité, générée automatiquement depuis le planning type établi par RH — pauses comprises, classée par heure.</p></div><div className="flex flex-wrap items-center gap-2"><label className="flex items-center gap-2 rounded-xl border border-[#e2e9e1] bg-white px-3 py-2 text-[11px] font-semibold text-[#66766d] shadow-[0_3px_12px_rgba(29,46,39,.035)]"><CalendarDays size={14} className="text-[#5b9d5b]" /> Jour <input type="date" className="input-base h-8 w-[130px] rounded-lg py-0 text-[11px]" value={date} onChange={(event) => setDate(event.target.value)} /></label><span className="rounded-xl bg-[#f7f2fc] px-3 py-2 text-[10px] font-bold text-[#70578f]">Prime {formatFCFA(settings.taskBonusAmount)} · Pénalité {formatFCFA(settings.taskPenaltyAmount)}</span></div></div>{feedback && <div className="flex items-center gap-2 rounded-xl border border-[#cde8c7] bg-[#effaeb] px-4 py-3 text-[12px] font-semibold text-[#4d8f51]"><Check size={14} />{feedback}</div>}<div className="flex items-start gap-3 rounded-xl border border-[#e2e9e1] bg-[#f7faf5] px-4 py-3 text-[11px] leading-5 text-[#5b8f60]"><ListChecks size={16} className="mt-0.5 shrink-0" /><span><strong>Planning automatique :</strong> les tâches du {formatDate(date)} sont générées depuis le planning type RH ({dayTasks.length} tâche(s), dont {dayTasks.filter((task) => task.type === 'Pause').length} pause(s)). Chaque tâche terminée à temps propose une prime, chaque tâche en retard une pénalité — sous validation RH.</span></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><StatCard label="À faire" value={String(dayTasks.filter((task) => task.status === 'À faire').length)} change="à démarrer" detail="planning du jour" icon={Clock3} tone="blue" /><StatCard label="En cours" value={String(inProgress)} change={inProgress ? 'travail en cours' : 'rien en cours'} detail={inProgress ? 'sur le terrain' : 'aucune tâche active'} icon={Timer} tone="orange" /><StatCard label="Terminées à temps" value={String(onTime)} change={onTime ? 'primes proposées' : 'aucune'} detail="durée réelle ≤ attendue" icon={CheckCircle2} tone="green" /><StatCard label="Terminées en retard" value={String(late)} change={late ? 'pénalités proposées' : 'aucune'} detail="durée réelle > attendue" icon={AlertTriangle} tone="orange" /><StatCard label="En attente RH" value={String(pending)} change={pending ? 'à valider' : 'à jour'} detail="validation RH" icon={ShieldCheck} tone="purple" /></div><div className="surface overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf0eb] px-5 py-5 sm:px-6"><SectionHeading eyebrow={`${formatDate(date)} · ordre chronologique`} title="Emploi du temps complet" description="De la première à la dernière tâche de la journée, pauses comprises." /><span className="text-[10px] font-bold text-[#6d8175]">{dayTasks.length} tâche(s)</span></div><div className="divide-y divide-[#eef1ec]">{dayTasks.length ? dayTasks.map((task) => <TaskRow key={task.id} task={task} onStart={startTask} onComplete={() => { setCompleting(task); setComment(''); }} />) : <div className="px-6 py-14 text-center"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eff8e9] text-[#5b9c52]"><Coffee size={22} /></span><h3 className="mt-4 text-[15px] font-bold text-ink">Aucune tâche pour ce jour</h3><p className="muted mx-auto mt-1 max-w-sm text-[13px] leading-5">Le planning type de cette unité est vide ou commence demain. Les tâches sont créées par RH dans <strong>RH & administration → Tâches quotidiennes</strong>.</p></div>}</div></div><Modal open={completing !== null} onClose={() => { setCompleting(null); setComment(''); }} title={`Terminer « ${completing?.title ?? ''} »`}><form onSubmit={submitCompletion} className="space-y-5">{completing && <div className="rounded-xl border border-[#edf0eb] bg-[#fafbf8] p-4 text-[11px] leading-5 text-[#66766d]"><p><strong className="text-ink">Heure prévue :</strong> {completing.startTime} → {plannedEndTime(completing.startTime, completing.durationMinutes)} · durée attendue {formatDuration(completing.durationMinutes)}</p><p className="mt-1"><strong className="text-ink">Démarrée à :</strong> {timeFromIso(completing.startedAt)} · Responsable : {taskLabel(completing)}</p><p className="mt-2 text-[10px] font-bold text-[#70578f]">Terminée à temps → prime de {formatFCFA(settings.taskBonusAmount)} proposée · Terminée en retard → pénalité de {formatFCFA(settings.taskPenaltyAmount)} proposée. Montant soumis à validation RH.</p></div>}<label className="block"><span className="field-label">Commentaire obligatoire</span><textarea className="input-base min-h-[110px] resize-none" value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Tout s’est bien passé, ou décrivez le problème rencontré..." required /></label><div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => { setCompleting(null); setComment(''); }}>Annuler</button><button type="submit" className="btn-primary"><Check size={15} /> Confirmer la fin de la tâche</button></div></form></Modal></div>;
}

function TaskRow({ task, onStart, onComplete }: { task: DailyTask; onStart: (task: DailyTask) => void; onComplete: (task: DailyTask) => void }) {
  const punctuality = startPunctuality(task);
  const isLate = task.outcome === 'late';
  const border = task.status === 'Terminée' ? (isLate ? 'border-l-[#d9706b] bg-[#fdf6f5]' : 'border-l-[#71bd76] bg-[#f6fbf4]') : 'border-l-[#d8e2d9]';
  return <div className={`flex flex-col gap-3 border-l-4 px-5 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between ${border}`}>
    <div className="flex min-w-0 items-start gap-3">
      <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${task.type === 'Pause' ? 'bg-[#fdf3e3] text-[#bd7737]' : 'bg-[#edf8ea] text-[#5c9d5a]'}`}>{task.type === 'Pause' ? <PauseCircle size={17} /> : <ClipboardCheck size={17} />}</span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2"><p className="text-[13px] font-bold text-ink">{task.title}</p>{task.type === 'Pause' && <span className="rounded-full bg-[#fdf3e3] px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-[#bd7737]">Pause</span>}<StatusBadge status={task.status} />{task.status === 'Terminée' && <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide ${isLate ? 'bg-[#f8e2df] text-[#c25d55]' : 'bg-[#e2f3dd] text-[#4d8f51]'}`}>{isLate ? 'En retard' : 'À temps'}</span>}</div>
        <p className="mt-1 text-[11px] text-[#718078]"><strong className="text-ink">{task.startTime}</strong> → {plannedEndTime(task.startTime, task.durationMinutes)} · {formatDuration(task.durationMinutes)} · {task.employeeId ? task.employeeName : task.position || 'Poste à définir'}</p>
        {task.status === 'En cours' && task.startedAt && <p className="mt-1 text-[10px] font-semibold text-[#bd7737]">Démarrée à {timeFromIso(task.startedAt)}{punctuality === 'early' ? ' · en avance sur le planning' : punctuality === 'late' ? ' · en retard sur le planning' : ' · à l’heure sur le planning'}</p>}
        {task.status === 'Terminée' && <p className="mt-1 text-[10px] leading-4 text-[#66766d]">{task.comment || 'Aucun commentaire.'}</p>}
      </div>
    </div>
    <div className="flex shrink-0 flex-col items-start gap-2 lg:items-end">
      {task.status === 'À faire' && <button className="btn-primary px-3 py-1.5 text-[11px]" onClick={() => onStart(task)}><Play size={13} /> Démarrer</button>}
      {task.status === 'En cours' && <button className="btn-primary px-3 py-1.5 text-[11px]" onClick={() => onComplete(task)}><Check size={13} /> Terminer</button>}
      {task.status === 'Terminée' && <div className="flex flex-col items-start gap-1 lg:items-end">{task.outcome === 'onTime' ? <span className="text-[11px] font-black text-[#4d8f51]">+{formatFCFA(task.bonusAmount)}</span> : <span className="text-[11px] font-black text-[#c25d55]">-{formatFCFA(task.penaltyAmount)}</span>}<TaskValidationBadge task={task} /></div>}
    </div>
  </div>;
}

function TaskValidationBadge({ task }: { task: DailyTask }) {
  if (task.validation === 'approved') return <span className="rounded-full bg-[#e2f3dd] px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-[#4d8f51]">Validée RH{task.validationComment ? ' · ' + task.validationComment : ''}</span>;
  if (task.validation === 'rejected') return <span className="rounded-full bg-[#eef0ee] px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-[#8b9891]" title={task.validationComment}>Rejetée RH</span>;
  return <span className="rounded-full bg-[#f7f2fc] px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-[#70578f]">En attente de validation RH</span>;
}
