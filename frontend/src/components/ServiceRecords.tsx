import { useEffect, useState } from 'react';

interface ServiceRecord {
  id: string;
  status: string;
  description: string;
}

export default function ServiceRecords({ vehicleId }: { vehicleId: string }) {
  const [records, setRecords] = useState<ServiceRecord[]>([]);
  const [description, setDescription] = useState('');

  const fetchRecords = () => {
    fetch(`http://localhost:8000/vehicles/${vehicleId}/service-records/`)
      .then(res => res.json())
      .then(data => setRecords(data))
      .catch(err => console.error(err));
  };

  useEffect(() => {
    fetchRecords();
  }, [vehicleId]);

  const handleAddRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    const response = await fetch('http://localhost:8000/service-records/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vehicle_id: vehicleId,
        description: description
      })
    });
    
    if (response.ok) {
      setDescription('');
      fetchRecords(); // Refresh the list instantly
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
        <button type="submit" className="bg-green-600 text-white px-3 py-1 rounded-md text-sm hover:bg-green-700 transition">
          Schedule
        </button>
      </form>

      <ul className="space-y-2 max-h-40 overflow-y-auto pr-1">
        {records.length === 0 ? <li className="text-xs text-gray-500">No records found.</li> : null}
        {records.map(record => (
          <li key={record.id} className="text-sm flex justify-between items-center bg-gray-50 p-2 rounded border border-gray-100">
            <span className="text-gray-700 truncate mr-2">{record.description}</span>
            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-md text-xs font-semibold shrink-0">
              {record.status}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}