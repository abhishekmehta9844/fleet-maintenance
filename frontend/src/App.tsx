import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/Login';
import VehicleList from './components/VehicleList';
import VehicleForm from './components/VehicleForm';
import BulkOdometerUpdate from './components/BulkOdometerUpdate';
import FleetDashboard from './components/FleetDashboard';
import ServiceRecordSearch from './components/ServiceRecordSearch';
import AlertsPanel from './components/AlertsPanel';
import { apiFetch } from './lib/api';

function FleetApp() {
  const { user, loading, logout } = useAuth();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [activeTab, setActiveTab] = useState<'vehicles' | 'records' | 'alerts'>('vehicles');
  const [alertCount, setAlertCount] = useState(0);

  const refreshData = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  useEffect(() => {
    if (user?.role === 'manager') {
      apiFetch('/alerts/count')
        .then(res => res.json())
        .then(data => setAlertCount(data.count))
        .catch(() => {});
    }
  }, [user, refreshTrigger]);

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

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('vehicles')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === 'vehicles' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
          >
            Vehicles
          </button>
          <button
            onClick={() => setActiveTab('records')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === 'records' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
          >
            Service Records
          </button>
          {user.role === 'manager' && (
            <button
              onClick={() => setActiveTab('alerts')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition flex items-center gap-2 ${activeTab === 'alerts' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
            >
              Alerts
              {alertCount > 0 && (
                <span className="inline-flex items-center justify-center bg-red-600 text-white text-xs font-bold rounded-full h-5 min-w-[1.25rem] px-1">
                  {alertCount}
                </span>
              )}
            </button>
          )}
        </div>

        {activeTab === 'vehicles' ? (
          <>
            <FleetDashboard refreshTrigger={refreshTrigger} />

            {user.role === 'manager' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <VehicleForm onVehicleAdded={refreshData} />
                <BulkOdometerUpdate onUpdateComplete={refreshData} />
              </div>
            )}

            <VehicleList key={refreshTrigger} currentUser={user} />
          </>
        ) : activeTab === 'records' ? (
          <ServiceRecordSearch userRole={user.role} />
        ) : (
          <AlertsPanel onDismiss={refreshData} />
        )}
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
