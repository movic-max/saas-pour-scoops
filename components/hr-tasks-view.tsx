'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Check, CheckCircle2, ClipboardCheck, Clock3, Coffee, ListChecks, PauseCircle, Pencil, Plus, ShieldCheck, Timer, Trash2, UserCheck, Users, XCircle } from 'lucide-react';
import { units } from '@/lib/data';
import { FARM_STORAGE_KEYS, readLocal, subscribeToFarmData, writeLocal } from '@/lib/farm-storage';
import { Modal, SectionHeading, StatCard } from '@/components/ui';
import { StatusBadge } from '@/components/status-badge';
import { formatDate, formatFCFA } from '@/lib/format';
import { addDays, ensureDayPlan, formatDuration, isoNow, minutesFromTime, plannedEndTime, TASKS_TODAY, timeFromIso, type DailyTask, type TaskEmployee, type TaskKind, type TaskTemplate, type TaskUnitId, TASK_UNITS } from '@/lib/daily-tasks';

const unitLabels: Record<TaskUnitId, string> = { poulets: 'Poulets bio', chevrerie: 'Chèvrerie', provenderie: 'Provenderie', bio: 'Produits bio', pressoir: 'Pressoir', stocks: 'Magasin central' };
const chip = (active: boolean) => `inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold transition ${active ? 'border-forest bg-forest text-white' : 'border-[#dfe8df] bg-white text-[#5f7568] hover:border-[#bcd7bb]'}`;

