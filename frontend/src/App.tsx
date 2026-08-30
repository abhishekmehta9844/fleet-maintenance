import { useState } from 'react';
import VehicleList from './components/VehicleList';
import VehicleForm from './components/VehicleForm';
import BulkOdometerUpdate from './components/BulkOdometerUpdate';

function App() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const refreshData = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-extrabold text-blue-900 tracking-tight mb-8">
          Fleet Maintenance System
        </h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <VehicleForm onVehicleAdded={refreshData} />
          <BulkOdometerUpdate key={`bulk-${refreshTrigger}`} onUpdateComplete={refreshData} />
        </div>
        
        <VehicleList key={refreshTrigger} />
      </div>
    </div>
  )
}

export default App