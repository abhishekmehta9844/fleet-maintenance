import { useState } from 'react';
import VehicleList from './components/VehicleList';
import VehicleForm from './components/VehicleForm';
import BulkOdometerUpdate from './components/BulkOdometerUpdate';
import FleetDashboard from './components/FleetDashboard';

function App() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [role, setRole] = useState<'manager' | 'technician'>('manager');

  const refreshData = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Header & Role Switcher */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-extrabold text-blue-900 tracking-tight">
            Fleet Maintenance System
          </h1>
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow-sm border border-gray-200">
            <span className="text-sm font-medium text-gray-500">View as:</span>
            <select 
              value={role} 
              onChange={e => setRole(e.target.value as 'manager' | 'technician')}
              className="text-sm font-bold text-gray-800 bg-transparent border-none cursor-pointer focus:ring-0"
            >
              <option value="manager">Fleet Manager</option>
              <option value="technician">Technician</option>
            </select>
          </div>
        </div>
        
        <FleetDashboard refreshTrigger={refreshTrigger} />
        
        {/* Manager-Only Tools */}
        {role === 'manager' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <VehicleForm onVehicleAdded={refreshData} />
            <BulkOdometerUpdate key={`bulk-${refreshTrigger}`} onUpdateComplete={refreshData} />
          </div>
        )}
        
        {/* Pass the role down to the vehicle list */}
        <VehicleList key={refreshTrigger} userRole={role} />
      </div>
    </div>
  )
}

export default App