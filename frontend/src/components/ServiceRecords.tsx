import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';

interface ServiceRecord {
  id: string;
  status: string;
  description: string;
}

interface Technician {
  id: string;
  email: string;
}

const NEXT_STATUS: Record<string, string> = {
  'Due': 'Booked',
  'Booked': 'In Service',
  'In Service': 'Completed',
};

const NEXT_ACTION_LABEL: Record<string, string> = {
  'Due': 'Book Service',
  'Booked': 'Start Service',
  'In Service': 'Mark Completed',
};

export default function ServiceRecords({ vehicleId, userRole }: { vehicleId: string, userRole: 'manager' | 'technician' }) {
  const [records, setRecords] = useState<ServiceRecord[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [description, setDescription] = useState('');
  const [bookingDates, setBookingDates] = useState<Record<string, string>>({});

  const fetchRecords = () => {
    apiFetch(`/vehicles/${vehicleId}/service-records/`)
      .then(res => res.json())
      .then(data => setRecords(data))
      .catch(err => console.error(err));
  };

  const fetchTechnicians = () => {
    apiFetch('/technicians/')
      .then(res => res.json())
      .then(data => setTechnicians(data))
      .catch(err => console.error(err));
  };

  useEffect(() => {
    fetchRecords();
    fetchTechnicians();
  }, [vehicleId]);

  const handleAddRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    const response = await apiFetch('/service-records/', {
      method: 'POST',
      body: JSON.stringify({
        vehicle_id: vehicleId,
        description: description
      })
    });

    if (response.ok) {
      setDescription('');
      fetchRecords();
    }
  };

  const handleAdvance = async (record: ServiceRecord) => {
    const nextStatus = NEXT_STATUS[record.status];
    if (!nextStatus) return;

    const body: Record<string, string> = { status: nextStatus };
    if (record.status === 'Due') {
      body.scheduled_date = bookingDates[record.id];
    }

    const response = await apiFetch(`/service-records/${record.id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });

    if (response.ok) {
      fetchRecords();
    } else {
      const error = await response.json();
      alert(error.detail || 'Could not update this service record.');
    }
  };

  const handleAssign = async (recordId: string, techId: string) => {
    if (!techId) return;
    const response = await apiFetch(`/service-records/${recordId}/assign`, {
      method: 'POST',
      body: JSON.stringify({ technician_id: techId }),
    });

    if (response.ok) {
      const result = await response.json();
      alert(result.status);
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'Due': return 'bg-yellow-100 text-yellow-800';
      case 'Booked': return 'bg-blue-100 text-blue-800';
      case 'In Service': return 'bg-purple-100 text-purple-800';
      case 'Completed': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="mt-4 pt-4 border-t border-gray-200">
      <h4 className="text-sm font-bold text-gray-700 mb-3">Service History</h4>

      <form onSubmit={handleAddRecord} className="flex gap-2 mb-4">
        <input
          type="text"
          required
          placeholder="New task description..."
          className="flex-1 rounded-md border-gray-300 border px-2 py-1 text-sm"
          value={description}
          onChange={e => setDescription(e.target.value)}
        />
        <button type="submit" className="bg-gray-800 text-white px-3 py-1 rounded-md text-sm hover:bg-gray-900 transition">
          Add
        </button>
      </form>

      <ul className="space-y-2 max-h-64 overflow-y-auto pr-1">
        {records.length === 0 ? <li className="text-xs text-gray-500">No records found.</li> : null}
        {records.map(record => {
          const nextStatus = NEXT_STATUS[record.status];
          return (
            <li key={record.id} className="text-sm flex flex-col gap-2 bg-gray-50 p-3 rounded border border-gray-100 shadow-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-700 font-medium truncate mr-2">{record.description}</span>
                <span className={`text-xs font-semibold rounded-md px-2 py-1 ${getStatusColor(record.status)}`}>
                  {record.status}
                </span>
              </div>

              {nextStatus && (
                <div className="flex items-center gap-2 border-t border-gray-200 pt-2 mt-1">
                  {record.status === 'Due' && (
                    <input
                      type="date"
                      value={bookingDates[record.id] || ''}
                      onChange={e => setBookingDates({ ...bookingDates, [record.id]: e.target.value })}
                      className="text-xs rounded-md border border-gray-300 px-2 py-1"
                    />
                  )}
                  <button
                    onClick={() => handleAdvance(record)}
                    disabled={record.status === 'Due' && !bookingDates[record.id]}
                    className="text-xs bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-3 py-1 rounded-md hover:bg-gray-900 transition"
                  >
                    {NEXT_ACTION_LABEL[record.status]}
                  </button>
                </div>
              )}

              {userRole === 'manager' && (
                <div className="flex justify-between items-center border-t border-gray-200 pt-2 mt-1">
                  <span className="text-xs text-gray-500">Assign Technician:</span>
                  <select
                    onChange={(e) => {
                      handleAssign(record.id, e.target.value);
                      e.target.value = "";
                    }}
                    defaultValue=""
                    className="text-xs rounded-md border border-gray-300 px-2 py-1 bg-white cursor-pointer hover:bg-gray-50"
                  >
                    <option value="" disabled>+ Select Tech</option>
                    {technicians.map(tech => (
                      <option key={tech.id} value={tech.id}>{tech.email.split('@')[0]}</option>
                    ))}
                  </select>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
