'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, KeyRound, MoreHorizontal, Search, ShieldCheck, UserPlus, Users, UserRound, UserRoundX } from 'lucide-react';
import { units, type UnitId } from '@/lib/data';
import { accessOptionsForUnits, normalizeUserPermissions, unitIdsFromUser, unitLabelsFromIds } from '@/lib/user-access';
import { FARM_STORAGE_KEYS, readLocal, writeLocal } from '@/lib/farm-storage';
import { Modal, SectionHeading, StatCard } from '@/components/ui';

type ManagedUser = {
  id: string;
  initials: string;
  name: string;
  identifier: string;
  role: string;
  /** Legacy display field; authorization uses only allowedUnits. */
  unit?: string;
  allowedUnits: string[];
  passwordSet: boolean;
  status: 'Actif' | 'Invité' | 'Suspendu';
  access: string[];
};

const defaultRoles = ['Administratrice', 'PDG', 'DG', 'Responsable unité', 'Magasinier', 'Caissier', 'Commercial', 'Lecteur'];

export function UsersAdminView({ unitId }: { unitId?: UnitId }) {
  const scopedUnits = useMemo(() => unitId ? units.filter((unit) => unit.id === unitId) : units, [unitId]);
  const [allUsers, setAllUsers] = useState<ManagedUser[]>([]);
  const [roles, setRoles] = useState<string[]>(defaultRoles);
  const [hydrated, setHydrated] = useState(false);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [menuUserId, setMenuUserId] = useState<string | null>(null);
  const [detailUser, setDetailUser] = useState<ManagedUser | null>(null);
  const [allowedUnits, setAllowedUnits] = useState<UnitId[]>([]);
  const [selectedAccess, setSelectedAccess] = useState<string[]>([]);

  const accessOptions = useMemo(() => accessOptionsForUnits(allowedUnits), [allowedUnits]);

  useEffect(() => {
    const localUsers = readLocal<ManagedUser[]>(FARM_STORAGE_KEYS.users, []);
    setAllUsers(localUsers.map(normalizeLocalUser));
    setRoles(Array.from(new Set([...defaultRoles, ...readLocal<string[]>(FARM_STORAGE_KEYS.managedRoles, [])])));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) writeLocal(FARM_STORAGE_KEYS.users, allUsers);
  }, [allUsers, hydrated]);

  useEffect(() => {
    if (hydrated) writeLocal(FARM_STORAGE_KEYS.managedRoles, roles);
  }, [hydrated, roles]);

  useEffect(() => {
    setSelectedAccess((current) => current.filter((access) => accessOptions.includes(access)));
  }, [accessOptions]);

  const users = useMemo(() => {
    const scoped = unitId ? allUsers.filter((user) => unitIdsFromUser(user.allowedUnits).includes(unitId)) : allUsers;
    return scoped.filter((user) => `${user.name} ${user.identifier} ${user.role} ${unitLabelsFromIds(user.allowedUnits).join(' ')}`.toLowerCase().includes(query.toLowerCase()));
  }, [allUsers, query, unitId]);

  function notify(message: string) {
    setFeedback(message);
    window.setTimeout(() => setFeedback(''), 4200);
  }

  function openCreateUser() {
    setAllowedUnits([]);
    setSelectedAccess([]);
    setOpen(true);
  }

  function toggleAllowedUnit(nextUnit: UnitId, checked: boolean) {
    setAllowedUnits((current) => checked ? Array.from(new Set([...current, nextUnit])) : current.filter((unit) => unit !== nextUnit));
  }

  function toggleAccess(access: string, checked: boolean) {
    setSelectedAccess((current) => checked ? Array.from(new Set([...current, access])) : current.filter((item) => item !== access));
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') ?? '').trim();
    const identifier = String(form.get('identifier') ?? '').trim();
    const role = String(form.get('role') ?? 'Responsable unité').trim();
    const password = String(form.get('password') ?? '').trim();
    const rawAllowedUnits = form.getAll('allowedUnit').map(String);
    const rawAccess = form.getAll('access').map(String);
    const permissions = normalizeUserPermissions(rawAllowedUnits, rawAccess);

    if (!name || !identifier || !role || !password || !permissions.allowedUnits.length) {
      notify('Nom, identifiant, rôle, mot de passe et au moins une unité autorisée sont obligatoires.');
      return;
    }
    if (unitId && !permissions.allowedUnits.includes(unitId)) {
      notify(`Cochez l’unité ${scopedUnits[0]?.label ?? 'de cette page'} pour créer l’accès dans cet annuaire.`);
      return;
    }

    const response = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, identifier, role, allowedUnits: permissions.allowedUnits, access: permissions.access, status: 'Invité', password }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({})) as { error?: string };
      notify(data.error ?? 'Impossible de créer cet utilisateur côté serveur.');
      return;
    }
    const data = await response.json() as { user?: { id?: string; passwordSet?: boolean; status?: ManagedUser['status']; allowedUnits?: string[]; access?: string[] } };
    const serverUser = data.user;
    const normalizedAllowed = serverUser?.allowedUnits ?? permissions.allowedUnits;
    const newUser: ManagedUser = {
      id: serverUser?.id ?? `USR-${Date.now()}`,
      initials: name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase(),
      name,
      identifier,
      role,
      unit: unitLabelsFromIds(normalizedAllowed).join(' · '),
      allowedUnits: normalizedAllowed,
      passwordSet: serverUser?.passwordSet ?? true,
      status: serverUser?.status ?? 'Invité',
      access: serverUser?.access ?? permissions.access,
    };
    setAllUsers((current) => [...current.filter((user) => user.id !== newUser.id), newUser]);
    if (!roles.some((item) => item.toLowerCase() === role.toLowerCase())) setRoles((current) => [...current, role]);
    setOpen(false);
    notify(`L’accès de ${name} a été créé avec ${normalizedAllowed.length} unité(s) autorisée(s).`);
  }

  async function toggleStatus(user: ManagedUser) {
    const nextStatus: ManagedUser['status'] = user.status === 'Suspendu' ? 'Actif' : 'Suspendu';
    const response = await fetch('/api/admin/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: user.id, status: nextStatus }) });
    if (!response.ok) {
      notify('La modification serveur a échoué.');
      return;
    }
    setAllUsers((current) => current.map((item) => item.id === user.id ? { ...item, status: nextStatus } : item));
    setMenuUserId(null);
    setDetailUser(null);
    notify(`${user.name} est maintenant ${nextStatus.toLowerCase()}.`);
  }

  async function deleteUser(user: ManagedUser) {
    if (!window.confirm(`Supprimer l’accès de ${user.name} ?`)) return;
    const response = await fetch('/api/admin/users', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: user.id }) });
    if (!response.ok) {
      notify('La suppression serveur a échoué.');
      return;
    }
    setAllUsers((current) => current.filter((item) => item.id !== user.id));
    setMenuUserId(null);
    setDetailUser(null);
    notify(`L’accès de ${user.name} a été supprimé.`);
  }

  const scopeLabel = unitId ? scopedUnits[0]?.label ?? 'Unité active' : 'Toutes les unités';
  const scopePhrase = unitId === 'stocks' ? 'le magasin central' : unitId === 'poulets' ? 'la ferme de poulets bio' : unitId === 'chevrerie' ? 'la chèvrerie' : unitId === 'provenderie' ? 'la provenderie' : unitId === 'bio' ? 'les produits bio' : unitId === 'pressoir' ? 'le pressoir à huile' : unitId === 'rh' ? 'les ressources humaines' : scopeLabel.toLowerCase();
  const scopeType = unitId === 'poulets' ? 'Ferme' : unitId ? 'Unité' : 'Administration';
  const activeCount = users.filter((user) => user.status === 'Actif').length;
  const pendingCount = users.filter((user) => user.status === 'Invité').length;
  const adminCount = users.filter((user) => user.role === 'Administratrice' || user.role === 'Directeur').length;

  return <div className="fade-in space-y-7" onClick={() => menuUserId && setMenuUserId(null)}>
    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><Link href={unitId === 'poulets' ? '/parametres/ferme' : unitId === 'chevrerie' ? '/parametres/chevrerie' : unitId === 'provenderie' ? '/parametres/provenderie' : unitId === 'bio' ? '/parametres/bio' : unitId === 'pressoir' ? '/parametres/pressoir' : unitId === 'stocks' ? '/parametres/stocks' : '/parametres'} className="mb-4 inline-flex items-center gap-2 text-[11px] font-bold text-[#6c8176] hover:text-forest">← Retour aux paramètres</Link><p className="eyebrow mb-2">{unitId ? `${scopeType} · Accès de l’unité` : 'Administration · Accès privé'}</p><h1 className="page-title">Utilisateurs & accès</h1><p className="muted mt-2 max-w-2xl text-[13px] leading-5">{unitId ? `Gérez les utilisateurs qui ont accès à ${scopeLabel}. Les autres unités ne sont pas affichées dans cet annuaire.` : 'L’administrateur crée les utilisateurs, leur attribue toutes les unités autorisées et les droits correspondants, sans unité principale.'}</p></div><button className="btn-primary" onClick={(event) => { event.stopPropagation(); openCreateUser(); }}><UserPlus size={16} /> Créer un utilisateur</button></div>
    {feedback && <div className="flex items-start gap-2 rounded-xl border border-[#cde8c7] bg-[#effaeb] px-4 py-3 text-[12px] font-semibold leading-5 text-[#4d8f51]"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#72bf70] text-white"><Check size={13} /></span>{feedback}</div>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Utilisateurs actifs" value={String(activeCount)} change={users.length ? `${users.length} profil(s)` : 'Aucune donnée'} detail={unitId ? `dans ${scopePhrase}` : 'périmètre actif'} icon={Users} tone="green" /><StatCard label="Unités couvertes" value={unitId ? `${users.length ? 1 : 0} / 1` : `${new Set(allUsers.flatMap((user) => user.allowedUnits)).size} / ${units.length}`} change={users.length ? 'accès configurés' : 'À créer'} detail={unitId ? scopeLabel : 'périmètre global'} icon={ShieldCheck} tone="blue" /><StatCard label="Invitations en attente" value={String(pendingCount)} change={pendingCount ? 'À relancer' : 'Aucune'} detail="accès créé" trend={pendingCount ? 'neutral' : 'up'} icon={UserPlus} tone="orange" /><StatCard label="Profils administrateurs" value={String(adminCount)} change={adminCount ? 'Accès contrôlé' : 'Aucun'} detail="dans cet annuaire" icon={KeyRound} tone="purple" /></div>
    <div className="rounded-2xl border border-[#cfe6ca] bg-[#f0faed] p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#d9f2d1] text-[#4d9753]"><ShieldCheck size={18} /></span><div><h2 className="text-[14px] font-bold text-[#3e7546]">{unitId ? `Les accès de ${scopePhrase} sont isolés.` : 'Les accès sont pilotés par l’administration.'}</h2><p className="mt-1 max-w-2xl text-[11px] leading-5 text-[#6d9071]">{unitId ? `Cette page ne montre ni les utilisateurs ni les droits des autres unités. Les unités autorisées d’un utilisateur restent cependant équivalentes dans son profil.` : 'Un utilisateur ne peut pas s’inscrire seul. Ses unités autorisées et ses droits sont définis à la création.'}</p></div></div><span className="whitespace-nowrap rounded-full bg-white px-3 py-1.5 text-[10px] font-bold text-[#5a9d5b]">{unitId ? scopeLabel : 'Accès privé'}</span></div>
    <div className="surface overflow-visible"><div className="flex flex-col gap-4 border-b border-[#edf0eb] px-5 pb-4 pt-5 sm:px-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><SectionHeading eyebrow="Annuaire interne" title={unitId ? `Utilisateurs · ${scopeLabel}` : 'Membres de SCOOPS LE REVEIL'} /><div className="relative min-w-[235px]"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa69f]" /><input className="input-base h-9 rounded-lg bg-[#fbfcfa] pl-9 text-[11px]" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un utilisateur..." /></div></div></div><div className="table-scroll overflow-visible"><table className="w-full text-left"><thead><tr className="table-head"><th>Utilisateur</th><th>Rôle</th><th>Unités autorisées</th><th>Accès</th><th>Statut</th><th /></tr></thead><tbody>{users.length ? users.map((user) => <tr className="table-row table-line" key={user.id}><td><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#dff3d9] text-[10px] font-black text-[#49884d]">{user.initials}</span><div><p className="font-bold text-ink">{user.name}</p><p className="mt-1 text-[10px] text-[#9aa59f]">{user.identifier}</p></div></div></td><td><span className="text-[11px] font-semibold text-[#66766d]">{user.role}</span></td><td><div className="flex max-w-[290px] flex-wrap gap-1">{unitLabelsFromIds(user.allowedUnits).map((label) => <span key={label} className="rounded-full bg-[#edf3ff] px-2 py-1 text-[9px] font-bold text-[#6385bd]">{label}</span>)}{!user.allowedUnits.length && <span className="text-[10px] text-[#b45d5d]">Aucune</span>}</div></td><td><div className="flex max-w-[270px] flex-wrap gap-1">{user.access.slice(0, 3).map((access) => <span key={access} className="rounded-full border border-[#e2ebe0] bg-white px-2 py-1 text-[9px] font-semibold text-[#718078]">{access}</span>)}{user.access.length > 3 && <span className="rounded-full bg-[#edf8e9] px-2 py-1 text-[9px] font-bold text-[#5b9d5b]">+{user.access.length - 3}</span>}</div></td><td><span className={`status-badge ${user.status === 'Actif' ? 'badge-success' : user.status === 'Invité' ? 'badge-warning' : 'badge-danger'}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{user.status}</span></td><td className="relative"><button type="button" className="icon-btn h-8 w-8" onClick={(event) => { event.stopPropagation(); setMenuUserId((current) => current === user.id ? null : user.id); }} aria-label={`Actions pour ${user.name}`}><MoreHorizontal size={15} /></button>{menuUserId === user.id && <div className="absolute right-5 top-11 z-40 w-48 rounded-xl border border-[#e1eae0] bg-white p-1.5 shadow-[0_14px_30px_rgba(29,46,39,.16)]" onClick={(event) => event.stopPropagation()}><button type="button" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[11px] font-semibold text-[#5d7065] hover:bg-[#f5faf3]" onClick={() => { setDetailUser(user); setMenuUserId(null); }}><UserRound size={14} /> Voir le profil</button><button type="button" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[11px] font-semibold text-[#5d7065] hover:bg-[#f5faf3]" onClick={() => toggleStatus(user)}><ShieldCheck size={14} /> {user.status === 'Suspendu' ? 'Réactiver' : 'Suspendre'}</button><button type="button" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[11px] font-semibold text-[#b45d5d] hover:bg-[#fff5f4]" onClick={() => deleteUser(user)}><UserRoundX size={14} /> Supprimer l’accès</button></div>}</td></tr>) : <tr><td colSpan={6} className="px-6 py-14 text-center"><Users size={28} className="mx-auto text-[#b4c3b7]" /><p className="mt-3 text-[13px] font-bold text-ink">Aucun utilisateur dans cet annuaire</p><p className="muted mt-1 text-[11px]">{unitId ? `Créez un accès autorisé à ${scopePhrase}.` : 'Créez un utilisateur pour commencer l’annuaire interne.'}</p></td></tr>}</tbody></table></div><div className="flex items-center justify-between border-t border-[#edf0eb] px-5 py-4 text-[11px] text-[#8a9790] sm:px-6"><span>{users.length} utilisateur{users.length > 1 ? 's' : ''}</span><span className="font-semibold text-[#6c8176]">Données locales · {scopeLabel}</span></div></div>
    <Modal open={Boolean(detailUser)} onClose={() => setDetailUser(null)} title="Détail de l’utilisateur">{detailUser && <div className="space-y-4"><div className="flex items-center gap-3 rounded-xl bg-[#f5faf2] p-4"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#dff3d9] text-[12px] font-black text-[#49884d]">{detailUser.initials}</span><div><p className="text-[14px] font-bold text-ink">{detailUser.name}</p><p className="mt-1 text-[10px] text-[#7b8d82]">{detailUser.identifier}</p></div></div><div className="space-y-3"><DetailLine label="Rôle" value={detailUser.role} /><DetailLine label="Unités autorisées" value={unitLabelsFromIds(detailUser.allowedUnits).join(' · ') || 'Aucune'} /><DetailLine label="Statut" value={detailUser.status} /><DetailLine label="Mot de passe" value={detailUser.passwordSet ? 'Configuré' : 'À définir'} /><DetailLine label="Droits" value={detailUser.access.join(' · ') || 'Aucun droit complémentaire'} /></div><div className="flex gap-2"><button type="button" className="btn-secondary flex-1" onClick={() => toggleStatus(detailUser)}>{detailUser.status === 'Suspendu' ? 'Réactiver' : 'Suspendre'}</button><button type="button" className="btn-primary flex-1" onClick={() => deleteUser(detailUser)}>Supprimer</button></div></div>}</Modal>
    <Modal open={open} onClose={() => setOpen(false)} title="Créer un utilisateur"><form onSubmit={createUser} className="space-y-5"><div className="rounded-xl border border-[#e1ebe0] bg-[#f6faf4] p-3 text-[11px] leading-5 text-[#6d8972]">L’utilisateur recevra un accès serveur. Les unités cochées sont strictement équivalentes et les droits affichés correspondent uniquement à leur union.</div><div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="field-label">Nom complet</span><input name="name" className="input-base" placeholder="Ex. Marie Essomba" required /></label><label className="block"><span className="field-label">Email ou identifiant</span><input name="identifier" className="input-base" placeholder="marie@scoops..." required /></label><label className="block"><span className="field-label">Mot de passe initial</span><input name="password" type="password" className="input-base" placeholder="Mot de passe temporaire" required /></label><label className="block"><span className="field-label">Rôle</span><input name="role" list="agroflux-managed-roles" className="input-base" defaultValue="Responsable unité" placeholder="Ex. Magasinier, caissier..." required /><datalist id="agroflux-managed-roles">{roles.map((role) => <option key={role} value={role} />)}</datalist></label></div><div><span className="field-label">Unités autorisées</span><p className="mb-2 text-[10px] text-[#87958d]">Aucune unité n’est cochée par défaut. Sélectionnez au moins une unité.</p><div className="grid gap-2 sm:grid-cols-2">{scopedUnits.map((unit) => <label key={unit.id} className="flex items-center gap-2 rounded-lg border border-[#e6ede5] px-3 py-2.5 text-[11px] font-semibold text-[#65766c]"><input type="checkbox" name="allowedUnit" value={unit.id} checked={allowedUnits.includes(unit.id)} onChange={(event) => toggleAllowedUnit(unit.id, event.target.checked)} className="h-3.5 w-3.5 accent-[#5da561]" />{unit.label}</label>)}</div></div><div><div className="flex flex-wrap items-end justify-between gap-2"><span className="field-label">Droits complémentaires</span><span className="text-[10px] text-[#87958d]">Union des unités cochées</span></div>{accessOptions.length ? <div className="mt-1 grid gap-2 sm:grid-cols-2">{accessOptions.map((access) => <label key={access} className="flex items-center gap-2 rounded-lg border border-[#e6ede5] px-3 py-2.5 text-[11px] font-semibold text-[#65766c]"><input type="checkbox" name="access" value={access} checked={selectedAccess.includes(access)} onChange={(event) => toggleAccess(access, event.target.checked)} className="h-3.5 w-3.5 accent-[#5da561]" />{access}</label>)}</div> : <p className="mt-2 rounded-lg border border-dashed border-[#dce8db] px-3 py-4 text-[11px] text-[#89968f]">Cochez au moins une unité pour afficher ses droits.</p>}</div><div className="flex justify-end gap-2 pt-1"><button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Annuler</button><button className="btn-primary" type="submit"><UserPlus size={15} /> Créer l’accès</button></div></form></Modal>
  </div>;
}

function normalizeLocalUser(user: ManagedUser): ManagedUser {
  const permissions = normalizeUserPermissions(user.allowedUnits ?? [], user.access ?? []);
  return { ...user, unit: unitLabelsFromIds(permissions.allowedUnits).join(' · '), allowedUnits: permissions.allowedUnits, access: permissions.access };
}

function DetailLine({ label, value }: { label: string; value: string }) { return <div className="flex items-start justify-between gap-4 border-b border-[#edf0eb] pb-2 text-[11px]"><span className="text-[#849188]">{label}</span><strong className="max-w-[65%] text-right font-bold text-ink">{value}</strong></div>; }
