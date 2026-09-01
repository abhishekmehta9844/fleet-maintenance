import { useState } from 'react';
import { API_BASE } from '../lib/api';

interface RowResult {
  row: number;
  registration_number: string;
  status: 'success' | 'rejected';
  reason: string | null;
}

interface UploadSummary {
  total_rows: number;
  success_count: number;
  rejected_count: number;
  results: RowResult[];
}

export default function BulkOdometerUpdate({ onUpdateComplete }: { onUpdateComplete: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<UploadSummary | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setSummary(null);

    const formData = new FormData();
    formData.append('file', file);

    const token = localStorage.getItem('fleet_token');
    try {
      const response = await fetch(`${API_BASE}/vehicles/bulk-odometer-csv/`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (response.ok) {
        const data: UploadSummary = await response.json();
        setSummary(data);
        onUpdateComplete();
      } else {
        const error = await response.json();
        alert(error.detail || 'Could not process this file.');
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8">
      <h2 className="text-xl font-semibold mb-2 text-gray-800">Bulk Odometer Update (CSV)</h2>
      <p className="text-xs text-gray-500 mb-4">
        CSV must have two columns: <code className="bg-gray-100 px-1 rounded">registration_number</code> and <code className="bg-gray-100 px-1 rounded">odometer</code>.
      </p>

      <form onSubmit={handleUpload} className="flex items-center gap-3 mb-4">
        <input
          type="file"
          accept=".csv"
          onChange={e => setFile(e.target.files?.[0] || null)}
          className="text-sm"
        />
        <button
          type="submit"
          disabled={!file || uploading}
          className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition text-sm"
        >
          {uploading ? 'Uploading...' : 'Upload CSV'}
        </button>
      </form>

      {summary && (
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">
            {summary.success_count} succeeded, {summary.rejected_count} rejected out of {summary.total_rows} rows.
          </p>
          <div className="max-h-56 overflow-y-auto border border-gray-100 rounded-md">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-left text-gray-500 uppercase">
                <tr>
                  <th className="px-3 py-1">Row</th>
                  <th className="px-3 py-1">Registration</th>
                  <th className="px-3 py-1">Result</th>
                </tr>
              </thead>
              <tbody>
                {summary.results.map(r => (
                  <tr key={r.row} className="border-t border-gray-100">
                    <td className="px-3 py-1">{r.row}</td>
                    <td className="px-3 py-1">{r.registration_number}</td>
                    <td className={`px-3 py-1 ${r.status === 'success' ? 'text-green-700' : 'text-red-700'}`}>
                      {r.status === 'success' ? 'Updated' : r.reason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
