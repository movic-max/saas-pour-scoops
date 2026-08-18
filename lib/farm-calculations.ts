import type { poultryBuildings, poultryDailyRecords, poultryHealthEvents, poultryLots, poultryTransfers } from '@/lib/data';
import { FARM_STORAGE_KEYS, readLocal, writeLocal } from '@/lib/farm-storage';

export type FarmLot = (typeof poultryLots)[number];
export type FarmBuilding = (typeof poultryBuildings)[number];
export type FarmDailyRecord = (typeof poultryDailyRecords)[number];
export type FarmHealthEvent = (typeof poultryHealthEvents)[number];
export type FarmTransfer = (typeof poultryTransfers)[number];

export type FarmSnapshot = {
  lots: FarmLot[];
  buildings: FarmBuilding[];
  daily: FarmDailyRecord[];
  health: FarmHealthEvent[];
  transfers: FarmTransfer[];
};

export type BatchArchive = {
  id: string;
  batchId: string;
  name: string;
  closedAt: string;
  closedBy: string;
  initialCount: number;
  totalDeaths: number;
  totalSold: number;
  finalAlive: number;
  finalWeight: number;
  feedTotal: number;
  expectedFeedTotal: number;
  waterTotal: number;
  mortalityRate: number;
  salesTotal: number;
  expensesTotal: number;
  margin: number;
  recordsCount: number;
  buildings: string[];
};

export type PoultrySaleInput = {
  id: string;
  batchId: string;
  buildingName?: string;
  date: string;
  quantity: number;
  unitPrice: number;
  total: number;
  customer: string;
  paymentMethod: string;
};

/** Enregistre une vente de sujets et répercute immédiatement l'effectif. */
export function registerPoultrySale(input: PoultrySaleInput) {
  if (typeof window === 'undefined' || input.quantity <= 0) return false;
  const lots = readLocal(FARM_STORAGE_KEYS.lots, [] as FarmLot[]);
  const lot = lots.find((item) => item.id === input.batchId);
  if (!lot || input.quantity > Number(lot.alive || 0)) return false;
  const sales = readLocal(FARM_STORAGE_KEYS.sales, [] as PoultrySaleInput[]);
  if (sales.some((sale) => sale.id === input.id)) return true;
  writeLocal(FARM_STORAGE_KEYS.sales, [input, ...sales]);
  const alive = Math.max(Number(lot.alive || 0) - input.quantity, 0);
  writeLocal(FARM_STORAGE_KEYS.lots, lots.map((item) => item.id === lot.id ? { ...item, alive, status: alive === 0 ? 'Terminé' : item.status } : item));
  const buildings = readLocal(FARM_STORAGE_KEYS.buildings, [] as FarmBuilding[]);
  const target = buildings.find((item) => input.buildingName ? item.name === input.buildingName : item.batch === input.batchId);
  if (target) {
    const current = Math.max(Number(target.current || 0) - input.quantity, 0);
    writeLocal(FARM_STORAGE_KEYS.buildings, buildings.map((item) => item.id === target.id ? { ...item, current, status: current === 0 ? 'Vide' : item.status } : item));
  }
  return true;
}

/**
 * Lit les données de la ferme et répare une fois les anciennes données qui
 * avaient des suivis de mortalité sans répercuter l'effectif.
 */
export function loadFarmSnapshot(): FarmSnapshot {
  const lots = readLocal(FARM_STORAGE_KEYS.lots, [] as FarmLot[]);
  const buildings = readLocal(FARM_STORAGE_KEYS.buildings, [] as FarmBuilding[]);
  const daily = readLocal(FARM_STORAGE_KEYS.daily, [] as FarmDailyRecord[]);
  const health = readLocal(FARM_STORAGE_KEYS.health, [] as FarmHealthEvent[]);
  const transfers = readLocal(FARM_STORAGE_KEYS.transfers, [] as FarmTransfer[]);

  if (typeof window !== 'undefined' && window.localStorage.getItem(FARM_STORAGE_KEYS.calculationVersion) !== '2') {
    const sales = readLocal(FARM_STORAGE_KEYS.sales, [] as Array<{ batch: string; quantity: number }>);
    const reconciledLots = lots.map((lot) => {
      const lotRecords = daily.filter((record) => record.batch === lot.id);
      const deaths = lotRecords.reduce((sum, record) => sum + Number(record.deaths || 0), 0);
      const dailySold = lotRecords.reduce((sum, record) => sum + Number(record.sold || 0), 0);
      const registeredSales = sales.filter((sale) => sale.batch === lot.id).reduce((sum, sale) => sum + Number(sale.quantity || 0), 0);
      const sold = Math.max(dailySold, registeredSales);
      const latest = lotRecords.slice().sort((a, b) => b.date.localeCompare(a.date))[0];
      const alive = Math.max(Number(lot.initial || 0) - deaths - sold, 0);
      return {
        ...lot,
        alive,
        mortality: lot.initial ? deaths / lot.initial * 100 : 0,
        weight: latest && Number(latest.averageWeight) > 0 ? latest.averageWeight : lot.weight,
        status: alive === 0 ? 'Terminé' : lot.status,
      };
    });
    const reconciledBuildings = buildings.map((building) => {
      const buildingRecords = daily.filter((record) => record.building === building.name && record.batch === building.batch);
      const deaths = buildingRecords.reduce((sum, record) => sum + Number(record.deaths || 0), 0);
      const dailySold = buildingRecords.reduce((sum, record) => sum + Number(record.sold || 0), 0);
      const registeredSales = building.batch ? sales.filter((sale) => sale.batch === building.batch).reduce((sum, sale) => sum + Number(sale.quantity || 0), 0) : 0;
      const losses = deaths + Math.max(dailySold, registeredSales);
      return losses > 0 ? { ...building, current: Math.max(Number(building.current || 0) - losses, 0) } : building;
    });
    writeLocal(FARM_STORAGE_KEYS.lots, reconciledLots);
    writeLocal(FARM_STORAGE_KEYS.buildings, reconciledBuildings);
    window.localStorage.setItem(FARM_STORAGE_KEYS.calculationVersion, '2');
    return { lots: reconciledLots, buildings: reconciledBuildings, daily, health, transfers };
  }

  return { lots, buildings, daily, health, transfers };
}
