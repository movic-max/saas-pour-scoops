import type { UnitId } from '@/lib/data';

/**
 * Module « Tâches quotidiennes » — SCOOPS LE REVEIL.
 *
 * Le planning type est défini par RH (TaskTemplate) et se répète chaque jour :
 * à chaque chargement du planning d'une unité pour une date, les instances du
 * jour (DailyTask) sont générées automatiquement, sans action manuelle.
 */

/** Date de référence de la démo (identique à BUSINESS_DATE du module RH). */
export const TASKS_TODAY = '2026-08-13';

export type TaskUnitId = Exclude<UnitId, 'rh'>;
export const TASK_UNITS: TaskUnitId[] = ['poulets', 'chevrerie', 'provenderie', 'bio', 'pressoir', 'stocks'];

export type TaskKind = 'Tâche' | 'Pause';
export type TaskStatus = 'À faire' | 'En cours' | 'Terminée';
export type TaskValidation = 'pending' | 'approved' | 'rejected';
export type TaskOutcome = 'onTime' | 'late';

/** Planning type créé par RH. Stable : il se répète chaque jour, sans recréation. */
export type TaskTemplate = {
  id: string;
  unitId: TaskUnitId;
  title: string;
  type: TaskKind;
  /** Heure de début prévue, format "HH:MM" (ex. "06:00"). */
  startTime: string;
  /** Durée attendue en minutes (ex. 45). */
  durationMinutes: number;
  /** Salarié responsable ; vide si la tâche est liée à un poste uniquement. */
  employeeId: string;
  /** Poste responsable, utilisé quand aucun salarié n'est attribué. */
  position: string;
  active: boolean;
  /** Date à partir de laquelle la tâche type apparaît (créée → lendemain). */
  effectiveFrom: string;
  createdAt: string;
};

/** Instance d'une tâche pour une date précise (planning du jour). */
export type DailyTask = {
  id: string;
  date: string;
  templateId: string;
  unitId: TaskUnitId;
  title: string;
  type: TaskKind;
  startTime: string;
  durationMinutes: number;
  employeeId: string;
  employeeName: string;
  position: string;
  status: TaskStatus;
  /** Horodatage ISO réel du démarrage, null tant que non démarrée. */
  startedAt: string | null;
  /** Horodatage ISO réel de fin, null tant que non terminée. */
  completedAt: string | null;
  /** Commentaire obligatoire saisi par le responsable à la fin de la tâche. */
  comment: string;
  /** Résultat comparé : à temps ou en retard (durée réelle vs durée attendue). */
  outcome: TaskOutcome | null;
  /** Prime proposée (terminée à temps), soumise à validation RH. */
  bonusAmount: number;
  /** Pénalité proposée (terminée en retard), soumise à validation RH. */
  penaltyAmount: number;
  /** 'pending' dès la fin de la tâche ; seul RH peut approuver ou rejeter. */
  validation: TaskValidation;
  validationComment: string;
  validatedAt: string | null;
};

export type TaskEmployee = { id: string; name: string; unitId: string; position: string; status: string };

export function isoNow(): string {
  return new Date().toISOString();
}

export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + days));
  return value.toISOString().slice(0, 10);
}

export function minutesFromTime(value: string): number {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return 0;
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

export function timeFromMinutes(total: number): string {
  const wrapped = ((total % 1440) + 1440) % 1440;
  const hours = Math.floor(wrapped / 60);
  const minutes = wrapped % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** Fin prévue = heure de début + durée attendue. */
export function plannedEndTime(startTime: string, durationMinutes: number): string {
  return timeFromMinutes(minutesFromTime(startTime) + Math.max(durationMinutes, 0));
}

/** Heure "HH:MM" d'un horodatage ISO (UTC, cohérent avec la démo). */
export function timeFromIso(iso: string | null | undefined): string {
  if (!iso) return '—';
  return iso.slice(11, 16);
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, '0')}`;
}

/** Durée réellement prise (startedAt → completedAt), en minutes. */
export function actualDurationMinutes(task: DailyTask): number | null {
  if (!task.startedAt || !task.completedAt) return null;
  return Math.round((Date.parse(task.completedAt) - Date.parse(task.startedAt)) / 60000);
}

/** Résultat : à temps si la durée réelle ≤ durée attendue, sinon en retard. */
export function computeOutcome(task: DailyTask): TaskOutcome | null {
  const actual = actualDurationMinutes(task);
  if (actual === null) return null;
  return actual <= Math.max(task.durationMinutes, 0) ? 'onTime' : 'late';
}

/** Ponctualité du démarrage (affichage informatif) : en avance / à l'heure / en retard. */
export function startPunctuality(task: DailyTask): 'early' | 'ontime' | 'late' | null {
  if (!task.startedAt) return null;
  const diff = minutesFromTime(timeFromIso(task.startedAt)) - minutesFromTime(task.startTime);
  if (diff < 0) return 'early';
  if (diff > 0) return 'late';
  return 'ontime';
}

export function taskLabel(task: DailyTask): string {
  return task.employeeId ? task.employeeName || task.position || 'Salarié' : task.position || 'Poste à définir';
}

/**
 * Génère (ou complète) le planning du jour d'une unité à partir du planning
 * type. Idempotent : aucune instance en double. Les tâches types créées par RH
 * ne s'appliquent qu'à partir du lendemain (effectiveFrom).
 */
export function ensureDayPlan(unitId: TaskUnitId, date: string, templates: TaskTemplate[], instances: DailyTask[], employees: TaskEmployee[]): DailyTask[] {
  const existing = new Set(instances.filter((instance) => instance.date === date && instance.unitId === unitId).map((instance) => instance.templateId));
  const created: DailyTask[] = [];
  const employeeName = (employeeId: string, position: string) => employees.find((employee) => employee.id === employeeId)?.name ?? position;
  templates
    .filter((template) => template.unitId === unitId && template.active && template.effectiveFrom <= date)
    .sort((a, b) => minutesFromTime(a.startTime) - minutesFromTime(b.startTime))
    .forEach((template) => {
      if (existing.has(template.id)) return;
      created.push({
        id: `TACHE-${date}-${template.id}`,
        date,
        templateId: template.id,
        unitId,
        title: template.title,
        type: template.type,
        startTime: template.startTime,
        durationMinutes: template.durationMinutes,
        employeeId: template.employeeId,
        employeeName: employeeName(template.employeeId, template.position),
        position: template.position,
        status: 'À faire',
        startedAt: null,
        completedAt: null,
        comment: '',
        outcome: null,
        bonusAmount: 0,
        penaltyAmount: 0,
        validation: 'pending',
        validationComment: '',
        validatedAt: null,
      });
    });
  if (created.length === 0) return instances;
  return [...instances, ...created];
}
