import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { User, Mail, Phone, Shield, Plus, Edit, KeyRound, Trash2 } from 'lucide-react';

interface Employee {
  id: string;
  user_id: string | null;
  employee_code: string;
  full_name: string;
  username: string;
  email: string;
  phone: string | null;
  role: 'field_supervisor' | 'manager' | 'field_worker' | 'admin' | 'intern' | 'office_employee';
  active: boolean;
  created_at: string;
  date_of_joining: string;
}

export function EmployeeManagement() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [formData, setFormData] = useState({
    full_name: '',
    employee_code: '',
    username: '',
    email: '',
    phone: '',
    password: '',
    date_of_joining: new Date().toISOString().split('T')[0],
    role: 'field_worker' as 'field_supervisor' | 'manager' | 'field_worker' | 'admin' | 'intern' | 'office_employee',
  });
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setEmployees(data);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedEmployee) {
      const password = formData.password || formData.phone || `Temp${Math.random().toString(36).substring(2, 10)}@1`;

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-employee`;

      const { data: session } = await supabase.auth.getSession();

      if (!session.session) {
        setError('You must be logged in to create employees');
        return;
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          full_name: formData.full_name,
          employee_code: formData.employee_code,
          username: formData.username,
          email: formData.email.trim() || null,
          phone: formData.phone || null,
          password: password,
          date_of_joining: formData.date_of_joining,
          role: formData.role,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        setError(result.error || 'Failed to create employee');
        return;
      }

      alert(`Employee created! Password: ${password}\nPlease share this with the employee securely.`);
    } else {
      const { error: updateError } = await supabase
        .from('employees')
        .update({
          full_name: formData.full_name,
          employee_code: formData.employee_code,
          username: formData.username,
          email: formData.email,
          phone: formData.phone || null,
          role: formData.role,
        })
        .eq('id', selectedEmployee.id);

      if (updateError) {
        setError('Failed to update employee');
        return;
      }
    }

    setFormData({ full_name: '', employee_code: '', username: '', email: '', phone: '', password: '', date_of_joining: new Date().toISOString().split('T')[0], role: 'field_worker' });
    setShowForm(false);
    setSelectedEmployee(null);
    fetchEmployees();
  };

  const handleEdit = (employee: Employee) => {
    setSelectedEmployee(employee);
    setFormData({
      full_name: employee.full_name,
      employee_code: employee.employee_code,
      username: employee.username,
      email: employee.email,
      phone: employee.phone || '',
      password: '',
      date_of_joining: employee.date_of_joining,
      role: employee.role,
    });
    setShowForm(true);
  };

  const toggleActive = async (employee: Employee) => {
    const { error } = await supabase
      .from('employees')
      .update({ active: !employee.active })
      .eq('id', employee.id);

    if (!error) {
      fetchEmployees();
    }
  };

  const resetPassword = async (employee: Employee) => {
    if (!employee.user_id) {
      alert('Cannot reset password: No user account linked');
      return;
    }

    const newPassword = `Reset${Math.random().toString(36).substring(2, 10)}@1`;

    const { data: { users }, error: getUserError } = await supabase.auth.admin.listUsers();

    if (getUserError) {
      alert(`Failed to reset password: ${getUserError.message}`);
      return;
    }

    const userExists = users?.find(u => u.id === employee.user_id);

    if (!userExists) {
      alert('User account not found');
      return;
    }

    const { error: updateError } = await supabase.auth.admin.updateUserById(
      employee.user_id,
      { password: newPassword }
    );

    if (updateError) {
      alert(`Failed to reset password: ${updateError.message}`);
    } else {
      alert(`Password reset successful!\n\nNew password: ${newPassword}\n\nEmployee: ${employee.full_name}\nEmail: ${employee.email}\n\nPlease share this securely with the employee.`);
    }
  };

  const handleDelete = async (employee: Employee) => {
    if (!confirm(`Are you sure you want to delete ${employee.full_name}?\n\nThis will permanently delete:\n- Employee record\n- All attendance logs\n- All waste management forms\n\nThis action cannot be undone.`)) {
      return;
    }

    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-employee`;

    const { data: session } = await supabase.auth.getSession();

    if (!session.session) {
      alert('You must be logged in to delete employees');
      return;
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        employee_id: employee.id,
        user_id: employee.user_id,
      }),
    });

    const result = await response.json();

    if (!result.success) {
      alert(`Failed to delete employee: ${result.error}`);
    } else {
      alert('Employee deleted successfully');
      fetchEmployees();
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-100 text-purple-800';
      case 'field_supervisor':
        return 'bg-blue-100 text-blue-800';
      case 'manager':
        return 'bg-green-100 text-green-800';
      case 'field_worker':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Employee Management</h2>
        <button
          onClick={() => {
            setShowForm(true);
            setSelectedEmployee(null);
            setFormData({ full_name: '', employee_code: '', username: '', email: '', phone: '', password: '', date_of_joining: new Date().toISOString().split('T')[0], role: 'field_worker' });
          }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
        >
          <Plus className="w-5 h-5" />
          Add Employee
        </button>
      </div>

      {showForm && (
        <div className="mb-6 p-6 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">
            {selectedEmployee ? 'Edit Employee' : 'New Employee'}
          </h3>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Employee Code
                </label>
                <input
                  type="text"
                  value={formData.employee_code}
                  onChange={(e) => setFormData({ ...formData, employee_code: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Username
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  required
                  disabled={!!selectedEmployee}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="username-for-login"
                />
                {selectedEmployee && (
                  <p className="mt-1 text-xs text-gray-500">Username cannot be changed after creation</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => {
                    const phone = e.target.value;
                    setFormData({ ...formData, phone, password: formData.password || phone });
                  }}
                  placeholder="10-digit mobile number"
                  pattern="[0-9]{10}"
                  required={!selectedEmployee}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {!selectedEmployee && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password (Default: Phone Number)
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder={formData.phone || 'Leave empty to use phone number'}
                    minLength={6}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="checkbox"
                      id="showPassword"
                      checked={showPassword}
                      onChange={(e) => setShowPassword(e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <label htmlFor="showPassword" className="text-sm text-gray-700 cursor-pointer">
                      Show password
                    </label>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Leave empty to use phone number as password
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date of Joining
                </label>
                <input
                  type="date"
                  value={formData.date_of_joining}
                  onChange={(e) => setFormData({ ...formData, date_of_joining: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Role
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as typeof formData.role })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="field_worker">Field Worker</option>
                  <option value="field_supervisor">Field Supervisor</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                  <option value="intern">Intern</option>
                  <option value="office_employee">Office Employee</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition"
              >
                {selectedEmployee ? 'Update Employee' : 'Create Employee'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setSelectedEmployee(null);
                  setError('');
                }}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-2 rounded-lg transition"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading employees...</div>
      ) : employees.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No employees found</div>
      ) : (
        <>
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">Employee</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">Contact</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">Role</th>
                  <th className="text-left py-3 px-2 text-xs font-semibold text-gray-700 uppercase tracking-wider">Joined</th>
                  <th className="text-left py-3 px-2 text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                  <th className="text-left py-3 px-2 text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((employee) => (
                  <tr key={employee.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <User className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">{employee.full_name}</p>
                          <p className="text-xs text-gray-500 truncate">{employee.employee_code}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="space-y-1 min-w-0">
                        <p className="flex items-center gap-1 text-sm text-gray-900 truncate">
                          <Mail className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate">{employee.email}</span>
                        </p>
                        {employee.phone && (
                          <p className="flex items-center gap-1 text-sm text-gray-500">
                            <Phone className="w-4 h-4 flex-shrink-0" />
                            {employee.phone}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold w-fit ${getRoleBadgeColor(employee.role)}`}>
                        <Shield className="w-4 h-4" />
                        {employee.role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                    </td>
                    <td className="py-4 px-2 whitespace-nowrap">
                      <span className="text-xs text-gray-600">
                        {new Date(employee.date_of_joining).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </span>
                    </td>
                    <td className="py-4 px-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                        employee.active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {employee.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-4 px-2">
                      <div className="flex items-center gap-1 flex-wrap">
                        <button
                          onClick={() => handleEdit(employee)}
                          className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => resetPassword(employee)}
                          disabled={!employee.user_id}
                          className="p-2 bg-blue-100 hover:bg-blue-200 disabled:bg-gray-100 disabled:text-gray-400 text-blue-700 rounded transition"
                          title="Reset Password"
                        >
                          <KeyRound className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => toggleActive(employee)}
                          className={`p-2 rounded transition ${
                            employee.active
                              ? 'bg-orange-100 hover:bg-orange-200 text-orange-700'
                              : 'bg-green-100 hover:bg-green-200 text-green-700'
                          }`}
                          title={employee.active ? 'Disable' : 'Enable'}
                        >
                          {employee.active ? '✕' : '✓'}
                        </button>
                        <button
                          onClick={() => handleDelete(employee)}
                          className="p-2 bg-red-100 hover:bg-red-200 text-red-700 rounded transition"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="lg:hidden space-y-4">
            {employees.map((employee) => (
              <div key={employee.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{employee.full_name}</h3>
                    <p className="text-sm text-gray-500">{employee.employee_code}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getRoleBadgeColor(employee.role)}`}>
                        {employee.role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        employee.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {employee.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 mb-3">
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <Mail className="w-4 h-4 flex-shrink-0 text-gray-500" />
                    <span className="truncate">{employee.email}</span>
                  </div>
                  {employee.phone && (
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <Phone className="w-4 h-4 flex-shrink-0 text-gray-500" />
                      <span>{employee.phone}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <span className="text-xs text-gray-500">Joined:</span>
                    <span className="text-xs">
                      {new Date(employee.date_of_joining).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-gray-200">
                  <button
                    onClick={() => handleEdit(employee)}
                    className="flex-1 flex items-center justify-center gap-2 p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition text-sm"
                  >
                    <Edit className="w-4 h-4" />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={() => resetPassword(employee)}
                    disabled={!employee.user_id}
                    className="flex-1 flex items-center justify-center gap-2 p-2 bg-blue-100 hover:bg-blue-200 disabled:bg-gray-100 disabled:text-gray-400 text-blue-700 rounded transition text-sm"
                  >
                    <KeyRound className="w-4 h-4" />
                    <span>Reset</span>
                  </button>
                  <button
                    onClick={() => toggleActive(employee)}
                    className={`p-2 rounded transition ${
                      employee.active
                        ? 'bg-orange-100 hover:bg-orange-200 text-orange-700'
                        : 'bg-green-100 hover:bg-green-200 text-green-700'
                    }`}
                    title={employee.active ? 'Disable' : 'Enable'}
                  >
                    {employee.active ? '✕' : '✓'}
                  </button>
                  <button
                    onClick={() => handleDelete(employee)}
                    className="p-2 bg-red-100 hover:bg-red-200 text-red-700 rounded transition"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
