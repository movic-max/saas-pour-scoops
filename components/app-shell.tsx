'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowLeftRight, BarChart3, Bell, Boxes, ChevronDown, ChevronLeft, ChevronRight,
  CalendarDays, CircleDollarSign, ClipboardList, CreditCard, FileText, FlaskConical, Home, Leaf, Menu, Package, PanelLeft,
  LogOut, MessageCircle, Plus, Receipt, Search, Settings, ShoppingCart, Sparkles, Sprout, Store, Truck, Users, Wheat,
  X, Droplets, PawPrint, ShieldCheck, WalletCards, Factory, Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { units, type UnitId } from '@/lib/data';
import { FARM_STORAGE_KEYS, readLocal, subscribeToFarmData, writeLocal } from '@/lib/farm-storage';
import { accessForNavigation, hasAccessToRequirements, unitForNavigation } from '@/lib/route-access';
import { normalizeAllowedUnits } from '@/lib/user-access';

type NotificationItem = { id: string; title: string; detail: string; href: string; tone: 'orange' | 'blue' | 'green' };

const navigation: { label: string; items: { label: string; href: string; icon: LucideIcon; badge?: string }[] }[] = [
  { label: 'Pilotage', items: [
    { label: 'Vue d’ensemble', href: '/dashboard', icon: Home },
    { label: 'Rapports', href: '/rapports', icon: BarChart3 },
  ] },
  { label: 'Opérations', items: [
    { label: 'Élevage de poulets bio', href: '/poulets', icon: PawPrint },
    { label: 'Chèvrerie', href: '/chevrerie', icon: Sprout },
    { label: 'Provenderie', href: '/provenderie', icon: Wheat },
    { label: 'Produits bio', href: '/produits-bio', icon: FlaskConical },
    { label: 'Pressoir à huile', href: '/pressoir', icon: Droplets },
    { label: 'Magasin & stocks', href: '/stocks', icon: Boxes, badge: '2' },
    { label: 'RH & administration', href: '/rh', icon: Users },
    { label: 'Mouvements inter-unités', href: '/mouvements', icon: ArrowLeftRight },
  ] },
  { label: 'Commerce', items: [
    { label: 'Ventes & factures', href: '/factures', icon: Receipt },
    { label: 'Clients', href: '/clients', icon: Users },
    { label: 'Fournisseurs', href: '/fournisseurs', icon: Truck },
    { label: 'Messagerie privée', href: '/chat', icon: MessageCircle },
    { label: 'Achats', href: '/achats', icon: ShoppingCart },
    { label: 'Dépenses', href: '/depenses', icon: WalletCards },
    { label: 'Caisse & comptabilité', href: '/caisse', icon: CircleDollarSign },
  ] },
];

const provenderieNavigation: { label: string; items: { label: string; href: string; icon: LucideIcon; badge?: string }[] }[] = [
  { label: 'Provenderie', items: [
    { label: 'Dashboard provenderie', href: '/dashboard/provenderie', icon: Home },
    { label: 'Recettes', href: '/provenderie/recettes', icon: Wheat },
    { label: 'Matières premières', href: '/provenderie/matieres', icon: Boxes },
    { label: 'Productions', href: '/provenderie/productions', icon: Factory },
    { label: 'Stock aliments finis', href: '/provenderie/stocks', icon: Package },
    { label: 'Mouvements inter-unités', href: '/mouvements/provenderie', icon: ArrowLeftRight },
    { label: 'Articles confiés', href: '/stocks/attributions/provenderie', icon: ClipboardList },
  ] },
  { label: 'Contacts de l’unité', items: [
    { label: 'Clients provenderie', href: '/clients/provenderie', icon: Users },
    { label: 'Fournisseurs provenderie', href: '/fournisseurs/provenderie', icon: Truck },
    { label: 'Messagerie privée', href: '/chat/provenderie', icon: MessageCircle },
  ] },
  { label: 'Finance', items: [
    { label: 'Factures provenderie', href: '/factures/provenderie', icon: Receipt },
    { label: 'Dépenses provenderie', href: '/depenses/provenderie', icon: WalletCards },
    { label: 'Caisse provenderie', href: '/caisse/provenderie', icon: CircleDollarSign },
    { label: 'Comptabilité provenderie', href: '/comptabilite/provenderie', icon: FileText },
    { label: 'Rapports provenderie', href: '/rapports/provenderie', icon: BarChart3 },
  ] },
];

const bioNavigation: { label: string; items: { label: string; href: string; icon: LucideIcon; badge?: string }[] }[] = [
  { label: 'Produits bio', items: [
    { label: 'Dashboard produits bio', href: '/dashboard/bio', icon: Home },
    { label: 'Préparations bio', href: '/produits-bio/recettes', icon: FlaskConical },
    { label: 'Plantes naturelles', href: '/produits-bio/matieres', icon: Sprout },
    { label: 'Productions', href: '/produits-bio/productions', icon: Factory },
    { label: 'Stock produits bio', href: '/produits-bio/stocks', icon: Package },
    { label: 'Mouvements inter-unités', href: '/mouvements/bio', icon: ArrowLeftRight },
    { label: 'Articles confiés', href: '/stocks/attributions/bio', icon: ClipboardList },
  ] },
  { label: 'Contacts de l’unité', items: [
    { label: 'Clients produits bio', href: '/clients/bio', icon: Users },
    { label: 'Fournisseurs produits bio', href: '/fournisseurs/bio', icon: Truck },
    { label: 'Messagerie privée', href: '/chat/bio', icon: MessageCircle },
  ] },
  { label: 'Finance', items: [
    { label: 'Factures produits bio', href: '/factures/bio', icon: Receipt },
    { label: 'Dépenses produits bio', href: '/depenses/bio', icon: WalletCards },
    { label: 'Caisse produits bio', href: '/caisse/bio', icon: CircleDollarSign },
    { label: 'Comptabilité produits bio', href: '/comptabilite/bio', icon: FileText },
    { label: 'Rapports produits bio', href: '/rapports/bio', icon: BarChart3 },
  ] },
];

