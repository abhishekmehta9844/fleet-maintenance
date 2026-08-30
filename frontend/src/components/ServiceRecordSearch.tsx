import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';

interface ServiceRecord {
  id: string;
  vehicle_id: string;
  vehicle_registration_number: string | null;
  status: string;
  description: string;
  scheduled_date: string | null;
  updated_at: string;
}

interface Vehicle {
  id: string;
  registration_number: string;
}

interface Technician {
  id: string;
  email: string;
}

const PAGE_SIZE = 10;

export default function ServiceRecordSearch({ userRole }: { userRole: 'manager' | 'technician' }) {
  const [records, setRecords] = useState<ServiceRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [technicianFilter, setTechnicianFilter] = useState('');
  const [sortBy, setSortBy] = useState('updated_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);

  useEffect(() => {
    apiFetch('/vehicles/').then(res => res.json()).then(setVehicles).catch(() => {});
    if (userRole === 'manager') {
      apiFetch('/technicians/').then(res => res.json()).then(setTechnicians).catch(() => {});
    }
  }, [userRole]);

  useEffect(() => {
    setPage(0);
  }, [search, vehicleFilter, statusFilter, technicianFilter, sortBy, sortOrder]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (vehicleFilter) params.set('vehicle_id', vehicleFilter);
    if (statusFilter) params.set('status', statusFilter);
    if (technicianFilter) params.set('technician_id', technicianFilter);
    params.set('sort_by', sortBy);
    params.set('sort_order', sortOrder);
    params.set('skip', String(page * PAGE_SIZE));
    params.set('limit', String(PAGE_SIZE));

    apiFetch(`/service-records/?${params.toString()}`)
      .then(res => res.json())
      .then(data => {
        setRecords(data.items);
        setTotal(data.total);
      })
      .catch(err => console.error(err));
  }, [search, vehicleFilter, statusFilter, technicianFilter, sortBy, sortOrder, page]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Due': return 'bg-yellow-100 text-yellow-800';
      case 'Booked': return 'bg-blue-100 text-blue-800';
      case 'In Service': return 'bg-purple-100 text-purple-800';
      case 'Completed': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mt-8">
      <h2 className="text-2xl font-semibold mb-4 text-gray-800">Service Records</h2>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-4 flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Search descriptions..."
          className="flex-1 min-w-[160px] text-sm rounded-md border-gray-300 border px-2 py-1"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        <select value={vehicleFilter} onChange={e => setVehicleFilter(e.target.value)} className="text-sm rounded-md border-gray-300 border px-2 py-1">
          <option value="">All vehicles</option>
          {vehicles.map(v => (
            <option key={v.id} value={v.id}>{v.registration_number}</option>
          ))}
        </select>

        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="text-sm rounded-md border-gray-300 border px-2 py-1">
          <option value="">All statuses</option>
          <option value="Due">Due</option>
          <option value="Booked">Booked</option>
          <option value="In Service">In Service</option>
          <option value="Completed">Completed</option>
        </select>

        {userRole === 'manager' && (
          <select value={technicianFilter} onChange={e => setTechnicianFilter(e.target.value)} className="text-sm rounded-md border-gray-300 border px-2 py-1">
            <option value="">All technicians</option>
            {technicians.map(t => (
              <option key={t.id} value={t.id}>{t.email.split('@')[0]}</option>
            ))}
          </select>
        )}

        <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="text-sm rounded-md border-gray-300 border px-2 py-1">
          <option value="updated_at">Last updated</option>
          <option value="scheduled_date">Scheduled date</option>
          <option value="status">Status</option>
        </select>

        <select value={sortOrder} onChange={e => setSortOrder(e.target.value)} className="text-sm rounded-md border-gray-300 border px-2 py-1">
          <option value="desc">Descending</option>
          <option value="asc">Ascending</option>
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-4 py-2">Vehicle</th>
              <th className="px-4 py-2">Description</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Scheduled</th>
              <th className="px-4 py-2">Last Updated</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">No matching service records.</td></tr>
            ) : records.map(record => (
              <tr key={record.id} className="border-t border-gray-100">
                <td className="px-4 py-2 font-medium text-gray-800">{record.vehicle_registration_number || '—'}</td>
                <td className="px-4 py-2 text-gray-600 truncate max-w-xs">{record.description}</td>
                <td className="px-4 py-2">
                  <span className={`text-xs font-semibold rounded-md px-2 py-1 ${getStatusColor(record.status)}`}>{record.status}</span>
                </td>
                <td className="px-4 py-2 text-gray-500">{record.scheduled_date ? new Date(record.scheduled_date).toLocaleDateString() : '—'}</td>
                <td className="px-4 py-2 text-gray-500">{new Date(record.updated_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center mt-4 text-sm text-gray-600">
        <span>{total} match{total === 1 ? '' : 'es'}</span>
        <div className="flex items-center gap-2">
          <button
            disabled={page === 0}
            onClick={() => setPage(p => Math.max(0, p - 1))}
            className="px-3 py-1 rounded-md bg-gray-100 disabled:opacity-40 hover:bg-gray-200 transition"
          >
            Prev
          </button>
          <span>Page {page + 1} of {totalPages}</span>
          <button
            disabled={page + 1 >= totalPages}
            onClick={() => setPage(p => p + 1)}
            className="px-3 py-1 rounded-md bg-gray-100 disabled:opacity-40 hover:bg-gray-200 transition"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
