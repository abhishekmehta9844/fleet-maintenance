import { useEffect, useState } from 'react';
import ServiceRecords from './ServiceRecords';

interface Vehicle {
  id: string;
  registration_number: string;
  make_model: string;
  current_odometer: number;
}

export default function VehicleList() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
            
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-500">Odometer</span>
              <span className="text-sm font-bold text-gray-800">{vehicle.current_odometer.toLocaleString()}</span>
            </div>
            
            {/* Renders the service history only if this specific card is clicked */}
            {expandedId === vehicle.id && <ServiceRecords vehicleId={vehicle.id} />}
          </div>
        ))}
      </div>
    </div>
  );
}