const pressoirNavigation: { label: string; items: { label: string; href: string; icon: LucideIcon; badge?: string }[] }[] = [
  { label: 'Pressoir à huile', items: [
    { label: 'Dashboard pressoir', href: '/dashboard/pressoir', icon: Home },
    { label: 'Recettes de pressage', href: '/pressoir/recettes', icon: Droplets },
    { label: 'Graines à presser', href: '/pressoir/matieres', icon: Wheat },
    { label: 'Lots de pressage', href: '/pressoir/productions', icon: Factory },
    { label: 'Stock huile et tourteaux', href: '/pressoir/stocks', icon: Package },
    { label: 'Mouvements inter-unités', href: '/mouvements/pressoir', icon: ArrowLeftRight },
    { label: 'Articles confiés', href: '/stocks/attributions/pressoir', icon: ClipboardList },
  ] },
  { label: 'Contacts de l’unité', items: [
    { label: 'Clients pressoir', href: '/clients/pressoir', icon: Users },
    { label: 'Fournisseurs pressoir', href: '/fournisseurs/pressoir', icon: Truck },
    { label: 'Messagerie privée', href: '/chat/pressoir', icon: MessageCircle },
  ] },
  { label: 'Finance', items: [
    { label: 'Factures pressoir', href: '/factures/pressoir', icon: Receipt },
    { label: 'Dépenses pressoir', href: '/depenses/pressoir', icon: WalletCards },
    { label: 'Caisse pressoir', href: '/caisse/pressoir', icon: CircleDollarSign },
    { label: 'Comptabilité pressoir', href: '/comptabilite/pressoir', icon: FileText },
    { label: 'Rapports pressoir', href: '/rapports/pressoir', icon: BarChart3 },
  ] },
];

const centralStoreNavigation: { label: string; items: { label: string; href: string; icon: LucideIcon; badge?: string }[] }[] = [
  { label: 'Magasin central', items: [
    { label: 'Dashboard magasin', href: '/dashboard/stocks', icon: Home },
    { label: 'Stock central', href: '/stocks/central', icon: Boxes },
    { label: 'Machines agricoles', href: '/stocks/machines', icon: Wrench },
    { label: 'Mouvements magasin', href: '/stocks/mouvements', icon: ArrowLeftRight },
    { label: 'Articles confiés', href: '/stocks/attributions/stocks', icon: ClipboardList },
    { label: 'Mouvements inter-unités', href: '/mouvements/stocks', icon: ArrowLeftRight },
    { label: 'Inventaire général', href: '/stocks/inventaire', icon: ClipboardList },
  ] },
  { label: 'Contacts de l’unité', items: [
    { label: 'Clients magasin', href: '/clients/stocks', icon: Users },
    { label: 'Fournisseurs magasin', href: '/fournisseurs/stocks', icon: Truck },
    { label: 'Messagerie privée', href: '/chat/stocks', icon: MessageCircle },
  ] },
  { label: 'Finance', items: [
    { label: 'Factures magasin', href: '/factures/stocks', icon: Receipt },
    { label: 'Dépenses magasin', href: '/depenses/stocks', icon: WalletCards },
    { label: 'Caisse magasin', href: '/caisse/stocks', icon: CircleDollarSign },
    { label: 'Comptabilité magasin', href: '/comptabilite/stocks', icon: FileText },
    { label: 'Rapports magasin', href: '/rapports/stocks', icon: BarChart3 },
  ] },
];

const goatNavigation: { label: string; items: { label: string; href: string; icon: LucideIcon; badge?: string }[] }[] = [
  { label: 'Chèvrerie', items: [
    { label: 'Dashboard chèvrerie', href: '/dashboard/chevrerie', icon: Home },
    { label: 'Animaux', href: '/chevrerie/animaux', icon: Sprout },
    { label: 'Reproduction', href: '/chevrerie/reproduction', icon: PawPrint },
    { label: 'Santé du cheptel', href: '/chevrerie/sante', icon: ShieldCheck },
    { label: 'Alimentation & rations', href: '/chevrerie/alimentation', icon: Wheat },
    { label: 'Productions', href: '/chevrerie/productions', icon: Factory },
    { label: 'Stock produits', href: '/chevrerie/stocks', icon: Package },
    { label: 'Mouvements inter-unités', href: '/mouvements/chevrerie', icon: ArrowLeftRight },
    { label: 'Articles confiés', href: '/stocks/attributions/chevrerie', icon: ClipboardList },
  ] },
  { label: 'Contacts de l’unité', items: [
    { label: 'Clients chèvrerie', href: '/clients/chevrerie', icon: Users },
    { label: 'Fournisseurs chèvrerie', href: '/fournisseurs/chevrerie', icon: Truck },
    { label: 'Messagerie privée', href: '/chat/chevrerie', icon: MessageCircle },
  ] },
  { label: 'Finance', items: [
    { label: 'Factures chèvrerie', href: '/factures/chevrerie', icon: Receipt },
    { label: 'Dépenses chèvrerie', href: '/depenses/chevrerie', icon: WalletCards },
    { label: 'Caisse chèvrerie', href: '/caisse/chevrerie', icon: CircleDollarSign },
    { label: 'Comptabilité chèvrerie', href: '/comptabilite/chevrerie', icon: FileText },
    { label: 'Rapports chèvrerie', href: '/rapports/chevrerie', icon: BarChart3 },
  ] },
];

