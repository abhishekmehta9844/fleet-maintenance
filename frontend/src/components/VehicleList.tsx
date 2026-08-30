import { useEffect, useState } from 'react';

// Define the TypeScript shape based on your Pydantic response schema
interface Vehicle {
  id: string;
  registration_number: string;
  make_model: string;
  current_odometer: number;
}

export default function VehicleList() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  useEffect(() => {
    fetch('http://localhost:8000/vehicles/')
      .then(res => res.json())
      .then(data => setVehicles(data))
      .catch(err => console.error("Error fetching vehicles:", err));
  }, []);

  return (
    <div className="mt-8">
      <h2 className="text-2xl font-semibold mb-4 text-gray-800">Fleet Vehicles</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {vehicles.map((vehicle) => (
          <div key={vehicle.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            <h3 className="text-xl font-bold text-gray-900">{vehicle.registration_number}</h3>
            <p className="text-gray-600 mb-4">{vehicle.make_model}</p>
            <div className="pt-4 border-t border-gray-100 flex justify-between items-center">
              <span className="text-sm font-medium text-gray-500">Current Odometer</span>
              <span className="text-sm font-bold text-gray-800">{vehicle.current_odometer.toLocaleString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}