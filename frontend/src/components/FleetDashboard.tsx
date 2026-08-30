import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';

export default function FleetDashboard({ refreshTrigger }: { refreshTrigger: number }) {
  const [metrics, setMetrics] = useState({ total_vehicles: 0, active_tasks: 0, completed_tasks: 0 });

  useEffect(() => {
    apiFetch('/dashboard/metrics')
      .then(res => res.json())
      .then(data => setMetrics(data))
      .catch(err => console.error(err));
  }, [refreshTrigger]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Total Fleet Size</h3>
        <p className="text-4xl font-extrabold text-gray-900 mt-2">{metrics.total_vehicles}</p>
      </div>

      <div className="bg-indigo-50 p-6 rounded-xl shadow-sm border border-indigo-100">
        <h3 className="text-sm font-semibold text-indigo-600 uppercase tracking-wider">Active Service Tasks</h3>
        <p className="text-4xl font-extrabold text-indigo-900 mt-2">{metrics.active_tasks}</p>
      </div>

      <div className="bg-green-50 p-6 rounded-xl shadow-sm border border-green-100">
        <h3 className="text-sm font-semibold text-green-600 uppercase tracking-wider">Completed Tasks</h3>
        <p className="text-4xl font-extrabold text-green-900 mt-2">{metrics.completed_tasks}</p>
      </div>
    </div>
  );
}