export function HRTasksView({ section }: { section: 'templates' | 'validation' }) {
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [instances, setInstances] = useState<DailyTask[]>([]);
  const [employees, setEmployees] = useState<TaskEmployee[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [selectedUnit, setSelectedUnit] = useState<TaskUnitId>('poulets');
  const [editing, setEditing] = useState<TaskTemplate | null>(null);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateUnit, setTemplateUnit] = useState<TaskUnitId>('poulets');
  const [rejecting, setRejecting] = useState<DailyTask | null>(null);
  const [rejectComment, setRejectComment] = useState('');

  useEffect(() => {
    const load = () => {
      setTemplates(readLocal<TaskTemplate[]>(FARM_STORAGE_KEYS.rhTaskTemplates, []));
      setInstances(readLocal<DailyTask[]>(FARM_STORAGE_KEYS.dailyTasks, []));
      setEmployees(readLocal<TaskEmployee[]>(FARM_STORAGE_KEYS.rhEmployees, []));
      setHydrated(true);
    };
    load();
    return subscribeToFarmData([FARM_STORAGE_KEYS.rhTaskTemplates, FARM_STORAGE_KEYS.dailyTasks, FARM_STORAGE_KEYS.rhEmployees], load);
  }, []);

  // La vue en direct garantit aussi le planning du jour de chaque unité.
  useEffect(() => {
    if (!hydrated || section !== 'validation') return;
    setInstances((current) => {
      let next = current;
      TASK_UNITS.forEach((unitId) => {
        const generated = ensureDayPlan(unitId, TASKS_TODAY, templates, next, employees);
        if (generated !== next) next = generated;
      });
      if (next !== current) writeLocal(FARM_STORAGE_KEYS.dailyTasks, next);
      return next;
    });
  }, [hydrated, section, templates, employees]);

  function notify(message: string) { setFeedback(message); window.setTimeout(() => setFeedback(''), 4000); }
  function saveTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get('title') ?? '').trim();
    const startTime = String(form.get('startTime') ?? '08:00');
    const durationMinutes = Math.max(Number(form.get('durationMinutes') ?? 30), 0);
    if (!title || !startTime) return;
    const type = String(form.get('type') ?? 'Tâche') as TaskKind;
    const assignee = String(form.get('assignee') ?? '');
    const position = String(form.get('position') ?? '').trim();
    const unitId = String(form.get('unitId') ?? templateUnit) as TaskUnitId;
    const existing = editing ?? { id: `TPL-${Date.now()}`, createdAt: isoNow(), effectiveFrom: addDays(TASKS_TODAY, 1) };
    const template: TaskTemplate = {
      ...existing,
      unitId,
      title,
      type,
      startTime,
      durationMinutes,
      employeeId: assignee.startsWith('EMP-') ? assignee : '',
      position: assignee.startsWith('EMP-') ? (position || 'Poste à définir') : (position || 'Poste à définir'),
      active: true,
    };
    const next = editing ? templates.map((item) => item.id === editing.id ? template : item) : [template, ...templates];
    setTemplates(next);
    writeLocal(FARM_STORAGE_KEYS.rhTaskTemplates, next);
    setTemplateOpen(false);
    setEditing(null);
    notify(editing ? `La tâche « ${template.title} » a été modifiée.` : `La tâche « ${template.title} » sera visible dans le planning de l'unité à partir de demain.`);
  }
  function toggleTemplate(template: TaskTemplate) {
    const next = templates.map((item) => item.id === template.id ? { ...item, active: !item.active } : item);
    setTemplates(next);
    writeLocal(FARM_STORAGE_KEYS.rhTaskTemplates, next);
    notify(template.active ? `« ${template.title} » désactivée du planning type.` : `« ${template.title} » réactivée dans le planning type.`);
  }
  function deleteTemplate(template: TaskTemplate) {
    if (!window.confirm(`Supprimer la tâche type « ${template.title} » ? Les plannings déjà générés sont conservés.`)) return;
    const next = templates.filter((item) => item.id !== template.id);
    setTemplates(next);
    writeLocal(FARM_STORAGE_KEYS.rhTaskTemplates, next);
    notify(`La tâche type « ${template.title} » a été supprimée.`);
  }
  function decide(task: DailyTask, decision: 'approved' | 'rejected') {
    const next = instances.map((item) => item.id === task.id ? { ...item, validation: decision, validationComment: decision === 'rejected' ? rejectComment.trim() : '', validatedAt: isoNow() } : item);
    setInstances(next);
    writeLocal(FARM_STORAGE_KEYS.dailyTasks, next);
    setRejecting(null);
    setRejectComment('');
    notify(decision === 'approved'
      ? task.outcome === 'onTime'
        ? `Prime de ${formatFCFA(task.bonusAmount)} confirmée pour ${task.employeeName || task.position}.`
        : `Pénalité de ${formatFCFA(task.penaltyAmount)} confirmée pour ${task.employeeName || task.position}.`
      : `Gain/perte annulé pour « ${task.title} ».`);
  }

  return <div className="fade-in space-y-7"><Header section={section} /><div className="flex items-start gap-3 rounded-xl border border-[#e2d9f0] bg-[#f7f2fc] px-4 py-3 text-[11px] leading-5 text-[#70578f]"><ShieldCheck size={16} className="mt-0.5 shrink-0" />{section === 'templates'
    ? <span><strong>Planning type :</strong> RH définit ici les tâches de chaque unité (heure de début, durée, responsable, pauses incluses). Le planning se répète automatiquement chaque jour — une tâche créée aujourd’hui s’applique à partir de demain. Les responsables n’ont rien à configurer.</span>
    : <span><strong>RH a le dernier mot :</strong> tant qu’une tâche terminée n’est pas validée, son gain ou sa perte ne sont jamais intégrés au bulletin de paie. La vue en direct montre qui travaille, sur quelle tâche et depuis quelle heure.</span>}</div>{feedback && <div className="flex items-center gap-2 rounded-xl border border-[#cde8c7] bg-[#effaeb] px-4 py-3 text-[12px] font-semibold text-[#4d8f51]"><Check size={14} />{feedback}</div>}{section === 'templates'
    ? <TemplatesSection templates={templates} employees={employees} selectedUnit={selectedUnit} setSelectedUnit={setSelectedUnit} onNew={() => { setEditing(null); setTemplateUnit(selectedUnit); setTemplateOpen(true); }} onEdit={(template) => { setEditing(template); setTemplateUnit(template.unitId); setTemplateOpen(true); }} onToggle={toggleTemplate} onDelete={deleteTemplate} />
    : <ValidationSection today={instances.filter((task) => task.date === TASKS_TODAY)} rejecting={rejecting} rejectComment={rejectComment} setRejectComment={setRejectComment} onReject={(task) => { setRejecting(task); setRejectComment(''); }} onCancelReject={() => { setRejecting(null); setRejectComment(''); }} onDecide={decide} />}
    <Modal open={templateOpen} onClose={() => { setTemplateOpen(false); setEditing(null); }} title={editing ? 'Modifier la tâche type' : 'Nouvelle tâche type'}><form onSubmit={saveTemplate} className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="field-label">Unité</span><select name="unitId" className="input-base" value={templateUnit} onChange={(event) => setTemplateUnit(event.target.value as TaskUnitId)}>{TASK_UNITS.map((unitId) => <option key={unitId} value={unitId}>{unitLabels[unitId]}</option>)}</select></label><label className="block"><span className="field-label">Type</span><select name="type" className="input-base" defaultValue={editing?.type ?? 'Tâche'}><option>Tâche</option><option>Pause</option></select></label><label className="block sm:col-span-2"><span className="field-label">Titre de la tâche</span><input name="title" className="input-base" defaultValue={editing?.title ?? ''} placeholder="Ex. Nettoyage des bâtiments, Distribution de l’aliment..." required /></label><label className="block"><span className="field-label">Heure de début prévue</span><div className="relative"><Clock3 size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#87958d]" /><input name="startTime" type="time" className="input-base pl-9" defaultValue={editing?.startTime ?? '06:00'} required /></div></label><label className="block"><span className="field-label">Durée attendue (minutes)</span><input name="durationMinutes" type="number" min="0" step="5" className="input-base" defaultValue={editing?.durationMinutes ?? 45} required /><p className="mt-1 text-[10px] text-[#89968f]">Fin prévue calculée automatiquement.</p></label><label className="block sm:col-span-2"><span className="field-label">Responsable</span><select name="assignee" className="input-base" defaultValue={editing?.employeeId || ''}><option value="">Poste (sans salarié désigné)</option>{employees.filter((employee) => employee.unitId === templateUnit && employee.status === 'Actif').map((employee) => <option key={employee.id} value={employee.id}>{employee.name} · {employee.position}</option>)}</select></label><label className="block sm:col-span-2"><span className="field-label">Poste / remplaçant</span><input name="position" className="input-base" defaultValue={editing?.position ?? ''} placeholder="Ex. Éleveur, Magasinier, Toute l'équipe..." /></label></div><p className="rounded-xl border border-[#e2d9f0] bg-[#f7f2fc] px-3 py-2.5 text-[10px] leading-4 text-[#70578f]">La tâche type se répète chaque jour à partir du lendemain de sa création. Elle apparaît automatiquement dans le planning de l’unité.</p><div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => { setTemplateOpen(false); setEditing(null); }}>Annuler</button><button type="submit" className="btn-primary"><Check size={15} /> {editing ? 'Enregistrer les modifications' : 'Créer la tâche type'}</button></div></form></Modal></div>;
}

