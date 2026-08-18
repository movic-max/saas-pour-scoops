'use client';

import { CentralStoreView } from '@/components/central-store-view';
import { DailyTasksReportSection } from '@/components/daily-tasks-report';

export default function CentralStoreReportsPage() {
  return <div className="space-y-7"><CentralStoreView initialTab="inventory" /><DailyTasksReportSection unitId="stocks" /></div>;
}