const rhNavigation: { label: string; items: { label: string; href: string; icon: LucideIcon; badge?: string }[] }[] = [
  { label: 'RH & administration', items: [
    { label: 'Dashboard RH', href: '/dashboard/rh', icon: Home },
    { label: 'Personnel', href: '/rh/personnel', icon: Users },
    { label: 'Présences', href: '/rh/presences', icon: ClipboardList },
    { label: 'Congés & permissions', href: '/rh/conges', icon: CalendarDays },
    { label: 'Paie & paiements', href: '/rh/paie', icon: WalletCards },
    { label: 'Documents administratifs', href: '/rh/documents', icon: FileText },
  ] },
  { label: 'Communication', items: [
    { label: 'Messagerie privée', href: '/chat/rh', icon: MessageCircle },
  ] },
  { label: 'Pilotage RH', items: [
    { label: 'Rapports RH', href: '/rapports/rh', icon: BarChart3 },
  ] },
];

const farmNavigation: { label: string; items: { label: string; href: string; icon: LucideIcon; badge?: string }[] }[] = [
  { label: 'Élevage de poulets bio', items: [
    { label: 'Dashboard ferme', href: '/dashboard/poulets', icon: Home },
    { label: 'Bandes', href: '/poulets/bandes', icon: PawPrint },
    { label: 'Bâtiments', href: '/poulets/batiments', icon: Boxes },
    { label: 'Suivi quotidien', href: '/poulets/suivi', icon: ClipboardList },
    { label: 'Santé & biosécurité', href: '/poulets/sante', icon: ShieldCheck },
    { label: 'Statistiques', href: '/poulets/statistiques', icon: BarChart3 },
  ] },
  { label: 'Finance', items: [
    { label: 'Ventes & factures', href: '/factures/ferme', icon: Receipt },
    { label: 'Dépenses ferme', href: '/depenses/ferme', icon: WalletCards },
    { label: 'Caisse & comptabilité', href: '/caisse', icon: CircleDollarSign },
    { label: 'Comptabilité', href: '/comptabilite', icon: FileText },
    { label: 'Rapports financiers', href: '/rapports/ferme', icon: BarChart3 },
  ] },
  { label: 'Gestion de l’unité', items: [
    { label: 'Stock de la ferme', href: '/stocks/ferme', icon: Boxes },
    { label: 'Articles confiés', href: '/stocks/attributions/poulets', icon: ClipboardList },
    { label: 'Transferts internes', href: '/poulets/transferts', icon: ArrowLeftRight },
    { label: 'Mouvements inter-unités', href: '/mouvements/ferme', icon: ArrowLeftRight },
  ] },
  { label: 'Contacts de l’unité', items: [
    { label: 'Clients ferme', href: '/clients/poulets', icon: Users },
    { label: 'Fournisseurs ferme', href: '/fournisseurs/poulets', icon: Truck },
    { label: 'Messagerie privée', href: '/chat/poulets', icon: MessageCircle },
  ] },
];

