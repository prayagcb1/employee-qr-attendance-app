import { useState, useEffect } from 'react';
import { User, Mail, Briefcase, Calendar, MapPin, Hash, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface UserProfileProps {
  employeeId: string;
  onClose: () => void;
}

interface EmployeeProfile {
  full_name: string;
  employee_code: string;
  email: string | null;
  role: string;
  site_id: string | null;
  date_of_joining: string | null;
  site?: {
    name: string;
    location: string;
  } | null;
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
        employee_code,
        email,
        role,
        site_id,
        date_of_joining,
        sites (
          name,
          location
        )
      `)
      .eq('id', employeeId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching profile:', error);
    }

    if (data) {
      setProfile({
        ...data,
        site: data.sites as any
      });
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
            <div className="space-y-4">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-lg flex-shrink-0">
                  {profile.full_name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-bold text-gray-900 truncate">{profile.full_name}</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {roleLabels[profile.role] || profile.role}
                  </p>
                </div>
              </div>

              <div className="space-y-3 bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-3 text-gray-700">
                  <Hash className="w-5 h-5 text-gray-500 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Employee Code</p>
                    <p className="text-sm font-semibold">{profile.employee_code}</p>
                  </div>
                </div>

                {profile.email && (
                  <div className="flex items-center gap-3 text-gray-700 pt-3 border-t border-gray-200">
                    <Mail className="w-5 h-5 text-gray-500 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500 font-medium">Email</p>
                      <p className="text-sm font-semibold break-all">{profile.email}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 text-gray-700 pt-3 border-t border-gray-200">
                  <Briefcase className="w-5 h-5 text-gray-500 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Role</p>
                    <p className="text-sm font-semibold">{roleLabels[profile.role] || profile.role}</p>
                  </div>
                </div>

                {profile.site && (
                  <div className="flex items-center gap-3 text-gray-700 pt-3 border-t border-gray-200">
                    <MapPin className="w-5 h-5 text-gray-500 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500 font-medium">Site</p>
                      <p className="text-sm font-semibold">{profile.site.name}</p>
                      <p className="text-xs text-gray-600">{profile.site.location}</p>
                    </div>
                  </div>
                )}

                {profile.date_of_joining && (
                  <div className="flex items-center gap-3 text-gray-700 pt-3 border-t border-gray-200">
                    <Calendar className="w-5 h-5 text-gray-500 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500 font-medium">Date of Joining</p>
                      <p className="text-sm font-semibold">
                        {new Date(profile.date_of_joining).toLocaleDateString('en-US', {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={onClose}
                className="w-full mt-6 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
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
