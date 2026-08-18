'use client';

import { ProvenderieReportsView } from '@/components/provenderie-reports-view';
import { DailyTasksReportSection } from '@/components/daily-tasks-report';

export default function ProvenderieReportsPage() {
  return <div className="space-y-7"><ProvenderieReportsView /><DailyTasksReportSection unitId="provenderie" /></div>;
}