function Logo({ compact = false }: { compact?: boolean }) {
  return <Link href="/dashboard" className={`flex items-center gap-3 ${compact ? 'justify-center' : ''}`}>
    <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-[#a4eb91] text-forest shadow-[0_7px_16px_rgba(0,0,0,.15)]">
      <Leaf size={19} strokeWidth={2.6} />
      <span className="absolute bottom-[7px] right-[7px] h-1.5 w-1.5 rounded-full bg-forest" />
    </span>
    {!compact && <span className="leading-none"><span className="block text-[17px] font-black tracking-[-.06em] text-white">agro<span className="text-[#9be789]">flux</span></span><span className="mt-1 block text-[8px] font-bold uppercase tracking-[.18em] text-[#9bb1a4]">Gestion intégrée</span></span>}
  </Link>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [farmNotifications, setFarmNotifications] = useState({ lowStock: 0, pendingFollowUps: 0, payments: 0, interUnit: 0 });
  const [notificationItems, setNotificationItems] = useState<NotificationItem[]>([]);
  const [queryUnitId, setQueryUnitId] = useState<UnitId | undefined>(undefined);
  const [sessionProfile, setSessionProfile] = useState({ name: 'MOVIC', role: 'Administratrice', initials: 'MV' });
  const [sessionAllowedUnits, setSessionAllowedUnits] = useState<UnitId[]>([]);
  const [sessionAccess, setSessionAccess] = useState<string[]>([]);
  const [sessionAdmin, setSessionAdmin] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    const unit = new URLSearchParams(window.location.search).get('unit');
    setQueryUnitId(unit === 'poulets' || unit === 'chevrerie' || unit === 'provenderie' || unit === 'bio' || unit === 'pressoir' || unit === 'stocks' || unit === 'rh' ? unit : undefined);
  }, [pathname]);
  useEffect(() => {
    const cookieMap = Object.fromEntries(document.cookie.split('; ').filter(Boolean).map((part) => { const index = part.indexOf('='); return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))]; }));
    const name = cookieMap.agroflux_user_name || 'MOVIC';
    const role = cookieMap.agroflux_role || 'Administratrice';
    const isAdmin = cookieMap.agroflux_is_admin === '1';
    setSessionProfile({ name, role, initials: name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() });
    setSessionAllowedUnits(parseCookieArray(cookieMap.agroflux_allowed_units).filter((unit): unit is UnitId => normalizeAllowedUnits([unit]).length > 0));
    setSessionAccess(parseCookieArray(cookieMap.agroflux_access));
    setSessionAdmin(isAdmin);
    setSessionReady(true);
  }, []);

  const isActive = (href: string) => href === '/dashboard' ? pathname === href : pathname.startsWith(href);
  const routeUnitId = pathname.match(/^\/dashboard\/([^/]+)/)?.[1] as UnitId | undefined;
  const pathUnitId = pathname.startsWith('/provenderie') || pathname.startsWith('/caisse/provenderie') || pathname.startsWith('/factures/provenderie') || pathname.startsWith('/depenses/provenderie') || pathname.startsWith('/comptabilite/provenderie') || pathname.startsWith('/rapports/provenderie') || pathname.startsWith('/mouvements/provenderie') || pathname.startsWith('/parametres/provenderie') || pathname.startsWith('/clients/provenderie') || pathname.startsWith('/fournisseurs/provenderie') || pathname.startsWith('/chat/provenderie') || pathname.startsWith('/stocks/attributions/provenderie') ? 'provenderie' : pathname.startsWith('/produits-bio') || pathname.startsWith('/caisse/bio') || pathname.startsWith('/factures/bio') || pathname.startsWith('/depenses/bio') || pathname.startsWith('/comptabilite/bio') || pathname.startsWith('/rapports/bio') || pathname.startsWith('/mouvements/bio') || pathname.startsWith('/parametres/bio') || pathname.startsWith('/clients/bio') || pathname.startsWith('/fournisseurs/bio') || pathname.startsWith('/chat/bio') || pathname.startsWith('/stocks/attributions/bio') ? 'bio' : pathname.startsWith('/pressoir') || pathname.startsWith('/caisse/pressoir') || pathname.startsWith('/factures/pressoir') || pathname.startsWith('/depenses/pressoir') || pathname.startsWith('/comptabilite/pressoir') || pathname.startsWith('/rapports/pressoir') || pathname.startsWith('/mouvements/pressoir') || pathname.startsWith('/parametres/pressoir') || pathname.startsWith('/clients/pressoir') || pathname.startsWith('/fournisseurs/pressoir') || pathname.startsWith('/chat/pressoir') || pathname.startsWith('/stocks/attributions/pressoir') ? 'pressoir' : pathname.startsWith('/chevrerie') || pathname.startsWith('/caisse/chevrerie') || pathname.startsWith('/factures/chevrerie') || pathname.startsWith('/depenses/chevrerie') || pathname.startsWith('/comptabilite/chevrerie') || pathname.startsWith('/rapports/chevrerie') || pathname.startsWith('/mouvements/chevrerie') || pathname.startsWith('/parametres/chevrerie') || pathname.startsWith('/clients/chevrerie') || pathname.startsWith('/fournisseurs/chevrerie') || pathname.startsWith('/chat/chevrerie') || pathname.startsWith('/stocks/attributions/chevrerie') ? 'chevrerie' : pathname === '/stocks' || pathname.startsWith('/stocks/central') || pathname.startsWith('/stocks/machines') || pathname.startsWith('/stocks/mouvements') || pathname.startsWith('/stocks/inventaire') || pathname.startsWith('/mouvements/stocks') || pathname.startsWith('/caisse/stocks') || pathname.startsWith('/factures/stocks') || pathname.startsWith('/depenses/stocks') || pathname.startsWith('/comptabilite/stocks') || pathname.startsWith('/rapports/stocks') || pathname.startsWith('/parametres/stocks') || pathname.startsWith('/clients/stocks') || pathname.startsWith('/fournisseurs/stocks') || pathname.startsWith('/chat/stocks') || pathname.startsWith('/stocks/attributions/stocks') ? 'stocks' : pathname.startsWith('/rh') || pathname.startsWith('/rapports/rh') || pathname.startsWith('/parametres/rh') || pathname.startsWith('/chat/rh') ? 'rh' : pathname.startsWith('/poulets') || pathname.startsWith('/stocks/ferme') || pathname.startsWith('/caisse') || pathname.startsWith('/factures/ferme') || pathname.startsWith('/rapports/ferme') || pathname.startsWith('/mouvements/ferme') || pathname.startsWith('/depenses/ferme') || pathname.startsWith('/comptabilite') || pathname.startsWith('/parametres/ferme') || pathname.startsWith('/clients/poulets') || pathname.startsWith('/fournisseurs/poulets') || pathname.startsWith('/chat/poulets') || pathname.startsWith('/stocks/attributions/poulets') ? 'poulets' : undefined;
  const activeUnitId = routeUnitId ?? pathUnitId ?? queryUnitId;
  const activeUnit = units.find((unit) => unit.id === activeUnitId);
  useEffect(() => {
    const scopedUnit = activeUnitId;
    if (!scopedUnit || !['poulets', 'chevrerie', 'provenderie', 'bio', 'pressoir', 'stocks'].includes(scopedUnit)) {
      setFarmNotifications({ lowStock: 0, pendingFollowUps: 0, payments: 0, interUnit: 0 });
      setNotificationItems([]);
      return;
    }
    const load = () => {
      const stock = readLocal<Array<{ id?: string; name?: string; quantity: number; min: number; unit?: string }>>(FARM_STORAGE_KEYS.stock, []);
      const centralStock = readLocal<Array<{ id?: string; name?: string; quantity: number; min: number; unit?: string }>>(FARM_STORAGE_KEYS.centralStock, []);
      const daily = readLocal<Array<{ date: string; building?: string }>>(FARM_STORAGE_KEYS.daily, []);
      const buildings = readLocal<Array<{ name: string; status: string }>>(FARM_STORAGE_KEYS.buildings, []);
      const invoices = readLocal<Array<{ id?: string; unit?: string; client?: string; paid: number; amount: number }>>(FARM_STORAGE_KEYS.invoices, []);
      const interUnit = readLocal<Array<{ id?: string; from: string; to: string; product: string; quantity: number; unit: string; status: string; requestedByUnit?: string }>>(FARM_STORAGE_KEYS.interUnitMovements, []);
      const feedMaterials = readLocal<Array<{ id?: string; name: string; quantity: number; min: number; unit?: string }>>(scopedUnit === 'bio' ? FARM_STORAGE_KEYS.bioMaterials : scopedUnit === 'pressoir' ? FARM_STORAGE_KEYS.pressMaterials : FARM_STORAGE_KEYS.feedMaterials, []);
      const goatFeeds = readLocal<Array<{ id?: string; name: string; quantity: number; min: number; unit?: string }>>(FARM_STORAGE_KEYS.goatFeeding, []);
      const goatHealth = readLocal<Array<{ id?: string; animalName: string; status: string }>>(FARM_STORAGE_KEYS.goatHealth, []);
      const latestDate = daily.slice().sort((a, b) => b.date.localeCompare(a.date))[0]?.date;
      const items: NotificationItem[] = [];
      if (scopedUnit === 'poulets') {
        interUnit.filter((movement) => movement.status === 'En transit' && (movement.requestedByUnit === 'poulets' || (!movement.requestedByUnit && movement.to === 'poulets'))).forEach((movement) => items.push({ id: `movement-${movement.id}-reception`, title: 'Aliment à réceptionner', detail: `${movement.quantity} ${movement.unit} · ${movement.product}`, href: '/mouvements/ferme', tone: 'blue' }));
        stock.filter((item) => Number(item.quantity) <= Number(item.min)).forEach((item) => items.push({ id: `stock-${item.id ?? item.name}-${item.quantity}`, title: 'Stock sous le seuil', detail: `${item.name ?? 'Article'} · ${item.quantity} ${item.unit ?? ''}`, href: '/stocks/ferme', tone: 'orange' }));
        buildings.filter((building) => building.status === 'Occupé' && (!latestDate || !daily.some((record) => record.date === latestDate && record.building === building.name))).forEach((building) => items.push({ id: `follow-${building.name}-${latestDate ?? 'sans-date'}`, title: 'Suivi quotidien manquant', detail: `${building.name} doit être renseigné`, href: '/poulets/suivi', tone: 'blue' }));
      } else if (scopedUnit === 'provenderie') {
        interUnit.filter((movement) => movement.from === 'provenderie' && movement.status === 'Demandée').forEach((movement) => items.push({ id: `movement-${movement.id}-demand`, title: 'Nouvelle demande d’approvisionnement', detail: `${movement.quantity} ${movement.unit} · ${movement.product}`, href: '/mouvements/provenderie', tone: 'orange' }));
        feedMaterials.filter((material) => Number(material.quantity) <= Number(material.min)).forEach((material) => items.push({ id: `material-${material.id ?? material.name}-${material.quantity}`, title: 'Matière première sous le seuil', detail: `${material.name} · ${material.quantity} ${material.unit ?? ''}`, href: '/provenderie/matieres', tone: 'orange' }));
      } else if (scopedUnit === 'bio') {
        interUnit.filter((movement) => movement.from === 'bio' && movement.status === 'Demandée').forEach((movement) => items.push({ id: `movement-${movement.id}-demand`, title: 'Nouvelle demande de produits bio', detail: `${movement.quantity} ${movement.unit} · ${movement.product}`, href: '/mouvements/bio', tone: 'orange' }));
        feedMaterials.filter((material) => Number(material.quantity) <= Number(material.min)).forEach((material) => items.push({ id: `material-${material.id ?? material.name}-${material.quantity}`, title: 'Plante naturelle sous le seuil', detail: `${material.name} · ${material.quantity} ${material.unit ?? ''}`, href: '/produits-bio/matieres', tone: 'orange' }));
      } else if (scopedUnit === 'pressoir') {
        interUnit.filter((movement) => movement.from === 'pressoir' && movement.status === 'Demandée').forEach((movement) => items.push({ id: `movement-${movement.id}-demand`, title: 'Nouvelle demande au pressoir', detail: `${movement.quantity} ${movement.unit} · ${movement.product}`, href: '/mouvements/pressoir', tone: 'orange' }));
        feedMaterials.filter((material) => Number(material.quantity) <= Number(material.min)).forEach((material) => items.push({ id: `material-${material.id ?? material.name}-${material.quantity}`, title: 'Graine sous le seuil', detail: `${material.name} · ${material.quantity} ${material.unit ?? ''}`, href: '/pressoir/matieres', tone: 'orange' }));
      } else if (scopedUnit === 'chevrerie') {
        interUnit.filter((movement) => movement.from === 'chevrerie' && movement.status === 'Demandée').forEach((movement) => items.push({ id: `movement-${movement.id}-demand`, title: 'Nouvelle demande à la chèvrerie', detail: `${movement.quantity} ${movement.unit} · ${movement.product}`, href: '/mouvements/chevrerie', tone: 'orange' }));
        goatFeeds.filter((feed) => Number(feed.quantity) <= Number(feed.min)).forEach((feed) => items.push({ id: `goat-feed-${feed.id ?? feed.name}-${feed.quantity}`, title: 'Aliment caprin sous le seuil', detail: `${feed.name} · ${feed.quantity} ${feed.unit ?? ''}`, href: '/chevrerie/alimentation', tone: 'orange' }));
        goatHealth.filter((event) => event.status === 'À surveiller' || event.status === 'Planifié').forEach((event) => items.push({ id: `goat-health-${event.id ?? event.animalName}-${event.status}`, title: 'Suivi santé à traiter', detail: `${event.animalName} · ${event.status}`, href: '/chevrerie/sante', tone: 'blue' }));
      } else {
        interUnit.filter((movement) => movement.from === 'stocks' && movement.status === 'Demandée').forEach((movement) => items.push({ id: `movement-${movement.id}-demand`, title: 'Nouvelle demande au magasin central', detail: `${movement.quantity} ${movement.unit} · ${movement.product}`, href: '/mouvements/stocks', tone: 'orange' }));
        interUnit.filter((movement) => movement.to === 'stocks' && movement.status === 'En transit').forEach((movement) => items.push({ id: `movement-${movement.id}-reception`, title: 'Article à réceptionner au magasin', detail: `${movement.quantity} ${movement.unit} · ${movement.product}`, href: '/mouvements/stocks', tone: 'blue' }));
        centralStock.filter((item) => Number(item.quantity) <= Number(item.min)).forEach((item) => items.push({ id: `central-${item.id ?? item.name}-${item.quantity}`, title: 'Article du magasin sous le seuil', detail: `${item.name ?? 'Article'} · ${item.quantity} ${item.unit ?? ''}`, href: '/stocks/central', tone: 'orange' }));
      }
      const cashHref = scopedUnit === 'poulets' ? '/caisse' : `/caisse/${scopedUnit}`;
      invoices.filter((invoice) => invoice.unit === scopedUnit && Number(invoice.paid) > 0).forEach((invoice) => items.push({ id: `payment-${invoice.id}-${invoice.paid}`, title: 'Paiement reçu', detail: `${invoice.client ?? invoice.id} · versement enregistré`, href: cashHref, tone: 'green' }));
      const reads = readLocal(FARM_STORAGE_KEYS.notificationReads, [] as string[]);
      const unreadItems = items.filter((item) => !reads.includes(item.id));
      setNotificationItems(unreadItems);
      setFarmNotifications({
        lowStock: unreadItems.filter((item) => item.id.startsWith('stock-') || item.id.startsWith('material-') || item.id.startsWith('central-') || item.id.startsWith('goat-feed-')).length,
        pendingFollowUps: unreadItems.filter((item) => item.id.startsWith('follow-') || item.id.startsWith('goat-health-')).length,
        payments: unreadItems.filter((item) => item.id.startsWith('payment-')).length,
        interUnit: unreadItems.filter((item) => item.id.startsWith('movement-')).length,
      });
    };
    load();
    return subscribeToFarmData([FARM_STORAGE_KEYS.stock, FARM_STORAGE_KEYS.centralStock, FARM_STORAGE_KEYS.daily, FARM_STORAGE_KEYS.buildings, FARM_STORAGE_KEYS.feedMaterials, FARM_STORAGE_KEYS.bioMaterials, FARM_STORAGE_KEYS.pressMaterials, FARM_STORAGE_KEYS.goatFeeding, FARM_STORAGE_KEYS.goatHealth, FARM_STORAGE_KEYS.invoices, FARM_STORAGE_KEYS.interUnitMovements], load);
  }, [activeUnitId]);
  const baseNavigation = activeUnitId === 'poulets' ? farmNavigation : activeUnitId === 'chevrerie' ? goatNavigation : activeUnitId === 'provenderie' ? provenderieNavigation : activeUnitId === 'bio' ? bioNavigation : activeUnitId === 'pressoir' ? pressoirNavigation : activeUnitId === 'stocks' ? centralStoreNavigation : activeUnitId === 'rh' ? rhNavigation : navigation;
  const visibleNavigation = sessionReady ? filterNavigation(baseNavigation, sessionAllowedUnits, sessionAccess, sessionAdmin, activeUnitId, sessionProfile.role) : [];
  const settingsHref = activeUnitId === 'poulets' ? '/parametres/ferme' : activeUnitId === 'chevrerie' ? '/parametres/chevrerie' : activeUnitId === 'provenderie' ? '/parametres/provenderie' : activeUnitId === 'bio' ? '/parametres/bio' : activeUnitId === 'pressoir' ? '/parametres/pressoir' : activeUnitId === 'stocks' ? '/parametres/stocks' : activeUnitId === 'rh' ? '/parametres/rh' : '/parametres';
  const canOpenSettings = sessionAdmin || (sessionReady && hasAccessToRequirements(sessionAccess, ['Paramètres']));
  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.assign('/connexion');
  };
  const markNotificationRead = (id: string) => {
    const reads = readLocal(FARM_STORAGE_KEYS.notificationReads, [] as string[]);
    if (!reads.includes(id)) writeLocal(FARM_STORAGE_KEYS.notificationReads, [...reads, id]);
    setNotificationItems((current) => current.filter((item) => item.id !== id));
    setFarmNotifications((current) => ({ ...current, lowStock: (id.startsWith('stock-') || id.startsWith('material-') || id.startsWith('central-') || id.startsWith('goat-feed-')) ? Math.max(current.lowStock - 1, 0) : current.lowStock, pendingFollowUps: (id.startsWith('follow-') || id.startsWith('goat-health-')) ? Math.max(current.pendingFollowUps - 1, 0) : current.pendingFollowUps, payments: id.startsWith('payment-') ? Math.max(current.payments - 1, 0) : current.payments, interUnit: id.startsWith('movement-') ? Math.max(current.interUnit - 1, 0) : current.interUnit }));
    setNotificationsOpen(false);
  };

  return <div className="app-shell">
    {mobileOpen && <button className="mobile-backdrop lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Fermer la navigation" />}
    <aside className={`sidebar nav-scroll fixed bottom-0 left-0 top-0 z-[100] flex flex-col overflow-y-auto ${collapsed ? 'sidebar-collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
      <div className={`flex h-[82px] shrink-0 items-center border-b border-white/10 px-5 ${collapsed ? 'justify-center px-3' : 'justify-between'}`}>
        <Logo compact={collapsed} />
        {!collapsed && <button className="hidden h-8 w-8 items-center justify-center rounded-lg text-[#9bb1a4] transition hover:bg-white/10 hover:text-white lg:flex" onClick={() => setCollapsed(true)} aria-label="Réduire la sidebar"><ChevronLeft size={17} /></button>}
        <button className="flex h-8 w-8 items-center justify-center rounded-lg text-[#9bb1a4] transition hover:bg-white/10 hover:text-white lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Fermer"><X size={17} /></button>
      </div>

      <div className={`px-3 pt-5 ${collapsed ? 'flex justify-center' : ''}`}>
        {collapsed ? <button className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#285341] text-[#cfe2d2] hover:bg-[#34644f]" onClick={() => setCollapsed(false)} aria-label="Ouvrir la sidebar"><ChevronRight size={17} /></button> : <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[.06] px-3 py-2.5"><span className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white"><Image src="/scoops-le-reveil-logo.jpg" alt="Logo SCOOPS LE REVEIL" fill className="object-contain" sizes="32px" /></span><div className="min-w-0 flex-1"><p className="truncate text-[11px] font-bold text-white">SCOOPS LE REVEIL</p><p className="mt-0.5 truncate text-[10px] text-[#98b0a3]">Entreprise principale</p></div><ChevronDown size={14} className="text-[#98b0a3]" /></div>}
      </div>

      <nav className={`nav-scroll mt-6 flex-1 overflow-y-auto px-3 pb-5 ${collapsed ? 'px-3' : ''}`}>
        {visibleNavigation.map((section) => <div className="mb-6" key={section.label}>
          {!collapsed && <p className="mb-2 px-3 text-[9px] font-bold uppercase tracking-[.18em] text-[#7d9d8c]">{section.label}</p>}
          <div className="space-y-1">
            {section.items.map(({ label, href, icon: Icon, badge }) => {
              const active = isActive(href);
              const movementBadge = href === '/mouvements/ferme' || href === '/mouvements/provenderie' ? (farmNotifications.interUnit ? String(farmNotifications.interUnit) : undefined) : badge;
              return <Link key={href} href={href} onClick={() => setMobileOpen(false)} title={collapsed ? label : undefined} className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[12px] font-semibold transition ${collapsed ? 'justify-center' : ''} ${active ? 'bg-[#a4eb91] text-forest shadow-[0_8px_18px_rgba(0,0,0,.12)]' : 'text-[#b3cabe] hover:bg-white/[.08] hover:text-white'}`}>
                <Icon size={17} strokeWidth={active ? 2.4 : 2} />
                {!collapsed && <><span className="flex-1 truncate">{label}</span>{movementBadge && <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? 'bg-forest/15 text-forest' : 'bg-[#d9706b] text-white'}`}>{movementBadge}</span>}</>}
              </Link>;
            })}
          </div>
        </div>)}
      </nav>

      <div className={`mt-auto border-t border-white/10 p-3 ${collapsed ? 'flex justify-center' : ''}`}>
        {!collapsed && <div className="mb-3 rounded-xl border border-[#96d886]/20 bg-[#a4eb91]/[.09] p-3"><div className="mb-2 flex items-center justify-between"><span className="flex items-center gap-1.5 text-[10px] font-bold text-[#ccefc4]"><Sparkles size={12} /> Plan Essentiel</span><span className="text-[10px] text-[#98b0a3]">58%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full w-[58%] rounded-full bg-[#a4eb91]" /></div><p className="mt-2 text-[9px] leading-4 text-[#98b0a3]">6 unités sur 6 configurées</p></div>}
        {canOpenSettings && (collapsed ? <Link href={settingsHref} className="flex h-10 w-10 items-center justify-center rounded-xl text-[#afc8b8] hover:bg-white/10 hover:text-white" title="Paramètres"><Settings size={17} /></Link> : <Link href={settingsHref} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[12px] font-semibold text-[#b3cabe] hover:bg-white/[.08] hover:text-white"><Settings size={17} /><span>Paramètres</span></Link>)}
        {collapsed ? <button className="mt-2 flex h-10 w-10 items-center justify-center rounded-xl text-[#afc8b8] hover:bg-white/10 hover:text-white" onClick={handleLogout} title="Se déconnecter"><LogOut size={17} /></button> : <button className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[12px] font-semibold text-[#b3cabe] hover:bg-white/[.08] hover:text-white" onClick={handleLogout}><LogOut size={17} /><span>Se déconnecter</span></button>}
        {!collapsed && <div className="mt-3 flex items-center gap-3 border-t border-white/10 px-2 pt-3"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e9ba83] text-[11px] font-black text-forest">{sessionProfile.initials}</div><div className="min-w-0 flex-1"><p className="truncate text-[11px] font-bold text-white">{sessionProfile.name}</p><p className="truncate text-[10px] text-[#8fa99a]">{sessionProfile.role}</p></div><button className="text-[#8fa99a] hover:text-white" onClick={handleLogout} aria-label="Se déconnecter"><LogOut size={15} /></button></div>}
      </div>
    </aside>

    <main className={`main-area min-h-screen ${collapsed ? 'is-collapsed' : ''}`}>
      <header className="topbar sticky top-0 z-[100] flex h-[82px] items-center justify-between gap-4 px-5 sm:px-8 lg:px-10">
        <div className="flex min-w-0 items-center gap-3">
          <button className="icon-btn h-9 w-9 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Ouvrir la navigation"><Menu size={18} /></button>
          {collapsed && <button className="icon-btn hidden h-9 w-9 lg:flex" onClick={() => setCollapsed(false)} aria-label="Ouvrir la sidebar"><PanelLeft size={17} /></button>}
          <div className={`relative ${searchOpen ? 'block' : 'hidden sm:block'}`}><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa69f]" size={15} /><input className="input-base h-9 w-[220px] rounded-full border-transparent bg-white pl-9 pr-3 text-[12px] shadow-[0_3px_12px_rgba(29,46,39,.035)] placeholder:text-[#a4afa9] focus:border-[#c7d8c8] sm:w-[260px]" placeholder="Rechercher..." aria-label="Rechercher" /></div>
          {activeUnit && <Link href="/selection-unite" className="unit-context-chip"><span className="h-2 w-2 rounded-full" style={{ background: activeUnit.color }} />{activeUnit.shortLabel}<ChevronDown size={13} /></Link>}
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          
          <button className="icon-btn h-9 w-9 sm:hidden" onClick={() => setSearchOpen(!searchOpen)} aria-label="Rechercher"><Search size={17} /></button>
          <div className="relative"><button className="icon-btn relative h-9 w-9" onClick={() => setNotificationsOpen(!notificationsOpen)} aria-label="Notifications" aria-expanded={notificationsOpen}><Bell size={17} />{notificationItems.length > 0 ? <span className="absolute -right-1 -top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-[#d9706b] px-1 text-[9px] font-black text-white">{notificationItems.length}</span> : <span className="pulse-dot absolute right-[7px] top-[6px] h-1.5 w-1.5 rounded-full bg-[#e9975c]" />}</button>{notificationsOpen && <div className="notification-popover"><div className="flex items-center justify-between border-b border-[#edf0eb] px-3.5 py-3"><p className="text-[12px] font-bold text-ink">Notifications</p><button className="text-[10px] font-bold text-[#5b9d5b]" onClick={() => setNotificationsOpen(false)}>Fermer</button></div><div className="max-h-[420px] overflow-y-auto">{notificationItems.length ? notificationItems.map((item) => <Link key={item.id} href={item.href} className="notification-item" onClick={() => markNotificationRead(item.id)}><span className={`notification-dot ${item.tone === 'orange' ? 'bg-[#e9975c]' : item.tone === 'green' ? 'bg-[#71bd76]' : 'bg-[#6f9fe8]'}`} /><span><strong>{item.title}</strong><small>{item.detail}</small></span></Link>) : <div className="px-3.5 py-6 text-center text-[11px] text-[#89968f]">Aucune notification dans cet espace.</div>}</div><div className="border-t border-[#edf0eb] px-3.5 py-2.5 text-center text-[10px] font-bold text-[#5b9d5b]">{notificationItems.length} notification{notificationItems.length > 1 ? 's' : ''} · {activeUnit?.shortLabel ?? 'global'}</div></div>}</div>
          <div className="hidden h-6 w-px bg-[#dfe6df] sm:block" />
          <button className="icon-btn hidden h-9 w-9 sm:flex" onClick={handleLogout} aria-label="Se déconnecter" title="Se déconnecter"><LogOut size={16} /></button>
          <button className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition hover:bg-white"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e9ba83] text-[11px] font-black text-forest">{sessionProfile.initials}</span><span className="hidden text-left sm:block"><span className="block text-[11px] font-bold leading-4 text-ink">{sessionProfile.name}</span><span className="block text-[10px] leading-3 text-[#8a9790]">{sessionProfile.role}</span></span><ChevronDown size={14} className="hidden text-[#87958d] sm:block" /></button>
        </div>
      </header>
      <div className="px-5 pb-10 pt-7 sm:px-8 lg:px-10">{children}</div>
    </main>
  </div>;
}

type NavigationSection = { label: string; items: { label: string; href: string; icon: LucideIcon; badge?: string }[] };

function filterNavigation(sections: NavigationSection[], allowedUnits: UnitId[], access: string[], admin: boolean, activeUnitId: UnitId | undefined, role: string) {
  return sections.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (admin) return true;
      if (item.href === '/dashboard' && !['PDG', 'DG', 'ADMINISTRATRICE'].includes(role.trim().toUpperCase())) return false;
      const itemUnit = unitForNavigation(item.href) ?? activeUnitId;
      if (itemUnit && !allowedUnits.includes(itemUnit)) return false;
      return hasAccessToRequirements(access, accessForNavigation(item.href, activeUnitId));
    }),
  })).filter((section) => section.items.length > 0);
}

function parseCookieArray(value: string | undefined): string[] {
  if (!value) return [];
  let current = value;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const parsed = JSON.parse(current) as unknown;
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      try { current = decodeURIComponent(current); } catch { return []; }
    }
  }
  return [];
}

function MoreIcon() { return <span className="flex gap-0.5"><i className="h-1 w-1 rounded-full bg-current" /><i className="h-1 w-1 rounded-full bg-current" /><i className="h-1 w-1 rounded-full bg-current" /></span>; }
