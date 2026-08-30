import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/Login';
import VehicleList from './components/VehicleList';
import VehicleForm from './components/VehicleForm';
import BulkOdometerUpdate from './components/BulkOdometerUpdate';
import FleetDashboard from './components/FleetDashboard';

function FleetApp() {
  const { user, loading, logout } = useAuth();
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const refreshData = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading…</div>;
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-extrabold text-blue-900 tracking-tight">
            Fleet Maintenance System
          </h1>
          <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-lg shadow-sm border border-gray-200">
            <span className="text-sm font-medium text-gray-700">{user.email} · {user.role}</span>
            <button onClick={logout} className="text-sm text-red-600 hover:text-red-700 font-medium">
              Sign out
            </button>
          </div>
        </div>

        <FleetDashboard refreshTrigger={refreshTrigger} />

        {user.role === 'manager' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <VehicleForm onVehicleAdded={refreshData} />
            <BulkOdometerUpdate key={`bulk-${refreshTrigger}`} onUpdateComplete={refreshData} />
          </div>
        )}

        <VehicleList key={refreshTrigger} userRole={user.role} />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <FleetApp />
    </AuthProvider>
  );
}
