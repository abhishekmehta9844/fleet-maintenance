import { useState } from 'react';
import VehicleList from './components/VehicleList';
import VehicleForm from './components/VehicleForm';

function App() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleVehicleAdded = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-extrabold text-blue-900 tracking-tight mb-8">
          Fleet Maintenance System
        </h1>
        
        <VehicleForm onVehicleAdded={handleVehicleAdded} />
        <VehicleList key={refreshTrigger} />
      </div>
    </div>
  )
}

export default App