function TemplatesSection({ templates, employees, selectedUnit, setSelectedUnit, onNew, onEdit, onToggle, onDelete }: {
  templates: TaskTemplate[]; employees: TaskEmployee[]; selectedUnit: TaskUnitId; setSelectedUnit: (unit: TaskUnitId) => void;
  onNew: () => void; onEdit: (template: TaskTemplate) => void; onToggle: (template: TaskTemplate) => void; onDelete: (template: TaskTemplate) => void;
}) {
  const unitTemplates = templates.filter((template) => template.unitId === selectedUnit).sort((a, b) => minutesFromTime(a.startTime) - minutesFromTime(b.startTime));
  return <><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2">{TASK_UNITS.map((unitId) => <button key={unitId} className={selectedUnit === unitId ? 'btn-primary' : 'btn-secondary'} onClick={() => setSelectedUnit(unitId)}>{unitLabels[unitId]}</button>)}</div><button className="btn-primary" onClick={onNew}><Plus size={15} /> Nouvelle tâche type</button></div><div className="surface overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf0eb] px-5 py-5 sm:px-6"><SectionHeading eyebrow={`Planning type · ${unitLabels[selectedUnit]}`} title="Emploi du temps type de l’unité" description="Ordre chronologique, pauses comprises. Les tâches inactives sont ignorées du planning du jour." /><span className="text-[10px] font-bold text-[#6d8175]">{unitTemplates.length} tâche(s)</span></div><div className="divide-y divide-[#eef1ec]">{unitTemplates.length ? unitTemplates.map((template) => <div key={template.id} className={`flex flex-col gap-3 px-5 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between ${template.active ? '' : 'opacity-45'}`}><div className="flex min-w-0 items-start gap-3"><span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${template.type === 'Pause' ? 'bg-[#fdf3e3] text-[#bd7737]' : 'bg-[#edf8ea] text-[#5c9d5a]'}`}>{template.type === 'Pause' ? <PauseCircle size={17} /> : <ClipboardCheck size={17} />}</span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-[13px] font-bold text-ink">{template.title}</p>{template.type === 'Pause' && <span className="rounded-full bg-[#fdf3e3] px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-[#bd7737]">Pause</span>}<StatusBadge status={template.active ? 'Actif' : 'Inactif'} /></div><p className="mt-1 text-[11px] text-[#718078]"><strong className="text-ink">{template.startTime}</strong> → {plannedEndTime(template.startTime, template.durationMinutes)} · {formatDuration(template.durationMinutes)} · {template.employeeId ? employees.find((employee) => employee.id === template.employeeId)?.name ?? template.employeeId : template.position}</p><p className="mt-1 text-[10px] text-[#89968f]">Appliquée depuis le {formatDate(template.effectiveFrom)}</p></div></div><div className="flex shrink-0 items-center gap-1"><button className="btn-secondary px-2.5 py-1.5 text-[10px]" onClick={() => onToggle(template)}>{template.active ? 'Désactiver' : 'Réactiver'}</button><button className="icon-btn h-8 w-8" onClick={() => onEdit(template)} aria-label="Modifier"><Pencil size={14} /></button><button className="icon-btn h-8 w-8 text-[#b45d5d]" onClick={() => onDelete(template)} aria-label="Supprimer"><Trash2 size={14} /></button></div></div>) : <div className="px-6 py-14 text-center"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eff8e9] text-[#5b9c52]"><Coffee size={22} /></span><h3 className="mt-4 text-[15px] font-bold text-ink">Aucune tâche type pour cette unité</h3><p className="muted mx-auto mt-1 max-w-sm text-[13px] leading-5">Créez la première tâche du planning type de {unitLabels[selectedUnit].toLowerCase()} (ex. « Nettoyage des bâtiments » à 06h00, « Pause » à 10h00...).</p></div>}</div></div></>;
}

