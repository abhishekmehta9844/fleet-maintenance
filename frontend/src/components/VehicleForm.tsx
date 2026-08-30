import { useState } from 'react';

export default function VehicleForm({ onVehicleAdded }: { onVehicleAdded: () => void }) {
  const [formData, setFormData] = useState({
    registration_number: '',
    make_model: '',
    current_odometer: 0,
    service_interval_months: 6,
    service_interval_miles: 5000,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('http://localhost:8000/vehicles/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setFormData({
          registration_number: '',
          make_model: '',
          current_odometer: 0,
          service_interval_months: 6,
          service_interval_miles: 5000,
        });
        onVehicleAdded(); // Tell the list to refresh
      } else {
        alert("Error adding vehicle. Check if registration already exists.");
      }
    } catch (error) {
      console.error("Failed to submit", error);
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8">
      <h2 className="text-xl font-semibold mb-4 text-gray-800">Add New Vehicle</h2>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Registration Number</label>
          <input type="text" required className="mt-1 block w-full rounded-md border-gray-300 border p-2"
            value={formData.registration_number}
            onChange={e => setFormData({...formData, registration_number: e.target.value})} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Make & Model</label>
          <input type="text" required className="mt-1 block w-full rounded-md border-gray-300 border p-2"
            value={formData.make_model}
            onChange={e => setFormData({...formData, make_model: e.target.value})} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Current Odometer</label>
          <input type="number" required className="mt-1 block w-full rounded-md border-gray-300 border p-2"
            value={formData.current_odometer}
            onChange={e => setFormData({...formData, current_odometer: parseInt(e.target.value)})} />
        </div>
        <div className="md:col-span-2 pt-4">
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition">
            Add Vehicle
          </button>
        </div>
      </form>
    </div>
  );
}