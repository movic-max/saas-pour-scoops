'use client';

import { GoatFarmView } from '@/components/goat-farm-view';
import { DailyTasksReportSection } from '@/components/daily-tasks-report';

export default function GoatReportsPage() {
  return <div className="space-y-7"><GoatFarmView initialTab="reports" /><DailyTasksReportSection unitId="chevrerie" /></div>;
}
