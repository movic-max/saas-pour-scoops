'use client';

import { FarmReportsView } from '@/components/farm-reports-view';
import { DailyTasksReportSection } from '@/components/daily-tasks-report';

export default function FarmReportsPage() {
  return <div className="space-y-7"><FarmReportsView /><DailyTasksReportSection unitId="poulets" /></div>;
}
