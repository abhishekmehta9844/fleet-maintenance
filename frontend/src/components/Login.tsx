import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
    } catch {
      setError('Incorrect email or password');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-blue-900 mb-6">Fleet Maintenance</h1>
        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
        <label className="block text-sm font-medium text-gray-700">Email</label>
        <input
          type="email"
          required
          className="mt-1 mb-4 block w-full rounded-md border-gray-300 border p-2"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <label className="block text-sm font-medium text-gray-700">Password</label>
        <input
          type="password"
          required
          className="mt-1 mb-6 block w-full rounded-md border-gray-300 border p-2"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition w-full">
          Sign in
        </button>
      </form>
    </div>
  );
}
