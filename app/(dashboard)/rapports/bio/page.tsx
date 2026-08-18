'use client';

import { ProvenderieReportsView } from '@/components/provenderie-reports-view';
import { DailyTasksReportSection } from '@/components/daily-tasks-report';

export default function BioReportsPage() {
  return <div className="space-y-7"><ProvenderieReportsView unitId="bio" /><DailyTasksReportSection unitId="bio" /></div>;
}
