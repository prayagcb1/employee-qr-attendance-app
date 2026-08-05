import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { LogIn, Eye, EyeOff, Users, User } from 'lucide-react';

interface LoginProps {
  onToggleForm: () => void;
}

export function Login({ onToggleForm }: LoginProps) {
  const [loginType, setLoginType] = useState<'employee' | 'community'>('employee');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { signIn, signInCommunityUser } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (loginType === 'employee') {
        await signIn(username, password);
      } else {
        await signInCommunityUser(email, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="flex items-center justify-center mb-8">
          <div className="bg-blue-600 p-3 rounded-xl">
            <LogIn className="w-8 h-8 text-white" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-center mb-2 text-gray-900">Welcome Back</h1>
        <p className="text-center text-gray-600 mb-6">Sign in to your account</p>

        {/* Login type toggle */}
        <div className="flex gap-2 mb-6 p-1 bg-gray-100 rounded-lg">
          <button
            type="button"
            onClick={() => { setLoginType('employee'); setError(''); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md font-medium text-sm transition ${
              loginType === 'employee' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600'
            }`}
          >
            <User className="w-4 h-4" />
            Employee
          </button>
          <button
            type="button"
            onClick={() => { setLoginType('community'); setError(''); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md font-medium text-sm transition ${
              loginType === 'community' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600'
            }`}
          >
            <Users className="w-4 h-4" />
            Community User
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {loginType === 'employee' ? (
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition bg-white text-gray-900"
                placeholder="your-username"
              />
            </div>
          ) : (
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition bg-white text-gray-900"
                placeholder="you@example.com"
              />
            </div>
          )}

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition bg-white text-gray-900"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {loginType === 'employee' && (
          <div className="mt-6 text-center">
            <p className="text-gray-600">
              Don't have an account?{' '}
              <button
                onClick={onToggleForm}
                className="text-blue-600 hover:text-blue-700 font-semibold"
              >
                Sign Up
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