function ValidationSection({ today, rejecting, rejectComment, setRejectComment, onReject, onCancelReject, onDecide }: {
  today: DailyTask[]; rejecting: DailyTask | null; rejectComment: string; setRejectComment: (value: string) => void;
  onReject: (task: DailyTask) => void; onCancelReject: () => void; onDecide: (task: DailyTask, decision: 'approved' | 'rejected') => void;
}) {
  const liveByEmployee = useMemo(() => {
    const groups = new Map<string, { employeeId: string; employeeName: string; position: string; unitId: string; tasks: DailyTask[] }>();
    today.forEach((task) => {
      const key = task.employeeId || `poste-${task.unitId}-${task.position}`;
      const current = groups.get(key) ?? { employeeId: task.employeeId, employeeName: task.employeeId ? task.employeeName : task.position, position: task.position, unitId: task.unitId, tasks: [] };
      current.tasks.push(task);
      groups.set(key, current);
    });
    return Array.from(groups.values()).sort((a, b) => a.employeeName.localeCompare(b.employeeName));
  }, [today]);
  const workingNow = today.filter((task) => task.status === 'En cours');
  const pending = today.filter((task) => task.status === 'Terminée' && task.validation === 'pending');
  const decided = today.filter((task) => task.status === 'Terminée' && task.validation !== 'pending');
  const unitOf = (task: DailyTask) => units.find((unit) => unit.id === task.unitId)?.shortLabel ?? task.unitId;
  return <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Tâches du jour" value={String(today.length)} change="toutes unités" detail={`${formatDate(TASKS_TODAY)}`} icon={ListChecks} tone="blue" /><StatCard label="En cours maintenant" value={String(workingNow.length)} change={workingNow.length ? 'équipe au travail' : 'rien en cours'} detail="vue en direct" icon={Timer} tone="orange" /><StatCard label="En attente de validation" value={String(pending.length)} change={pending.length ? 'à traiter' : 'file vide'} detail="gains et pertes proposés" icon={UserCheck} tone="purple" /><StatCard label="Déjà tranchées" value={String(decided.length)} change={`${decided.filter((task) => task.validation === 'approved').length} validée(s)`} detail="aujourd’hui" icon={CheckCircle2} tone="green" /></div><div className="surface overflow-hidden"><div className="flex items-center justify-between border-b border-[#edf0eb] px-5 py-5 sm:px-6"><SectionHeading eyebrow="Vue en direct · toutes unités" title="Qui fait quoi maintenant ?" description="Planning du jour de chaque responsable, mis à jour en temps réel." /><span className="text-[10px] font-bold text-[#6d8175]">{liveByEmployee.length} responsable(s)</span></div><div className="divide-y divide-[#eef1ec]">{liveByEmployee.length ? liveByEmployee.map((group) => <div key={`${group.employeeId}-${group.unitId}-${group.position}`} className="px-5 py-4 sm:px-6"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#f7f2fc] text-[#70578f]"><Users size={15} /></span><p className="text-[12px] font-bold text-ink">{group.employeeName}</p>{!group.employeeId && <span className="rounded-full bg-[#eef0ee] px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-[#8b9891]">Poste</span>}<span className="text-[10px] font-semibold text-[#8b9891]">{unitOf(group.tasks[0])}</span></div><span className="text-[10px] font-semibold text-[#8b9891]">{group.tasks.filter((task) => task.status === 'Terminée').length}/{group.tasks.length} terminée(s)</span></div><div className="mt-3 space-y-1.5">{group.tasks.map((task) => <div key={task.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-[#edf0eb] px-3 py-2 text-[11px]"><StatusBadge status={task.status} /><span className="font-semibold text-ink">{task.startTime} · {task.title}</span>{task.type === 'Pause' && <span className="rounded-full bg-[#fdf3e3] px-1.5 py-0.5 text-[8px] font-black uppercase text-[#bd7737]">Pause</span>}{task.status === 'En cours' && task.startedAt && <span className="font-bold text-[#bd7737]">depuis {timeFromIso(task.startedAt)}</span>}{task.status === 'Terminée' && <span className={task.outcome === 'onTime' ? 'font-bold text-[#4d8f51]' : 'font-bold text-[#c25d55]'}>{task.outcome === 'onTime' ? '+' : '-'}{formatFCFA(task.outcome === 'onTime' ? task.bonusAmount : task.penaltyAmount)} · {task.validation === 'pending' ? 'à valider' : task.validation === 'approved' ? 'validée' : 'rejetée'}</span>}</div>)}</div></div>) : <div className="px-6 py-12 text-center text-[11px] text-[#89968f]">Aucune tâche générée aujourd’hui. Créez un planning type dans l’onglet « Planning type ».</div>}</div></div><div className="surface overflow-hidden"><div className="flex items-center justify-between border-b border-[#edf0eb] px-5 py-5 sm:px-6"><SectionHeading eyebrow="File de validation" title="Tâches terminées en attente de validation" description="RH confirme le gain ou la perte proposé, ou l’annule avec son commentaire." /><span className="text-[10px] font-bold text-[#6d8175]">{pending.length} à traiter</span></div><div className="divide-y divide-[#eef1ec]">{pending.length ? pending.map((task) => <div key={task.id} className="px-5 py-4 sm:px-6"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-[13px] font-bold text-ink">{task.title}</p><StatusBadge status={task.outcome === 'onTime' ? 'Terminé' : 'En retard'} /></div><p className="mt-1 text-[11px] text-[#718078]"><strong className="text-ink">{task.employeeName || task.position}</strong> · {unitOf(task)} · prévu {task.startTime} → {plannedEndTime(task.startTime, task.durationMinutes)} · réel {timeFromIso(task.startedAt)} → {timeFromIso(task.completedAt)} · durée réelle {task.startedAt && task.completedAt ? formatDuration(Math.round((Date.parse(task.completedAt) - Date.parse(task.startedAt)) / 60000)) : '—'} vs attendue {formatDuration(task.durationMinutes)}</p><p className="mt-1 rounded-lg bg-[#fafbf8] px-2.5 py-1.5 text-[11px] italic leading-4 text-[#66766d]">« {task.comment || 'Aucun commentaire'} »</p></div><div className="flex shrink-0 flex-col items-end gap-2"><span className={`text-[13px] font-black ${task.outcome === 'onTime' ? 'text-[#4d8f51]' : 'text-[#c25d55]'}`}>{task.outcome === 'onTime' ? `+${formatFCFA(task.bonusAmount)}` : `-${formatFCFA(task.penaltyAmount)}`}</span><div className="flex flex-wrap justify-end gap-1.5">{rejecting?.id === task.id ? <div className="flex w-full flex-col gap-2 sm:w-[320px]"><input className="input-base h-9 text-[11px]" value={rejectComment} onChange={(event) => setRejectComment(event.target.value)} placeholder="Motif du rejet (ex. commentaire valable, prime non méritée)..." /><div className="flex justify-end gap-1.5"><button className="btn-secondary px-2.5 py-1.5 text-[10px]" onClick={onCancelReject}>Annuler</button><button className="btn-primary px-2.5 py-1.5 text-[10px]" onClick={() => onDecide(task, 'rejected')} disabled={!rejectComment.trim()}><XCircle size={13} /> Confirmer le rejet</button></div></div> : <><button className="btn-primary px-2.5 py-1.5 text-[10px]" onClick={() => onDecide(task, 'approved')}>{task.outcome === 'onTime' ? 'Valider le gain' : 'Valider la perte'}</button><button className="btn-secondary px-2.5 py-1.5 text-[10px]" onClick={() => onReject(task)}>Rejeter</button></>}</div></div></div></div>) : <div className="px-6 py-12 text-center text-[11px] text-[#89968f]">Aucune tâche en attente : la file de validation est vide.</div>}</div></div>{decided.length > 0 && <div className="surface overflow-hidden"><div className="border-b border-[#edf0eb] px-5 py-5 sm:px-6"><SectionHeading eyebrow="Aujourd’hui" title="Gains et pertes tranchés" description="Décisions RH enregistrées sur la journée." /></div><div className="table-scroll"><table className="w-full text-left"><thead><tr className="table-head"><th>Salarié</th><th>Unité</th><th>Tâche</th><th>Résultat</th><th>Montant</th><th>Décision</th><th>Commentaire RH</th></tr></thead><tbody>{decided.map((task) => <tr className="table-row table-line" key={task.id}><td className="font-bold text-ink">{task.employeeName || task.position}</td><td>{unitOf(task)}</td><td>{task.title}</td><td>{task.outcome === 'onTime' ? 'À temps' : 'En retard'}</td><td className={task.outcome === 'onTime' ? 'font-bold text-[#4d8f51]' : 'font-bold text-[#c25d55]'}>{task.outcome === 'onTime' ? `+${formatFCFA(task.bonusAmount)}` : `-${formatFCFA(task.penaltyAmount)}`}</td><td>{task.validation === 'approved' ? <StatusBadge status="Validé" /> : <StatusBadge status="Rejetée" />}</td><td className="text-[11px] text-[#66766d]">{task.validationComment || '—'}</td></tr>)}</tbody></table></div></div>}</>;
}

function Header({ section }: { section: 'templates' | 'validation' }) {
  const title = section === 'templates' ? 'Tâches quotidiennes — planning type' : 'Tâches quotidiennes — suivi & validation';
  const description = section === 'templates' ? 'Créez et gérez le planning type des six unités : chaque tâche a une heure de début, une durée, un responsable, et la pause fait partie du planning.' : 'Suivez en direct l’activité de chaque unité et validez — ou rejetez — les gains et pertes proposés avant intégration à la paie.';
  return <div><Link href="/dashboard/rh" className="mb-4 inline-flex items-center gap-2 text-[11px] font-bold text-[#6c8176] hover:text-forest">← Retour au dashboard RH</Link><div className="flex flex-wrap items-center gap-2"><Link href="/rh/taches" className={chip(section === 'templates')}><ClipboardCheck size={13} /> Planning type</Link><Link href="/rh/suivi-taches" className={chip(section === 'validation')}><UserCheck size={13} /> Suivi & validation</Link></div><p className="eyebrow mb-2 mt-4">Unité · RH & administration</p><h1 className="page-title">{title}</h1><p className="muted mt-2 max-w-2xl text-[13px]">{description}</p></div>;
}
