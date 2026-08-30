import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';

interface Vehicle {
  id: string;
  registration_number: string;
  current_odometer: number;
}

export default function BulkOdometerUpdate({ onUpdateComplete }: { onUpdateComplete: () => void }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [odometerValues, setOdometerValues] = useState<Record<string, number>>({});

  useEffect(() => {
    apiFetch('/vehicles/')
      .then(res => res.json())
      .then(data => {
        setVehicles(data);
        const initialValues: Record<string, number> = {};
        data.forEach((v: Vehicle) => {
          initialValues[v.id] = v.current_odometer;
        });
        setOdometerValues(initialValues);
      })
      .catch(err => console.error(err));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const updates = vehicles
      .filter(v => odometerValues[v.id] > v.current_odometer)
      .map(v => ({
        id: v.id,
        new_odometer: odometerValues[v.id]
      }));

    if (updates.length === 0) {
      alert("No new odometer readings to update.");
      return;
    }

    const response = await apiFetch('/vehicles/bulk-odometer/', {
      method: 'PUT',
      body: JSON.stringify({ updates }),
    });

    if (response.ok) {
      const result = await response.json();
      alert(`Successfully updated ${result.updated_count} vehicles!`);
      onUpdateComplete();
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8">
      <h2 className="text-xl font-semibold mb-4 text-gray-800">Bulk Odometer Update</h2>
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-3 mb-4 max-h-48 overflow-y-auto pr-2">
          {vehicles.map(vehicle => (
            <div key={vehicle.id} className="flex justify-between items-center bg-gray-50 p-2 rounded border border-gray-100">
              <span className="font-medium text-gray-700">{vehicle.registration_number}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Current: {vehicle.current_odometer}</span>
                <input
                  type="number"
                  min={vehicle.current_odometer}
                  value={odometerValues[vehicle.id] || ''}
                  onChange={e => setOdometerValues({...odometerValues, [vehicle.id]: parseInt(e.target.value) || 0})}
                  className="w-28 rounded-md border-gray-300 border px-2 py-1 text-sm text-right"
                />
              </div>
            </div>
          ))}
        </div>
        <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition w-full">
          Save All Updates
        </button>
      </form>
    </div>
  );
}
