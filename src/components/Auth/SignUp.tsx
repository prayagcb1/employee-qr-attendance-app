import { UserPlus, AlertCircle } from 'lucide-react';

interface SignUpProps {
  onToggleForm: () => void;
}

export function SignUp({ onToggleForm }: SignUpProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="flex items-center justify-center mb-8">
          <div className="bg-blue-600 p-3 rounded-xl">
            <UserPlus className="w-8 h-8 text-white" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-center mb-2 text-gray-900">Create Account</h1>
        <p className="text-center text-gray-600 mb-8">Join the attendance tracking system</p>

        <div className="mb-6 p-6 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-blue-900 mb-2">Account Creation Restricted</h3>
              <p className="text-blue-800 text-sm leading-relaxed">
                Employee accounts can only be created by system administrators. Please contact your administrator
                to have an account created for you. They will provide you with your login credentials.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center">
          <p className="text-gray-600">
            Already have an account?{' '}
            <button
              onClick={onToggleForm}
              className="text-blue-600 hover:text-blue-700 font-semibold"
            >
              Sign In
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
