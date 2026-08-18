'use client';

import { ProvenderieReportsView } from '@/components/provenderie-reports-view';
import { DailyTasksReportSection } from '@/components/daily-tasks-report';

export default function PressReportsPage() {
  return <div className="space-y-7"><ProvenderieReportsView unitId="pressoir" /><DailyTasksReportSection unitId="pressoir" /></div>;
}
