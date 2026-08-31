import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';

interface WeeklyPoint {
  week_start: string;
  completed: number;
}

interface TechnicianCount {
  technician: string;
  count: number;
}

interface DashboardMetrics {
  vehicles_due: number;
  vehicles_in_service: number;
  completed_this_week: number;
  vehicles_overdue: number;
  status_breakdown: Record<string, number>;
  technician_breakdown: TechnicianCount[];
  weekly_completions: WeeklyPoint[];
}

const STATUS_ORDER = ['Due', 'Booked', 'In Service', 'Completed'];
const STATUS_COLOR: Record<string, string> = {
  Due: 'bg-yellow-400',
  Booked: 'bg-blue-400',
  'In Service': 'bg-purple-400',
  Completed: 'bg-green-400',
};

function WeeklyChart({ data }: { data: WeeklyPoint[] }) {
  const max = Math.max(1, ...data.map(d => d.completed));
  const chartHeight = 90;
  const slotWidth = 320 / data.length;
  const barWidth = slotWidth * 0.55;

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Completed Per Week (Last 8 Weeks)</h3>
      <svg viewBox="0 0 320 130" className="w-full h-40">
        <line x1="0" y1={chartHeight} x2="320" y2={chartHeight} stroke="#e5e7eb" strokeWidth="1" />
        {data.map((d, i) => {
          const barHeight = (d.completed / max) * (chartHeight - 20);
          const x = i * slotWidth + (slotWidth - barWidth) / 2;
          const y = chartHeight - barHeight;
          return (
            <g key={d.week_start}>
              <rect x={x} y={y} width={barWidth} height={barHeight} fill="#4f46e5" rx="2" />
              <text x={x + barWidth / 2} y={y - 4} fontSize="9" textAnchor="middle" fill="#374151">
                {d.completed}
              </text>
              <text x={x + barWidth / 2} y={chartHeight + 14} fontSize="8" textAnchor="middle" fill="#9ca3af">
                {new Date(d.week_start).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function FleetDashboard({ refreshTrigger }: { refreshTrigger: number }) {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);

  useEffect(() => {
    apiFetch('/dashboard/metrics')
      .then(res => res.json())
      .then(data => setMetrics(data))
      .catch(err => console.error(err));
  }, [refreshTrigger]);

  if (!metrics) {
    return <div className="text-sm text-gray-400 mb-8">Loading dashboard…</div>;
  }

  const statusTotal = Object.values(metrics.status_breakdown).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="mb-8 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-yellow-50 p-6 rounded-xl shadow-sm border border-yellow-100">
          <h3 className="text-sm font-semibold text-yellow-700 uppercase tracking-wider">Due for Service</h3>
          <p className="text-4xl font-extrabold text-yellow-900 mt-2">{metrics.vehicles_due}</p>
        </div>
        <div className="bg-purple-50 p-6 rounded-xl shadow-sm border border-purple-100">
          <h3 className="text-sm font-semibold text-purple-700 uppercase tracking-wider">In Service</h3>
          <p className="text-4xl font-extrabold text-purple-900 mt-2">{metrics.vehicles_in_service}</p>
        </div>
        <div className="bg-green-50 p-6 rounded-xl shadow-sm border border-green-100">
          <h3 className="text-sm font-semibold text-green-700 uppercase tracking-wider">Completed This Week</h3>
          <p className="text-4xl font-extrabold text-green-900 mt-2">{metrics.completed_this_week}</p>
        </div>
        <div className="bg-red-50 p-6 rounded-xl shadow-sm border border-red-100">
          <h3 className="text-sm font-semibold text-red-700 uppercase tracking-wider">Overdue</h3>
          <p className="text-4xl font-extrabold text-red-900 mt-2">{metrics.vehicles_overdue}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Records by Status</h3>
          <div className="space-y-2">
            {STATUS_ORDER.map(statusName => {
              const count = metrics.status_breakdown[statusName] || 0;
              const pct = (count / statusTotal) * 100;
              return (
                <div key={statusName}>
                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                    <span>{statusName}</span>
                    <span>{count}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className={`${STATUS_COLOR[statusName]} h-2 rounded-full`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Records by Technician</h3>
          {metrics.technician_breakdown.length === 0 ? (
            <p className="text-xs text-gray-400">No technicians assigned yet.</p>
          ) : (
            <div className="space-y-2">
              {metrics.technician_breakdown.map(t => (
                <div key={t.technician} className="flex justify-between text-sm text-gray-700">
                  <span>{t.technician.split('@')[0]}</span>
                  <span className="font-semibold">{t.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <WeeklyChart data={metrics.weekly_completions} />
    </div>
  );
}
