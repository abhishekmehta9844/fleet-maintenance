import { useEffect, useState } from 'react';
import ServiceRecords from './ServiceRecords';

interface Vehicle {
  id: string;
  registration_number: string;
  make_model: string;
  current_odometer: number;
  last_service_odometer: number | null;
  last_service_date: string | null;
  service_interval_miles: number;
  service_interval_months: number;
}

export default function VehicleList({ userRole }: { userRole: 'manager' | 'technician' }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetch('http://127.0.0.1:8000/vehicles/')
      .then(res => res.json())
      .then(data => setVehicles(data))
      .catch(err => console.error("Error fetching vehicles:", err));
  }, []);

  const isOverdue = (vehicle: Vehicle) => {
    // Check miles
    if (vehicle.last_service_odometer !== null) {
      if ((vehicle.current_odometer - vehicle.last_service_odometer) >= vehicle.service_interval_miles) {
        return true;
      }
    } else if (vehicle.current_odometer >= vehicle.service_interval_miles) {
      // If never serviced, check if current miles exceed the interval entirely
      return true;
    }

    // Check months
    if (vehicle.last_service_date) {
      const lastService = new Date(vehicle.last_service_date);
      const monthsSince = (new Date().getTime() - lastService.getTime()) / (1000 * 60 * 60 * 24 * 30);
      if (monthsSince >= vehicle.service_interval_months) {
        return true;
      }
    }
    return false;
  };

  return (
    <div className="mt-8">
      <h2 className="text-2xl font-semibold mb-4 text-gray-800">Fleet Vehicles</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {vehicles.map((vehicle) => (
          <div key={vehicle.id} className={`bg-white p-6 rounded-xl shadow-sm border transition-shadow ${isOverdue(vehicle) ? 'border-red-400' : 'border-gray-200 hover:shadow-md'}`}>
            
            {/* OVERDUE BANNER */}
            {isOverdue(vehicle) && (
              <div className="bg-red-100 text-red-800 text-xs font-bold px-3 py-1 rounded-full inline-block mb-3 animate-pulse">
                ⚠️ SERVICE OVERDUE
              </div>
            )}

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
            
            {expandedId === vehicle.id && <ServiceRecords vehicleId={vehicle.id} userRole={userRole}/>}
          </div>
        ))}
      </div>
    </div>
  );
}