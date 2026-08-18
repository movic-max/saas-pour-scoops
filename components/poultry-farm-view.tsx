'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { Activity, AlertTriangle, ArrowLeftRight, ArrowRight, CalendarDays, Check, ChevronDown, ClipboardCheck, Droplets, FileText, MoreHorizontal, PawPrint, Plus, Search, ShieldCheck, Thermometer, Trash2, Wheat } from 'lucide-react';
import type { poultryBuildings, poultryDailyRecords as initialDailyRecords, poultryHealthEvents, poultryLots, poultryTransfers } from '@/lib/data';
import { formatDate, formatFCFA, formatNumber, formatPercent } from '@/lib/format';
import { FARM_STORAGE_KEYS, readLocal, writeLocal } from '@/lib/farm-storage';
import { loadFarmSnapshot } from '@/lib/farm-calculations';
import { MiniProgress, Modal, SectionHeading, StatCard, ViewAll } from '@/components/ui';
import { StatusBadge } from '@/components/status-badge';

type Tab = 'overview' | 'bands' | 'buildings' | 'daily' | 'health' | 'transfers';
type BandAllocation = { id: number; building: string; quantity: number };

export function PoultryFarmView({ initialTab = 'overview' }: { initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [query, setQuery] = useState('');
  const [dailyOpen, setDailyOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [strainOpen, setStrainOpen] = useState(false);
  const [editingStrain, setEditingStrain] = useState('');
  const [transferOpen, setTransferOpen] = useState(false);
  const [buildingOpen, setBuildingOpen] = useState(false);
  const [cleaningOpen, setCleaningOpen] = useState(false);
  const [historyBuilding, setHistoryBuilding] = useState<typeof poultryBuildings[number] | null>(null);
  const [healthOpen, setHealthOpen] = useState(false);
  const [healthDetail, setHealthDetail] = useState<typeof poultryHealthEvents[number] | null>(null);
  const [feedback, setFeedback] = useState('');
  const [dailyRecords, setDailyRecords] = useState<typeof initialDailyRecords>([]);
  const [healthEvents, setHealthEvents] = useState<typeof poultryHealthEvents>([]);
  const [transfers, setTransfers] = useState<typeof poultryTransfers>([]);
  const [lots, setLots] = useState<typeof poultryLots>([]);
  const [buildings, setBuildings] = useState<typeof poultryBuildings>([]);
  const [strains, setStrains] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [allocations, setAllocations] = useState<BandAllocation[]>([{ id: 1, building: '', quantity: 0 }]);

  useEffect(() => {
    const load = () => {
      const snapshot = loadFarmSnapshot();
      setBuildings(snapshot.buildings);
      setStrains(readLocal(FARM_STORAGE_KEYS.strains, []));
      setLots(snapshot.lots);
      setDailyRecords(snapshot.daily);
      setHealthEvents(snapshot.health);
      setTransfers(snapshot.transfers);
      setHydrated(true);
    };
    load();
  }, []);
  useEffect(() => { if (!hydrated) return; writeLocal(FARM_STORAGE_KEYS.buildings, buildings); }, [buildings, hydrated]);
  useEffect(() => { if (!hydrated) return; writeLocal(FARM_STORAGE_KEYS.strains, strains); }, [strains, hydrated]);
  useEffect(() => { if (!hydrated) return; writeLocal(FARM_STORAGE_KEYS.lots, lots); }, [lots, hydrated]);
  useEffect(() => { if (!hydrated) return; writeLocal(FARM_STORAGE_KEYS.daily, dailyRecords); }, [dailyRecords, hydrated]);
  useEffect(() => { if (!hydrated) return; writeLocal(FARM_STORAGE_KEYS.health, healthEvents); }, [healthEvents, hydrated]);
  useEffect(() => { if (!hydrated) return; writeLocal(FARM_STORAGE_KEYS.transfers, transfers); }, [transfers, hydrated]);

  const filteredLots = useMemo(() => lots.filter((lot) => `${lot.id} ${lot.name} ${lot.status}`.toLowerCase().includes(query.toLowerCase())), [lots, query]);
  const filteredDaily = useMemo(() => dailyRecords.filter((record) => `${record.id} ${record.batch} ${record.building}`.toLowerCase().includes(query.toLowerCase())), [dailyRecords, query]);
  const activeLots = lots.filter((lot) => lot.status !== 'Terminé' && lot.status !== 'Archivée');
  const totalAlive = activeLots.reduce((sum, lot) => sum + Number(lot.alive || 0), 0);
  const totalMortality = lots.reduce((sum, lot) => sum + Math.round(Number(lot.initial || 0) * Number(lot.mortality || 0) / 100), 0);
  const averageMortality = lots.length ? lots.reduce((sum, lot) => sum + Number(lot.mortality || 0), 0) / lots.length : 0;
  const currentMonth = '2026-08';
  const monthRecords = dailyRecords.filter((record) => record.date.startsWith(currentMonth));
  const monthFeed = monthRecords.reduce((sum, record) => sum + Number(record.feed || 0), 0);

  function notify(message: string) {
    setFeedback(message);
    window.setTimeout(() => setFeedback(''), 3800);
  }

  function addAllocation() { setAllocations((current) => [...current, { id: Date.now(), building: buildings.find((building) => building.status !== 'Hors service')?.name ?? 'Bâtiment A', quantity: 0 }]); }
  function updateAllocation(id: number, key: 'building' | 'quantity', value: string | number) { setAllocations((current) => current.map((allocation) => allocation.id === id ? { ...allocation, [key]: value } : allocation)); }
  function removeAllocation(id: number) { setAllocations((current) => current.length > 1 ? current.filter((allocation) => allocation.id !== id) : current); }

  function createBatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const initialCount = Number(form.get('initialCount') ?? 0);
    const allocatedCount = allocations.reduce((sum, allocation) => sum + Number(allocation.quantity), 0);
    if (!initialCount || allocatedCount <= 0 || allocatedCount > initialCount) {
      notify(`Répartition invalide : ${allocatedCount} sujets répartis sur ${initialCount} poussins.`);
      return;
    }
    const selectedStrain = String(form.get('strain') ?? 'Ross 308');
    const customStrain = String(form.get('customStrain') ?? '').trim();
    const strain = selectedStrain === 'Autre' ? customStrain || 'Souche personnalisée' : selectedStrain;
    const reference = String(form.get('reference') ?? `LP-${Date.now()}`).trim();
    const start = String(form.get('startDate') ?? '2026-08-13');
    const newLot = { id: reference, name: `Lot ${strain} — ${allocations.map((allocation) => allocation.building).join(' & ')}`, start, initial: initialCount, alive: initialCount, age: 0, weight: 0, mortality: 0, status: 'En cours', color: '#9be789' };
    setLots((current) => [newLot, ...current.filter((lot) => lot.id !== reference)]);
    setBuildings((current) => current.map((building) => {
      const allocation = allocations.find((item) => item.building === building.name);
      if (!allocation || Number(allocation.quantity) <= 0) return building;
      return {
        ...building,
        current: Number(allocation.quantity),
        status: 'Occupé',
        batch: reference,
        batchName: strain,
        age: 0,
      };
    }));
    setAllocations([{ id: Date.now(), building: buildings[0]?.name ?? '', quantity: 0 }]);
    setBatchOpen(false);
    notify(`La bande ${reference} a été enregistrée avec la souche ${strain} et répartie dans ${allocations.length} bâtiment(s).`);
  }

  function saveStrain(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get('strainName') ?? '').trim();
    if (!value) return;
    if (editingStrain) {
      setStrains((current) => current.map((strain) => strain === editingStrain ? value : strain));
      notify(`La souche « ${editingStrain} » a été modifiée.`);
    } else if (!strains.includes(value)) {
      setStrains((current) => [...current, value]);
      notify(`La souche « ${value} » a été ajoutée.`);
    }
    setEditingStrain('');
  }

  function createDailyRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const building = String(form.get('building') ?? '');
    const selectedBuilding = buildings.find((item) => item.name === building);
    if (!selectedBuilding || !selectedBuilding.batch || selectedBuilding.batch === '—') {
      notify('Impossible d’enregistrer le suivi : ce bâtiment n’est pas affecté à une bande.');
      return;
    }
    const newRecord = {
      id: `SUIVI-${Date.now()}`,
      date: String(form.get('date') ?? '2026-08-13'),
      building,
      batch: selectedBuilding.batch,
      deaths: Number(form.get('deaths') ?? 0),
      expectedDeaths: Number(form.get('expectedDeaths') ?? 0),
      feed: Number(form.get('feed') ?? 0),
      expectedFeed: Number(form.get('expectedFeed') ?? 0),
      water: Number(form.get('water') ?? 0),
      sold: Number(form.get('sold') ?? 0),
      averageWeight: Number(form.get('weight') ?? 0),
      temperature: Number(form.get('temperature') ?? 0),
      humidity: Number(form.get('humidity') ?? 0),
      recordedBy: 'Administrateur',
    };
    // Une seule ligne par bâtiment, bande et date : une nouvelle saisie corrige
    // la précédente au lieu de compter deux fois la mortalité.
    const previousRecord = dailyRecords.find((record) => record.date === newRecord.date && record.building === newRecord.building && record.batch === newRecord.batch);
    const nextDailyRecords = [newRecord, ...dailyRecords.filter((record) => record.id !== previousRecord?.id)];
    const deathDelta = newRecord.deaths - (previousRecord?.deaths ?? 0);
    const soldDelta = newRecord.sold - (previousRecord?.sold ?? 0);
    const sales = readLocal(FARM_STORAGE_KEYS.sales, [] as Array<{ batch: string; quantity: number }>);
    setDailyRecords(nextDailyRecords);
    setLots((current) => current.map((lot) => {
      if (lot.id !== newRecord.batch) return lot;
      const deaths = nextDailyRecords.filter((record) => record.batch === lot.id).reduce((sum, record) => sum + Number(record.deaths || 0), 0);
      const dailySold = nextDailyRecords.filter((record) => record.batch === lot.id).reduce((sum, record) => sum + Number(record.sold || 0), 0);
      const registeredSales = sales.filter((sale) => sale.batch === lot.id).reduce((sum, sale) => sum + Number(sale.quantity || 0), 0);
      const sold = Math.max(dailySold, registeredSales);
      const alive = Math.max(Number(lot.initial || 0) - deaths - sold, 0);
      const age = Math.max(0, Math.floor((new Date(newRecord.date).getTime() - new Date(lot.start).getTime()) / 86400000));
      return { ...lot, alive, age, weight: newRecord.averageWeight > 0 ? newRecord.averageWeight : lot.weight, mortality: lot.initial ? deaths / lot.initial * 100 : 0, status: alive === 0 ? 'Terminé' : lot.status };
    }));
    setBuildings((current) => current.map((item) => item.name === building ? { ...item, current: Math.max(Number(item.current || 0) - deathDelta - soldDelta, 0) } : item));
    setDailyOpen(false);
    notify(`Le suivi du ${newRecord.date} a été enregistré : ${newRecord.deaths} mortalité(s), effectifs recalculés.`);
  }

  function createTransfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const batch = String(form.get('batch') ?? '');
    const source = String(form.get('source') ?? '');
    const destination = String(form.get('destination') ?? '');
    const quantity = Number(form.get('quantity') ?? 0);
    const sourceBuilding = buildings.find((building) => building.name === source);
    const destinationBuilding = buildings.find((building) => building.name === destination);
    if (!batch || !sourceBuilding || !destinationBuilding || source === destination || quantity <= 0 || quantity > sourceBuilding.current) {
      notify('Transfert invalide : vérifiez la bande, les bâtiments et la quantité disponible.');
      return;
    }
    const lot = lots.find((item) => item.id === batch);
    const transfer = {
      id: `TRF-${Date.now()}`,
      date: String(form.get('date') ?? '2026-08-13'),
      batch,
      source,
      destination,
      quantity,
      reason: String(form.get('reason') ?? '').trim() || 'Transfert interne',
      status: 'Validé',
      recordedBy: 'Administrateur',
    };
    setTransfers((current) => [transfer, ...current]);
    setBuildings((current) => current.map((building) => {
      if (building.name === source) return { ...building, current: Math.max(building.current - quantity, 0), status: building.current - quantity <= 0 ? 'Vide' : building.status };
      if (building.name === destination) return { ...building, current: building.current + quantity, status: 'Occupé', batch, batchName: lot?.name.replace(/^Lot /, '').split(' — ')[0] ?? building.batchName, age: lot?.age ?? building.age };
      return building;
    }));
    setTransferOpen(false);
    notify(`Le transfert de ${quantity} sujets de ${source} vers ${destination} a été enregistré.`);
  }

  function createBuilding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') ?? '').trim();
    const capacity = Number(form.get('capacity') ?? 0);
    if (!name || capacity <= 0) return;
    const building = {
      id: `BAT-${String(buildings.length + 1).padStart(2, '0')}`,
      name,
      capacity,
      current: 0,
      status: 'Vide',
      batch: '—',
      batchName: 'Aucun lot',
      age: 0,
      cleanliness: 'À contrôler',
      temperature: '—',
      humidity: '—',
    };
    setBuildings((current) => [...current, building]);
    setBuildingOpen(false);
    notify(`${name} a été ajouté à la ferme.`);
  }

  function createHealthEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const building = String(form.get('building') ?? 'Bâtiment A');
    const batch = buildings.find((item) => item.name === building)?.batch ?? 'LP-26-004';
    const healthEvent = {
      id: `SAN-${Date.now()}`,
      date: String(form.get('date') ?? '2026-08-12'),
      batch,
      building,
      type: String(form.get('type') ?? 'Vaccination'),
      product: String(form.get('product') ?? ''),
      operator: 'Administrateur',
      status: 'Réalisée',
      note: String(form.get('note') ?? ''),
    };
    setHealthEvents((current) => [healthEvent, ...current]);
    setHealthOpen(false);
    notify('L’événement sanitaire a été ajouté au carnet de la ferme.');
  }

  function exportHealthReport() {
    const header = 'Date;Bande;Bâtiment;Type;Produit;Opérateur;Statut;Observation';
    const rows = healthEvents.map((event) => [event.date, event.batch, event.building, event.type, event.product, event.operator, event.status, event.note].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(';'));
    const blob = new Blob([`\ufeff${[header, ...rows].join('\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'carnet-sanitaire-ferme.csv';
    link.click();
    URL.revokeObjectURL(url);
    notify('Le carnet sanitaire a été téléchargé au format CSV.');
  }

  function recordCleaning(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const buildingName = String(form.get('building') ?? 'Bâtiment A');
    setBuildings((current) => current.map((building) => building.name === buildingName ? { ...building, cleanliness: 'Conforme' } : building));
    setCleaningOpen(false);
    notify(`Le nettoyage de ${buildingName} a été enregistré.`);
  }

  return <div className="fade-in space-y-7">
    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><Link href="/dashboard/poulets" className="mb-4 inline-flex items-center gap-2 text-[11px] font-bold text-[#6c8176] hover:text-forest">← Retour au dashboard de la ferme</Link><p className="eyebrow mb-2">Unité · Ferme de poulets de chair</p><h1 className="page-title">Ferme de poulets</h1><p className="muted mt-2 max-w-2xl text-[13px] leading-5">Bâtiments, bandes et suivi quotidien réunis dans un espace autonome pour l’élevage.</p></div><div className="flex flex-wrap gap-2">{tab === 'transfers' && <button className="btn-primary" onClick={() => setTransferOpen(true)}><ArrowLeftRight size={15} /> Transférer des sujets</button>}{tab === 'bands' && <><button className="btn-secondary" onClick={() => setStrainOpen(true)}><PawPrint size={15} /> Gérer les souches</button><button className="btn-primary" onClick={() => setBatchOpen(true)}><Plus size={16} /> Nouvelle bande</button></>}{tab === 'buildings' && <button className="btn-primary" onClick={() => setBuildingOpen(true)}><Plus size={15} /> Ajouter un bâtiment</button>}{tab === 'daily' && <button className="btn-primary" onClick={() => setDailyOpen(true)}><ClipboardCheck size={15} /> Saisir aujourd’hui</button>}{tab === 'health' && <button className="btn-primary" onClick={() => setHealthOpen(true)}><ShieldCheck size={15} /> Ajouter un événement</button>}</div></div>
    {feedback && <div className="flex items-start gap-2 rounded-xl border border-[#cde8c7] bg-[#effaeb] px-4 py-3 text-[12px] font-semibold leading-5 text-[#4d8f51]"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#72bf70] text-white"><Check size={13} /></span>{feedback}</div>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Animaux en élevage" value={formatNumber(totalAlive)} change={lots.length ? `${activeLots.length} bande(s) active(s)` : 'Aucune donnée'} detail="ferme de poulets" icon={PawPrint} tone="green" /><StatCard label="Bâtiments actifs" value={`${buildings.filter((building) => building.status === 'Occupé').length} / ${buildings.length}`} change={buildings.length ? `${buildings.filter((building) => building.status !== 'Occupé').length} disponible(s)` : 'À créer'} detail="périmètre ferme" icon={ShieldCheck} tone="blue" /><StatCard label="Mortalité moyenne" value={`${averageMortality.toFixed(1).replace('.', ',')} %`} change={lots.length ? `${totalMortality} sujet(s)` : 'Aucune donnée'} detail="bandes enregistrées" icon={Activity} tone="orange" /><StatCard label="Aliment consommé" value={`${formatNumber(monthFeed)} kg`} change={monthRecords.length ? `${monthRecords.length} suivi(s)` : 'Aucune donnée'} detail="mois en cours" icon={Wheat} tone="purple" /></div>
    {tab === 'overview' && <Overview buildings={buildings} dailyRecords={dailyRecords} lots={lots} />}
    {tab === 'bands' && <BandsView lots={filteredLots} query={query} setQuery={setQuery} />}
    {tab === 'buildings' && <BuildingsView buildings={buildings} onAdd={() => setBuildingOpen(true)} onClean={() => setCleaningOpen(true)} onHistory={(building) => setHistoryBuilding(building)} onFeedback={notify} />}
    {tab === 'daily' && <DailyView records={filteredDaily} query={query} setQuery={setQuery} onOpenDaily={() => setDailyOpen(true)} />}
    {tab === 'health' && <HealthView events={healthEvents} buildings={buildings} onAdd={() => setHealthOpen(true)} onView={(event) => setHealthDetail(event)} onExport={exportHealthReport} />}
    {tab === 'transfers' && <TransfersView transfers={transfers} />}
    <Modal open={batchOpen} onClose={() => setBatchOpen(false)} title="Créer une nouvelle bande"><form onSubmit={createBatch} className="space-y-5"><p className="muted text-[12px] leading-5">Une bande pourra ensuite être répartie dans un ou plusieurs bâtiments. Les indicateurs démarreront à la date d’arrivée des poussins.</p><div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="field-label">Référence de la bande</span><input name="reference" className="input-base" placeholder="Ex. LP-26-005" required /></label><label className="block"><span className="field-label">Date de démarrage</span><input name="startDate" type="date" defaultValue="2026-08-12" className="input-base" required /></label><label className="block"><span className="field-label">Nombre de poussins</span><input name="initialCount" type="number" min="1" className="input-base" placeholder="1200" required /></label><label className="block"><span className="field-label">Souche</span><select name="strain" className="input-base">{strains.map((strain) => <option key={strain}>{strain}</option>)}<option>Autre</option></select></label><label className="block"><span className="field-label">Souche personnalisée (facultatif)</span><input name="customStrain" className="input-base" placeholder="Ex. Hubbard Flex" /></label><label className="block"><span className="field-label">Couvoir fournisseur</span><input name="hatchery" className="input-base" placeholder="Nom du couvoir" /></label><div className="rounded-xl border border-[#e4ece2] bg-[#fbfcfa] p-3 sm:col-span-2"><div className="mb-3 flex items-center justify-between"><div><span className="field-label mb-0">Répartition dans les bâtiments</span><p className="mt-1 text-[10px] text-[#87958d]">Une bande peut occuper plusieurs bâtiments.</p></div><button type="button" className="btn-secondary px-2.5 py-1.5 text-[10px]" onClick={addAllocation}><Plus size={13} /> Ajouter un bâtiment</button></div><div className="space-y-2">{allocations.map((allocation) => <div className="flex items-center gap-2" key={allocation.id}><select value={allocation.building} onChange={(event) => updateAllocation(allocation.id, 'building', event.target.value)} className="input-base"><option value="">Choisir un bâtiment</option>{buildings.filter((building) => building.status !== 'Hors service').map((building) => <option key={building.id}>{building.name}</option>)}</select><input type="number" min="0" value={allocation.quantity} onChange={(event) => updateAllocation(allocation.id, 'quantity', Number(event.target.value))} className="input-base w-[130px]" placeholder="Sujets" /><button type="button" className="icon-btn h-9 w-9 text-[#b45d5d]" onClick={() => removeAllocation(allocation.id)} aria-label="Supprimer la répartition"><Trash2 size={14} /></button></div>)}</div><p className="mt-3 text-right text-[10px] font-bold text-[#5b9d5b]">Total réparti : {allocations.reduce((sum, allocation) => sum + Number(allocation.quantity), 0)} sujets</p></div></div><label className="block"><span className="field-label">Note</span><textarea name="note" className="input-base min-h-[78px] resize-none" placeholder="Numéro de lot d’incubation, observation..." /></label><div className="flex justify-end gap-2 pt-1"><button type="button" className="btn-secondary" onClick={() => setBatchOpen(false)}>Annuler</button><button type="submit" className="btn-primary"><Plus size={15} /> Créer la bande</button></div></form></Modal>
    <Modal open={dailyOpen} onClose={() => setDailyOpen(false)} title="Saisir le suivi du jour"><form onSubmit={createDailyRecord} className="space-y-5"><p className="muted text-[12px] leading-5">Saisissez les données du bâtiment. Les effectifs, la mortalité cumulée et les indicateurs seront recalculés automatiquement.</p><div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="field-label">Date</span><input name="date" type="date" defaultValue="2026-08-12" className="input-base" required /></label><label className="block"><span className="field-label">Bâtiment</span><select name="building" className="input-base">{buildings.filter((item) => item.status === 'Occupé').map((building) => <option key={building.id}>{building.name}</option>)}</select></label><label className="block"><span className="field-label">Mortalité du jour</span><input name="deaths" type="number" min="0" defaultValue="0" className="input-base" /></label><label className="block"><span className="field-label">Mortalité attendue</span><input name="expectedDeaths" type="number" min="0" defaultValue="1" className="input-base" /></label><label className="block"><span className="field-label">Sujets vendus</span><input name="sold" type="number" min="0" defaultValue="0" className="input-base" /></label><label className="block"><span className="field-label">Aliment consommé réel (kg)</span><input name="feed" type="number" min="0" step="0.1" className="input-base" placeholder="0" required /></label><label className="block"><span className="field-label">Aliment attendu (kg)</span><input name="expectedFeed" type="number" min="0" step="0.1" className="input-base" placeholder="Ex. 200" required /></label><label className="block"><span className="field-label">Eau consommée (L)</span><input name="water" type="number" min="0" step="0.1" className="input-base" placeholder="0" required /></label><label className="block"><span className="field-label">Poids moyen (kg)</span><input name="weight" type="number" min="0" step="0.01" className="input-base" placeholder="0,00" /></label><label className="block"><span className="field-label">Température moyenne (°C)</span><input name="temperature" type="number" min="0" step="0.1" className="input-base" placeholder="27,0" /></label><label className="block"><span className="field-label">Humidité (%)</span><input name="humidity" type="number" min="0" max="100" step="1" className="input-base" placeholder="60" /></label></div><label className="block"><span className="field-label">Observation</span><textarea name="note" className="input-base min-h-[68px] resize-none" placeholder="Maladie, chaleur, comportement, intervention..." /></label><div className="flex justify-end gap-2 pt-1"><button type="button" className="btn-secondary" onClick={() => setDailyOpen(false)}>Annuler</button><button type="submit" className="btn-primary"><Check size={15} /> Enregistrer le suivi</button></div></form></Modal>
    <Modal open={transferOpen} onClose={() => setTransferOpen(false)} title="Transférer des sujets"><form onSubmit={createTransfer} className="space-y-5"><p className="muted text-[12px] leading-5">Le transfert conserve la même bande et le même âge. Les effectifs des deux bâtiments seront recalculés.</p><div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="field-label">Bande</span><select name="batch" className="input-base">{lots.filter((lot) => lot.status !== 'Terminé' && lot.status !== 'Archivée').map((lot) => <option key={lot.id}>{lot.id}</option>)}</select></label><label className="block"><span className="field-label">Quantité de sujets</span><input name="quantity" type="number" min="1" className="input-base" placeholder="80" required /></label><label className="block"><span className="field-label">Bâtiment source</span><select name="source" className="input-base">{buildings.filter((building) => building.status === 'Occupé').map((building) => <option key={building.id}>{building.name}</option>)}</select></label><label className="block"><span className="field-label">Bâtiment destination</span><select name="destination" className="input-base">{buildings.filter((building) => building.status !== 'Hors service').map((building) => <option key={building.id}>{building.name}</option>)}</select></label></div><label className="block"><span className="field-label">Motif</span><textarea name="reason" className="input-base min-h-[70px] resize-none" placeholder="Ex. Rééquilibrage de densité" required /></label><div className="flex justify-end gap-2 pt-1"><button type="button" className="btn-secondary" onClick={() => setTransferOpen(false)}>Annuler</button><button type="submit" className="btn-primary"><ArrowLeftRight size={15} /> Valider le transfert</button></div></form></Modal>
    <Modal open={buildingOpen} onClose={() => setBuildingOpen(false)} title="Ajouter un bâtiment"><form onSubmit={createBuilding} className="space-y-5"><p className="muted text-[12px] leading-5">Ajoutez autant de bâtiments que nécessaire. Un bâtiment vide pourra recevoir une bande après contrôle sanitaire.</p><div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="field-label">Nom du bâtiment</span><input name="name" className="input-base" placeholder="Ex. Bâtiment D" required /></label><label className="block"><span className="field-label">Capacité (sujets)</span><input name="capacity" type="number" min="1" className="input-base" placeholder="1200" required /></label></div><label className="block"><span className="field-label">Note</span><textarea name="note" className="input-base min-h-[70px] resize-none" placeholder="Emplacement, équipement, observation..." /></label><div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setBuildingOpen(false)}>Annuler</button><button type="submit" className="btn-primary"><Plus size={15} /> Ajouter le bâtiment</button></div></form></Modal>
    <Modal open={healthOpen} onClose={() => setHealthOpen(false)} title="Ajouter un événement sanitaire"><form onSubmit={createHealthEvent} className="space-y-5"><p className="muted text-[12px] leading-5">Ajoutez une vaccination, un traitement ou une observation au carnet de la bande.</p><div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="field-label">Date</span><input name="date" type="date" defaultValue="2026-08-12" className="input-base" required /></label><label className="block"><span className="field-label">Bâtiment</span><select name="building" className="input-base">{buildings.filter((item) => item.status === 'Occupé').map((building) => <option key={building.id}>{building.name}</option>)}</select></label><label className="block"><span className="field-label">Type</span><select name="type" className="input-base"><option>Vaccination</option><option>Traitement</option><option>Observation</option></select></label><label className="block"><span className="field-label">Produit ou événement</span><input name="product" className="input-base" placeholder="Ex. Newcastle — rappel" required /></label></div><label className="block"><span className="field-label">Observation</span><textarea name="note" className="input-base min-h-[70px] resize-none" placeholder="Dose, opérateur, délai d’attente..." /></label><div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setHealthOpen(false)}>Annuler</button><button type="submit" className="btn-primary"><Check size={15} /> Enregistrer</button></div></form></Modal>
    <Modal open={strainOpen} onClose={() => { setStrainOpen(false); setEditingStrain(''); }} title="Gérer les souches"><div className="space-y-4"><p className="muted text-[12px] leading-5">Ajoutez ou modifiez les souches disponibles dans le formulaire de création des bandes.</p><div className="space-y-2">{strains.map((strain) => <div className="flex items-center gap-2 rounded-xl border border-[#edf0eb] px-3 py-2.5" key={strain}><PawPrint size={14} className="text-[#5b9d5b]" /><span className="flex-1 text-[11px] font-bold text-ink">{strain}</span><button className="icon-btn h-7 w-7" onClick={() => setEditingStrain(strain)} aria-label="Modifier la souche"><PencilIcon /></button></div>)}</div><form onSubmit={saveStrain} className="flex gap-2 border-t border-[#edf0eb] pt-4"><input name="strainName" key={editingStrain || 'new-strain'} defaultValue={editingStrain} className="input-base" placeholder="Ex. Hubbard Flex" required /><button type="submit" className="btn-primary px-3"><Plus size={14} /> {editingStrain ? 'Renommer' : 'Ajouter'}</button></form>{editingStrain && <button className="text-[10px] font-bold text-[#87958d] hover:underline" onClick={() => setEditingStrain('')}>Annuler la modification</button>}</div></Modal>
    <Modal open={cleaningOpen} onClose={() => setCleaningOpen(false)} title="Enregistrer un nettoyage"><form onSubmit={recordCleaning} className="space-y-5"><p className="muted text-[12px] leading-5">Enregistrez le nettoyage et la désinfection d’un bâtiment pour garder une trace du vide sanitaire.</p><div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="field-label">Bâtiment</span><select name="building" className="input-base">{buildings.map((building) => <option key={building.id}>{building.name}</option>)}</select></label><label className="block"><span className="field-label">Date</span><input name="date" type="date" defaultValue="2026-08-12" className="input-base" /></label><label className="block"><span className="field-label">Produit utilisé</span><input name="product" className="input-base" placeholder="Désinfectant" required /></label><label className="block"><span className="field-label">Responsable</span><input name="operator" className="input-base" placeholder="Nom du responsable" required /></label></div><label className="block"><span className="field-label">Observation</span><textarea name="note" className="input-base min-h-[70px] resize-none" placeholder="Nettoyage, désinfection, contrôle..." /></label><div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setCleaningOpen(false)}>Annuler</button><button type="submit" className="btn-primary"><Check size={15} /> Enregistrer</button></div></form></Modal>
    <Modal open={Boolean(historyBuilding)} onClose={() => setHistoryBuilding(null)} title="Historique du bâtiment">{historyBuilding && <div className="space-y-4"><div className="rounded-xl bg-[#f5faf2] p-4"><p className="text-[14px] font-bold text-[#477c4a]">{historyBuilding.name}</p><p className="mt-1 text-[10px] text-[#719174]">Capacité : {formatNumber(historyBuilding.capacity)} sujets · Statut : {historyBuilding.status}</p></div><div className="space-y-3"><InfoLine label="Bande actuelle" value={historyBuilding.batch} /><InfoLine label="Hygiène" value={historyBuilding.cleanliness} /><InfoLine label="Température" value={historyBuilding.temperature} /><InfoLine label="Humidité" value={historyBuilding.humidity} /><InfoLine label="Dernière opération" value="Données locales · à compléter" /></div><button className="btn-primary w-full" onClick={() => setHistoryBuilding(null)}>Fermer</button></div>}</Modal>
    <Modal open={Boolean(healthDetail)} onClose={() => setHealthDetail(null)} title="Détail de l’événement sanitaire">{healthDetail && <div className="space-y-4"><div className="rounded-xl bg-[#f5faf2] p-4"><p className="text-[13px] font-bold text-[#477c4a]">{healthDetail.product}</p><p className="mt-1 text-[10px] text-[#719174]">{healthDetail.type} · {formatDate(healthDetail.date)}</p></div><div className="space-y-3"><InfoLine label="Bande" value={healthDetail.batch} /><InfoLine label="Bâtiment" value={healthDetail.building} /><InfoLine label="Opérateur" value={healthDetail.operator} /><InfoLine label="Statut" value={healthDetail.status} /><InfoLine label="Observation" value={healthDetail.note} /></div><button className="btn-primary w-full" onClick={() => setHealthDetail(null)}>Fermer</button></div>}</Modal>
  </div>;
}

function PencilIcon() { return <span className="text-[12px]">✎</span>; }

function InfoLine({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between gap-4 border-b border-[#edf0eb] pb-2 text-[11px]"><span className="text-[#849188]">{label}</span><strong className="text-right font-bold text-ink">{value}</strong></div>; }

function Overview({ buildings, dailyRecords, lots }: { buildings: typeof poultryBuildings; dailyRecords: typeof initialDailyRecords; lots: typeof poultryLots }) {
  const latestDate = dailyRecords.slice().sort((a, b) => b.date.localeCompare(a.date))[0]?.date;
  const latestRecords = latestDate ? dailyRecords.filter((record) => record.date === latestDate) : [];
  const feed = latestRecords.reduce((sum, record) => sum + Number(record.feed || 0), 0);
  const water = latestRecords.reduce((sum, record) => sum + Number(record.water || 0), 0);
  return <div className="space-y-5"><div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]"><div className="surface overflow-hidden"><div className="flex items-center justify-between border-b border-[#edf0eb] px-5 py-5 sm:px-6"><SectionHeading eyebrow="Occupation" title="État des bâtiments" /><ViewAll href="/poulets/batiments" label="Gérer les bâtiments" /></div><div className="grid gap-3 p-5 sm:grid-cols-3 sm:p-6">{buildings.length ? buildings.map((building) => <BuildingCard key={building.id} building={building} />) : <EmptyFarmMessage text="Aucun bâtiment enregistré." />}</div></div><div className="surface p-5 sm:p-6"><SectionHeading eyebrow="Suivi terrain" title="Résumé du dernier jour" action={<Link href="/poulets/suivi" className="icon-btn h-8 w-8"><ArrowRight size={15} /></Link>} /><div className="mt-5 rounded-2xl bg-[#f5faf2] p-4"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#dff3d9] text-[#579b5a]"><ClipboardCheck size={18} /></span><div><p className="text-[12px] font-bold text-[#477c4a]">{latestRecords.length ? `${latestRecords.length} suivi(s) enregistré(s)` : 'Aucune saisie enregistrée'}</p><p className="mt-1 text-[10px] leading-4 text-[#719174]">{latestDate ? `Dernière saisie : ${formatDate(latestDate)}` : 'Commencez par saisir le suivi quotidien.'}</p></div></div><Link href="/poulets/suivi" className="btn-secondary mt-4 flex w-full"><ClipboardCheck size={14} /> Voir le suivi quotidien</Link></div><div className="mt-4 grid grid-cols-2 gap-3"><MiniMetric label="Aliment du dernier suivi" value={`${formatNumber(feed)} kg`} icon={Wheat} /><MiniMetric label="Eau du dernier suivi" value={`${formatNumber(water)} L`} icon={Droplets} /></div></div></div><div className="surface overflow-hidden"><div className="flex items-center justify-between border-b border-[#edf0eb] px-5 py-5 sm:px-6"><SectionHeading eyebrow="Journal récent" title="Derniers suivis" /><Link href="/poulets/suivi" className="icon-btn h-8 w-8" aria-label="Ouvrir tous les suivis"><ArrowRight size={15} /></Link></div><div className="table-scroll"><table className="w-full text-left"><thead><tr className="table-head"><th>Date</th><th>Bâtiment</th><th>Morts</th><th>Aliment réel / attendu</th><th>Poids</th></tr></thead><tbody>{dailyRecords.length ? dailyRecords.slice(0, 4).map((record) => <tr className="table-row table-line" key={record.id}><td>{formatDate(record.date)}</td><td><p className="font-bold text-ink">{record.building}</p><p className="mt-1 text-[10px] text-[#9aa59f]">{record.batch}</p></td><td><span className={record.deaths > 2 ? 'font-bold text-[#c76662]' : 'font-semibold text-[#5b9d5b]'}>{record.deaths}</span></td><td><strong className="text-ink">{record.feed} kg</strong><span className="ml-1 text-[10px] text-[#9aa59f]">/ {Number(record.expectedFeed || 0)} kg</span></td><td>{Number(record.averageWeight || 0).toFixed(2).replace('.', ',')} kg</td></tr>) : <tr><td colSpan={5} className="px-6 py-10 text-center text-[11px] text-[#89968f]">Aucun suivi quotidien enregistré.</td></tr>}</tbody></table></div></div></div>;
}

function EmptyFarmMessage({ text }: { text: string }) { return <div className="rounded-2xl border border-dashed border-[#dce8db] bg-[#fbfcfa] p-6 text-center text-[11px] text-[#89968f] sm:col-span-3">{text}</div>; }

function BandsView({ lots, query, setQuery }: { lots: typeof poultryLots; query: string; setQuery: (value: string) => void }) { return <div className="surface overflow-hidden"><div className="flex flex-col gap-4 border-b border-[#edf0eb] px-5 pb-4 pt-5 sm:px-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><SectionHeading eyebrow="Cycle de production" title="Toutes les bandes" description="Chaque bande est suivie jusqu’à sa clôture." /><div className="relative min-w-[230px]"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa69f]" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="input-base h-9 rounded-lg bg-[#fbfcfa] pl-9 text-[11px]" placeholder="Rechercher une bande..." /></div></div></div><div className="table-scroll"><table className="w-full text-left"><thead><tr className="table-head"><th>Bande</th><th>Démarrage</th><th>Effectif initial</th><th>Effectif restant</th><th>Âge</th><th>Poids</th><th>Morts</th><th>Taux mortalité</th><th>Statut</th><th /></tr></thead><tbody>{lots.map((lot) => <tr className="table-row table-line" key={lot.id}><td><Link href={`/poulets/${lot.id}`} className="font-bold text-ink hover:text-[#579b5b]">{lot.id}</Link><p className="mt-1 text-[10px] text-[#9aa59f]">{lot.name}</p></td><td>{formatDate(lot.start)}</td><td>{formatNumber(lot.initial)}</td><td className="font-bold text-ink">{formatNumber(lot.alive)}</td><td>{lot.age ? `${lot.age} jours` : '—'}</td><td>{lot.weight.toFixed(2).replace('.', ',')} kg</td><td><strong className="text-ink">{mortalityCount(lot)}</strong> sujets</td><td><span className={lot.mortality > 4 ? 'font-bold text-[#c76662]' : 'font-semibold text-[#5b9d5b]'}>{formatPercent(lot.mortality)}</span></td><td><StatusBadge status={lot.status} /></td><td><button className="icon-btn h-8 w-8" onClick={() => window.location.assign(`/poulets/${lot.id}`)} aria-label={`Ouvrir ${lot.id}`}><MoreHorizontal size={14} /></button></td></tr>)}</tbody></table></div></div>; }

function BuildingsView({ buildings, onAdd, onClean, onHistory, onFeedback }: { buildings: typeof poultryBuildings; onAdd: () => void; onClean: () => void; onHistory: (building: typeof poultryBuildings[number]) => void; onFeedback: (message: string) => void }) { return <div className="space-y-5"><div className="grid gap-4 md:grid-cols-3">{buildings.map((building) => <BuildingCard key={building.id} building={building} detailed />)}</div><div className="surface overflow-hidden"><div className="flex items-center justify-between border-b border-[#edf0eb] px-5 py-5 sm:px-6"><SectionHeading eyebrow="Biosécurité" title="Historique des bâtiments" /><button className="btn-secondary px-3 py-2 text-[11px]" onClick={onClean}><ShieldCheck size={14} /> Enregistrer un nettoyage</button></div><div className="table-scroll"><table className="w-full text-left"><thead><tr className="table-head"><th>Bâtiment</th><th>Statut</th><th>Hygiène</th><th>Température</th><th>Humidité</th><th>Action</th></tr></thead><tbody>{buildings.map((building) => <tr className="table-row table-line" key={building.id}><td className="font-bold text-ink">{building.name}</td><td><StatusBadge status={building.status} /></td><td>{building.cleanliness}</td><td>{building.temperature}</td><td>{building.humidity}</td><td><button className="text-[11px] font-bold text-[#5b9d5b] hover:underline" onClick={() => onHistory(building)}>Voir l’historique</button></td></tr>)}</tbody></table></div></div></div>; }

function DailyView({ records, query, setQuery, onOpenDaily }: { records: typeof initialDailyRecords; query: string; setQuery: (value: string) => void; onOpenDaily: () => void }) { return <div className="surface overflow-hidden"><div className="flex flex-col gap-4 border-b border-[#edf0eb] px-5 pb-4 pt-5 sm:px-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><SectionHeading eyebrow="Saisie terrain" title="Suivi quotidien" description="Une ligne par bâtiment actif et par jour." /><div className="relative min-w-[225px]"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa69f]" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="input-base h-9 rounded-lg bg-[#fbfcfa] pl-9 text-[11px]" placeholder="Rechercher un suivi..." /></div></div></div><div className="table-scroll"><table className="w-full text-left"><thead><tr className="table-head"><th>Date</th><th>Bâtiment / bande</th><th>Mortalité réel / attendue</th><th>Aliment réel / attendu</th><th>Eau</th><th>Ambiance</th><th>Saisi par</th></tr></thead><tbody>{records.map((record) => <tr className="table-row table-line" key={record.id}><td>{formatDate(record.date)}</td><td><p className="font-bold text-ink">{record.building}</p><p className="mt-1 text-[10px] text-[#9aa59f]">{record.batch}</p></td><td><span className={record.deaths > 2 ? 'font-bold text-[#c76662]' : 'font-semibold text-[#5b9d5b]'}>{record.deaths} / {record.expectedDeaths} morts</span></td><td><strong className="text-ink">{record.feed} kg</strong><span className="ml-1 text-[10px] text-[#9aa59f]">/ {Number(record.expectedFeed || 0)} kg</span></td><td>{record.water} L</td><td><span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-[#6f7e75]"><Thermometer size={13} />{record.temperature}°C · {record.humidity}%</span></td><td>{record.recordedBy}</td></tr>)}</tbody></table></div></div>; }

function TransfersView({ transfers }: { transfers: typeof poultryTransfers }) { return <div className="surface overflow-hidden"><div className="flex flex-col gap-4 border-b border-[#edf0eb] px-5 pb-4 pt-5 sm:flex-row sm:items-center sm:justify-between sm:px-6"><SectionHeading eyebrow="Mouvements internes" title="Transferts entre bâtiments" description="Les sujets restent dans la même bande et leur historique est conservé." /><span className="rounded-full bg-[#edf8e9] px-3 py-1.5 text-[10px] font-bold text-[#5b9d5b]">{transfers.length} transfert{transfers.length > 1 ? 's' : ''}</span></div><div className="table-scroll"><table className="w-full text-left"><thead><tr className="table-head"><th>Référence</th><th>Date</th><th>Bande</th><th>Source</th><th>Destination</th><th>Quantité</th><th>Motif</th><th>Statut</th></tr></thead><tbody>{transfers.length ? transfers.map((transfer) => <tr className="table-row table-line" key={transfer.id}><td className="font-bold text-ink">{transfer.id}</td><td>{formatDate(transfer.date)}</td><td>{transfer.batch}</td><td>{transfer.source}</td><td>{transfer.destination}</td><td><strong className="text-ink">{transfer.quantity}</strong> sujets</td><td>{transfer.reason}</td><td><StatusBadge status={transfer.status} /></td></tr>) : <tr><td colSpan={8} className="px-6 py-12 text-center text-[11px] text-[#89968f]">Aucun transfert enregistré.</td></tr>}</tbody></table></div><div className="border-t border-[#edf0eb] bg-[#fbfcfa] px-5 py-4 text-[11px] leading-5 text-[#77877e] sm:px-6"><ArrowLeftRight size={14} className="mr-1 inline text-[#5b9d5b]" /> Un transfert validé produit une sortie dans le bâtiment source et une entrée dans le bâtiment destination.</div></div>; }

function HealthView({ events, buildings, onAdd, onView, onExport }: { events: typeof poultryHealthEvents; buildings: typeof poultryBuildings; onAdd: () => void; onView: (event: typeof poultryHealthEvents[number]) => void; onExport: () => void }) {
  const occupied = buildings.filter((building) => building.status === 'Occupé');
  const cleanlinessPending = buildings.filter((building) => !['Conforme', 'Vide sanitaire'].includes(building.cleanliness));
  return <div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]"><div className="surface overflow-hidden"><div className="flex items-center justify-between border-b border-[#edf0eb] px-5 py-5 sm:px-6"><SectionHeading eyebrow="Carnet sanitaire" title="Événements récents" /></div><div className="table-scroll"><table className="w-full text-left"><thead><tr className="table-head"><th>Date</th><th>Bande / bâtiment</th><th>Type</th><th>Produit</th><th>Statut</th><th /></tr></thead><tbody>{events.length ? events.map((event) => <tr className="table-row table-line" key={event.id}><td>{formatDate(event.date)}</td><td><p className="font-bold text-ink">{event.batch}</p><p className="mt-1 text-[10px] text-[#9aa59f]">{event.building}</p></td><td><span className="rounded-full bg-[#edf3ff] px-2 py-1 text-[10px] font-bold text-[#6385bd]">{event.type}</span></td><td>{event.product}</td><td><span className="status-badge badge-success"><Check size={12} />{event.status}</span></td><td><button className="icon-btn h-8 w-8" onClick={() => onView(event)} aria-label="Voir le détail"><MoreHorizontal size={14} /></button></td></tr>) : <tr><td colSpan={6} className="px-6 py-12 text-center text-[11px] text-[#89968f]">Aucun événement sanitaire enregistré.</td></tr>}</tbody></table></div></div><div className="surface p-5 sm:p-6"><SectionHeading eyebrow="Biosécurité" title="Points de contrôle" /><div className="mt-5 space-y-3"><ControlRow label="Bâtiments occupés suivis" value={occupied.length ? `${occupied.length} bâtiment(s)` : 'Aucun bâtiment occupé'} ok={occupied.length > 0} /><ControlRow label="Événements sanitaires" value={events.length ? `${events.length} événement(s) enregistré(s)` : 'Aucune donnée'} ok={events.length > 0} /><ControlRow label="Nettoyage des bâtiments" value={buildings.length ? (cleanlinessPending.length ? `${cleanlinessPending.length} à contrôler` : 'Tous conformes') : 'Aucun bâtiment'} ok={buildings.length > 0 && cleanlinessPending.length === 0} /><ControlRow label="Échéances sanitaires" value="À renseigner" /></div><div className="mt-5 grid gap-2"><button className="btn-primary w-full" onClick={onAdd}><ShieldCheck size={14} /> Ajouter un événement</button><button className="btn-secondary w-full" onClick={onExport}><FileText size={14} /> Exporter le carnet sanitaire</button></div></div></div>;
}

function mortalityCount(lot: typeof poultryLots[number]) {
  return Math.round(lot.initial * lot.mortality / 100);
}

function BuildingCard({ building, detailed = false }: { building: typeof poultryBuildings[number]; detailed?: boolean }) { const occupied = building.status === 'Occupé'; const progress = building.capacity ? building.current / building.capacity * 100 : 0; return <div className="rounded-2xl border border-[#edf0eb] bg-[#fbfcfa] p-4"><div className="flex items-start justify-between"><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${occupied ? 'bg-[#edf8ea] text-[#5b9d5b]' : 'bg-[#fff3e4] text-[#bd7837]'}`}><PawPrint size={17} /></span><StatusBadge status={building.status} /></div><p className="mt-4 text-[13px] font-bold text-ink">{building.name}</p><p className="mt-1 text-[10px] text-[#8b9891]">{occupied ? `${building.batch} · ${building.batchName}` : building.cleanliness}</p>{occupied && <><div className="mt-4"><MiniProgress value={progress} color="green" label="Occupation" right={`${Math.round(progress)} %`} /></div><div className="mt-4 flex items-end justify-between"><div><p className="text-[18px] font-black tracking-[-.05em] text-ink">{formatNumber(building.current)}</p><p className="text-[9px] text-[#8b9891]">sujets présents</p></div><div className="text-right"><p className="text-[12px] font-bold text-ink">J{building.age}</p><p className="text-[9px] text-[#8b9891]">âge de la bande</p></div></div></>}{detailed && <div className="mt-4 border-t border-[#e7ece5] pt-3 text-[10px] text-[#7d8c82]"><p>{building.temperature} · {building.humidity}</p><p className="mt-1">Hygiène : {building.cleanliness}</p></div>}</div>; }
function MiniMetric({ label, value, icon: Icon }: { label: string; value: string; icon: LucideIcon }) { return <div className="rounded-xl border border-[#e7ece5] bg-white p-3"><Icon size={15} className="text-[#6a9e69]" /><p className="mt-2 text-[10px] font-semibold text-[#7e8c83]">{label}</p><p className="mt-1 text-[15px] font-black tracking-[-.04em] text-ink">{value}</p></div>; }
function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button className={`whitespace-nowrap rounded-lg px-3 py-2 text-[11px] font-bold transition ${active ? 'bg-white text-forest shadow-sm' : 'text-[#87948c] hover:text-ink'}`} onClick={onClick}>{children}</button>; }
function ControlRow({ label, value, ok = false }: { label: string; value: string; ok?: boolean }) { return <div className="flex items-center gap-3 rounded-xl border border-[#edf0eb] p-3"><span className={`flex h-8 w-8 items-center justify-center rounded-lg ${ok ? 'bg-[#edf8ea] text-[#5b9d5b]' : 'bg-[#fff2e2] text-[#c07839]'}`}>{ok ? <Check size={15} /> : <AlertTriangle size={15} />}</span><div className="min-w-0 flex-1"><p className="text-[11px] font-bold text-ink">{label}</p><p className="mt-1 text-[10px] text-[#8b9891]">{value}</p></div></div>; }
