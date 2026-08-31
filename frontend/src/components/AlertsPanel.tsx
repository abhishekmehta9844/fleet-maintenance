import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';

interface Vehicle {
  id: string;
  registration_number: string;
  make_model: string;
  current_odometer: number;
}

export default function AlertsPanel({ onDismiss }: { onDismiss: () => void }) {
  const [alerts, setAlerts] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = () => {
    setLoading(true);
    apiFetch('/alerts/')
      .then(res => res.json())
      .then(data => setAlerts(data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const handleDismiss = async (id: string) => {
    const response = await apiFetch(`/vehicles/${id}/dismiss-alert`, { method: 'PUT' });
    if (response.ok) {
      fetchAlerts();
      onDismiss();
    }
  };

  return (
    <div className="mt-8">
      <h2 className="text-2xl font-semibold mb-4 text-gray-800">Overdue Service Alerts</h2>

      {loading ? (
        <p className="text-sm text-gray-400">Loading alerts...</p>
      ) : alerts.length === 0 ? (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-sm text-gray-500">
          No active overdue alerts.
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map(vehicle => (
            <div key={vehicle.id} className="bg-red-50 border border-red-200 rounded-xl p-4 flex justify-between items-center">
              <div>
                <p className="font-bold text-red-900">{vehicle.registration_number}</p>
                <p className="text-sm text-red-700">{vehicle.make_model} — {vehicle.current_odometer.toLocaleString()} mi</p>
              </div>
              <button
                onClick={() => handleDismiss(vehicle.id)}
                className="text-xs bg-white border border-red-300 text-red-700 px-3 py-1.5 rounded-md hover:bg-red-100 transition"
              >
                Dismiss
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
