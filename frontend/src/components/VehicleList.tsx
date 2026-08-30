import { useEffect, useState } from 'react';
import ServiceRecords from './ServiceRecords';
import { apiFetch } from '../lib/api';

interface Vehicle {
  id: string;
  registration_number: string;
  make_model: string;
  current_odometer: number;
  last_service_odometer: number | null;
  last_service_date: string | null;
  service_interval_miles: number;
  service_interval_months: number;
  is_overdue: boolean;
  is_archived: boolean;
}

interface EditForm {
  registration_number: string;
  make_model: string;
  current_odometer: number;
  service_interval_months: number;
  service_interval_miles: number;
}

export default function VehicleList({ userRole }: { userRole: 'manager' | 'technician' }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const fetchVehicles = () => {
    apiFetch(`/vehicles/?archived=${showArchived}`)
      .then(res => res.json())
      .then(data => setVehicles(data))
      .catch(err => console.error("Error fetching vehicles:", err));
  };

  useEffect(() => {
    fetchVehicles();
  }, [showArchived]);

  const startEdit = (vehicle: Vehicle) => {
    setEditingId(vehicle.id);
    setEditForm({
      registration_number: vehicle.registration_number,
      make_model: vehicle.make_model,
      current_odometer: vehicle.current_odometer,
      service_interval_months: vehicle.service_interval_months,
      service_interval_miles: vehicle.service_interval_miles,
    });
  };

  const handleEditSubmit = async (id: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm) return;
    const response = await apiFetch(`/vehicles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(editForm),
    });
    if (response.ok) {
      setEditingId(null);
      setEditForm(null);
      fetchVehicles();
    } else {
      const error = await response.json();
      alert(error.detail || 'Could not update this vehicle.');
    }
  };

  const handleArchive = async (id: string) => {
    const response = await apiFetch(`/vehicles/${id}/archive`, { method: 'PUT' });
    if (response.ok) fetchVehicles();
  };

  const handleRestore = async (id: string) => {
    const response = await apiFetch(`/vehicles/${id}/restore`, { method: 'PUT' });
    if (response.ok) fetchVehicles();
  };

  return (
    <div className="mt-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-semibold text-gray-800">
          {showArchived ? 'Archived Vehicles' : 'Fleet Vehicles'}
        </h2>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={e => setShowArchived(e.target.checked)}
          />
          Show archived
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {vehicles.map((vehicle) => (
          <div key={vehicle.id} className={`bg-white p-6 rounded-xl shadow-sm border transition-shadow ${vehicle.is_overdue ? 'border-red-400' : 'border-gray-200 hover:shadow-md'}`}>

            {vehicle.is_overdue && (
              <div className="bg-red-100 text-red-800 text-xs font-bold px-3 py-1 rounded-full inline-block mb-3 animate-pulse">
                ⚠️ SERVICE OVERDUE
              </div>
            )}

            {editingId === vehicle.id && editForm ? (
              <form onSubmit={(e) => handleEditSubmit(vehicle.id, e)} className="space-y-2">
                <input
                  type="text"
                  required
                  className="w-full text-sm rounded-md border-gray-300 border p-1"
                  value={editForm.registration_number}
                  onChange={e => setEditForm({ ...editForm, registration_number: e.target.value })}
                />
                <input
                  type="text"
                  required
                  className="w-full text-sm rounded-md border-gray-300 border p-1"
                  value={editForm.make_model}
                  onChange={e => setEditForm({ ...editForm, make_model: e.target.value })}
                />
                <input
                  type="number"
                  required
                  className="w-full text-sm rounded-md border-gray-300 border p-1"
                  value={editForm.current_odometer}
                  onChange={e => setEditForm({ ...editForm, current_odometer: parseInt(e.target.value) || 0 })}
                />
                <div className="flex gap-2">
                  <input
                    type="number"
                    required
                    className="w-1/2 text-sm rounded-md border-gray-300 border p-1"
                    value={editForm.service_interval_months}
                    onChange={e => setEditForm({ ...editForm, service_interval_months: parseInt(e.target.value) || 0 })}
                  />
                  <input
                    type="number"
                    required
                    className="w-1/2 text-sm rounded-md border-gray-300 border p-1"
                    value={editForm.service_interval_miles}
                    onChange={e => setEditForm({ ...editForm, service_interval_miles: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button type="submit" className="text-xs bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700 transition">
                    Save
                  </button>
                  <button type="button" onClick={() => setEditingId(null)} className="text-xs bg-gray-100 text-gray-700 px-3 py-1 rounded-md hover:bg-gray-200 transition">
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{vehicle.registration_number}</h3>
                    <p className="text-gray-600">{vehicle.make_model}</p>
                  </div>
                  <button
                    onClick={() => setExpandedId(expandedId === vehicle.id ? null : vehicle.id)}
                    className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-1 rounded-md transition font-medium"
                  >
                    {expandedId === vehicle.id ? 'Close' : 'Service'}
                  </button>
                </div>

                <div className="flex justify-between items-center mt-4">
                  <span className="text-sm font-medium text-gray-500">Odometer</span>
                  <span className="text-sm font-bold text-gray-800">{vehicle.current_odometer.toLocaleString()} mi</span>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-xs font-medium text-gray-400">Interval</span>
                  <span className="text-xs text-gray-500">{vehicle.service_interval_miles.toLocaleString()} mi / {vehicle.service_interval_months} mo</span>
                </div>

                {userRole === 'manager' && (
                  <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100">
                    {vehicle.is_archived ? (
                      <button onClick={() => handleRestore(vehicle.id)} className="text-xs bg-green-600 text-white px-3 py-1 rounded-md hover:bg-green-700 transition">
                        Restore
                      </button>
                    ) : (
                      <>
                        <button onClick={() => startEdit(vehicle)} className="text-xs bg-gray-100 text-gray-700 px-3 py-1 rounded-md hover:bg-gray-200 transition">
                          Edit
                        </button>
                        <button onClick={() => handleArchive(vehicle.id)} className="text-xs bg-red-50 text-red-700 px-3 py-1 rounded-md hover:bg-red-100 transition">
                          Archive
                        </button>
                      </>
                    )}
                  </div>
                )}

                {expandedId === vehicle.id && <ServiceRecords vehicleId={vehicle.id} userRole={userRole}/>}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
