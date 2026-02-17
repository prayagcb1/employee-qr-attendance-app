import { useState, useEffect } from 'react';
import { User, Mail, Briefcase, X, Phone, Camera } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface UserProfileProps {
  employeeId: string;
  onClose: () => void;
}

interface EmployeeProfile {
  full_name: string;
  username: string | null;
  email: string | null;
  phone: string | null;
  role: string;
}

const roleLabels: Record<string, string> = {
  admin: 'Administrator',
  manager: 'Manager',
  field_supervisor: 'Field Supervisor',
  field_worker: 'Field Worker',
  office_employee: 'Office Employee',
  intern: 'Intern'
};

export function UserProfile({ employeeId, onClose }: UserProfileProps) {
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
  }, [employeeId]);

  const fetchProfile = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('employees')
      .select(`
        full_name,
        username,
        email,
        phone,
        role
      `)
      .eq('id', employeeId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching profile:', error);
    }

    if (data) {
      setProfile(data);
    }

    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between rounded-t-xl">
          <h2 className="text-xl font-bold text-white">User Profile</h2>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-500">Loading profile...</p>
            </div>
          ) : profile ? (
            <div className="space-y-6">
              <div className="flex flex-col items-center mb-6">
                <div className="relative group cursor-pointer">
                  <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-3xl font-bold shadow-lg">
                    {profile.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="text-center">
                      <Camera className="w-6 h-6 text-white mx-auto mb-1" />
                      <p className="text-xs text-white font-medium">Add Photo</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {profile.username && (
                  <div className="flex items-center gap-3 text-gray-700 pb-4 border-b border-gray-200">
                    <User className="w-5 h-5 text-gray-500 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs text-gray-500 font-medium mb-1">Login Username</p>
                      <p className="text-base font-semibold text-gray-900">{profile.username}</p>
                    </div>
                  </div>
                )}

                {profile.phone && (
                  <div className="flex items-center gap-3 text-gray-700 pb-4 border-b border-gray-200">
                    <Phone className="w-5 h-5 text-gray-500 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs text-gray-500 font-medium mb-1">Phone Number</p>
                      <p className="text-base font-semibold text-gray-900">{profile.phone}</p>
                    </div>
                  </div>
                )}

                {profile.email && (
                  <div className="flex items-center gap-3 text-gray-700 pb-4 border-b border-gray-200">
                    <Mail className="w-5 h-5 text-gray-500 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs text-gray-500 font-medium mb-1">Email ID</p>
                      <p className="text-base font-semibold text-gray-900 break-all">{profile.email}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 text-gray-700">
                  <Briefcase className="w-5 h-5 text-gray-500 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 font-medium mb-1">Role</p>
                    <p className="text-base font-semibold text-gray-900">{roleLabels[profile.role] || profile.role}</p>
                  </div>
                </div>
              </div>

              <button
                onClick={onClose}
                className="w-full mt-6 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium shadow-sm"
              >
                Close
              </button>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <User className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <p>Profile not found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
