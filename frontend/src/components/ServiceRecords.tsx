import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';

interface Technician {
  id: string;
  email: string;
}

interface ServiceRecord {
  id: string;
  status: string;
  description: string;
  technicians: Technician[];
}

interface CurrentUser {
  id: string;
  email: string;
  role: 'manager' | 'technician';
}

interface TimelineEntry {
  id: string;
  action_type: string;
  old_value: string | null;
  new_value: string | null;
  actor_email: string | null;
  created_at: string;
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

function Timeline({ recordId, canAddNote, onNoteAdded }: { recordId: string; canAddNote: boolean; onNoteAdded: () => void }) {
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [noteText, setNoteText] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchTimeline = () => {
    apiFetch(`/service-records/${recordId}/timeline`)
      .then(res => res.json())
      .then(data => setEntries(data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTimeline();
  }, [recordId]);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    const response = await apiFetch(`/service-records/${recordId}/notes`, {
      method: 'POST',
      body: JSON.stringify({ text: noteText }),
    });
    if (response.ok) {
      setNoteText('');
      fetchTimeline();
      onNoteAdded();
    }
  };

  const describeEntry = (entry: TimelineEntry) => {
    switch (entry.action_type) {
      case 'CREATED':
        return 'Record created';
      case 'STATUS_CHANGE':
        return `Status changed: ${entry.old_value} → ${entry.new_value}`;
      case 'ASSIGNED':
        return `Assigned to ${entry.new_value}`;
      case 'UNASSIGNED':
        return `Unassigned from ${entry.old_value}`;
      case 'NOTE':
        return `Note: ${entry.new_value}`;
      default:
        return entry.action_type;
    }
  };

  return (
    <div className="mt-2 pt-2 border-t border-dashed border-gray-200">
      {loading ? (
        <p className="text-xs text-gray-400">Loading timeline...</p>
      ) : entries.length === 0 ? (
        <p className="text-xs text-gray-400">No timeline entries yet.</p>
      ) : (
        <ul className="space-y-1 max-h-40 overflow-y-auto pr-1">
          {entries.map(entry => (
            <li key={entry.id} className="text-xs text-gray-600">
              <span className="text-gray-400">{new Date(entry.created_at).toLocaleString()}</span>
              {' — '}
              {describeEntry(entry)}
              {entry.actor_email && <span className="text-gray-400"> ({entry.actor_email.split('@')[0]})</span>}
            </li>
          ))}
        </ul>
      )}

      {canAddNote && (
        <form onSubmit={handleAddNote} className="flex gap-2 mt-2">
          <input
            type="text"
            placeholder="Add a note..."
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            className="flex-1 text-xs rounded-md border-gray-300 border px-2 py-1"
          />
          <button type="submit" className="text-xs bg-gray-800 text-white px-2 py-1 rounded-md hover:bg-gray-900 transition">
            Add
          </button>
        </form>
      )}
    </div>
  );
}

export default function ServiceRecords({ vehicleId, currentUser }: { vehicleId: string; currentUser: CurrentUser }) {
  const [records, setRecords] = useState<ServiceRecord[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [description, setDescription] = useState('');
  const [bookingDates, setBookingDates] = useState<Record<string, string>>({});
  const [timelineOpenId, setTimelineOpenId] = useState<string | null>(null);

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
      fetchRecords();
    } else {
      const error = await response.json();
      alert(error.detail || 'Could not assign this technician.');
    }
  };

  const handleUnassign = async (recordId: string, technicianId: string) => {
    const response = await apiFetch(`/service-records/${recordId}/assign/${technicianId}`, {
      method: 'DELETE',
    });
    if (response.ok) {
      fetchRecords();
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
          const isAssignedTechnician = currentUser.role === 'technician' && record.technicians.some(t => t.id === currentUser.id);
          const canAddNote = currentUser.role === 'manager' || isAssignedTechnician;
          const showTimeline = timelineOpenId === record.id;

          return (
            <li key={record.id} className="text-sm flex flex-col gap-2 bg-gray-50 p-3 rounded border border-gray-100 shadow-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-700 font-medium truncate mr-2">{record.description}</span>
                <span className={`text-xs font-semibold rounded-md px-2 py-1 ${getStatusColor(record.status)}`}>
                  {record.status}
                </span>
              </div>

              {record.technicians.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {record.technicians.map(t => (
                    <span key={t.id} className="text-xs bg-white border border-gray-200 rounded-full px-2 py-0.5 flex items-center gap-1">
                      {t.email.split('@')[0]}
                      {currentUser.role === 'manager' && (
                        <button onClick={() => handleUnassign(record.id, t.id)} className="text-gray-400 hover:text-red-600">×</button>
                      )}
                    </span>
                  ))}
                </div>
              )}

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

              {currentUser.role === 'manager' && (
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

              <div className="flex justify-between items-center border-t border-gray-200 pt-2 mt-1">
                <button
                  onClick={() => setTimelineOpenId(showTimeline ? null : record.id)}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  {showTimeline ? 'Hide timeline' : 'View timeline'}
                </button>
              </div>

              {showTimeline && (
                <Timeline recordId={record.id} canAddNote={canAddNote} onNoteAdded={fetchRecords} />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
