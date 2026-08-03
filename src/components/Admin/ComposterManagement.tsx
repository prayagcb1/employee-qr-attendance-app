import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Trash2, Pencil, X, Check, Box } from 'lucide-react';

interface Composter {
  id: string;
  make: string;
  model: string;
  capacity_liters: number;
  active: boolean;
  created_at: string;
}

export function ComposterManagement() {
  const [composters, setComposters] = useState<Composter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ make: '', model: '', capacity_liters: '' });

  useEffect(() => {
    fetchComposters();
  }, []);

  const fetchComposters = async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('composters')
      .select('*')
      .order('make')
      .order('model');
    if (err) {
      setError(err.message);
      setComposters([]);
    } else {
      setComposters((data ?? []) as Composter[]);
      setError(null);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setForm({ make: '', model: '', capacity_liters: '' });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.make.trim() || !form.model.trim() || !form.capacity_liters) {
      setError('Make, model, and capacity are required.');
      return;
    }

    const payload = {
      make: form.make.trim(),
      model: form.model.trim(),
      capacity_liters: parseFloat(form.capacity_liters),
    };

    if (editingId) {
      const { error: err } = await supabase
        .from('composters')
        .update(payload)
        .eq('id', editingId);
      if (err) {
        setError(err.message);
        return;
      }
    } else {
      const { error: err } = await supabase
        .from('composters')
        .insert(payload);
      if (err) {
        setError(err.message);
        return;
      }
    }

    resetForm();
    fetchComposters();
  };

  const handleEdit = (c: Composter) => {
    setForm({
      make: c.make,
      model: c.model,
      capacity_liters: String(c.capacity_liters),
    });
    setEditingId(c.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this composter? Communities using it will need to be reassigned.')) return;
    const { error: err } = await supabase.from('composters').delete().eq('id', id);
    if (err) {
      setError(err.message);
      return;
    }
    fetchComposters();
  };

  const toggleActive = async (c: Composter) => {
    const { error: err } = await supabase
      .from('composters')
      .update({ active: !c.active })
      .eq('id', c.id);
    if (err) {
      setError(err.message);
      return;
    }
    fetchComposters();
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center">
            <Box className="w-5 h-5 text-teal-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Composter Management</h2>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition font-medium"
        >
          <Plus className="w-4 h-4" />
          Add Composter
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
          {error}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 p-4 bg-teal-50 border border-teal-200 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Make</label>
              <input
                type="text"
                value={form.make}
                onChange={e => setForm({ ...form, make: e.target.value })}
                placeholder="e.g. Smartbin"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
              <input
                type="text"
                value={form.model}
                onChange={e => setForm({ ...form, model: e.target.value })}
                placeholder="e.g. SB-100"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Capacity (Liters)</label>
              <input
                type="number"
                min="0"
                value={form.capacity_liters}
                onChange={e => setForm({ ...form, capacity_liters: e.target.value })}
                placeholder="e.g. 100"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition font-medium">
              <Check className="w-4 h-4" />
              {editingId ? 'Update' : 'Add'} Composter
            </button>
            <button type="button" onClick={resetForm} className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium">
              <X className="w-4 h-4" />
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading composters...</div>
      ) : composters.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No composters added yet</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Make</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Model</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Capacity (L)</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {composters.map(c => (
                <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                  <td className="py-3 px-4 text-sm text-gray-900 font-medium">{c.make}</td>
                  <td className="py-3 px-4 text-sm text-gray-700">{c.model}</td>
                  <td className="py-3 px-4 text-sm text-gray-700">{c.capacity_liters} L</td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => toggleActive(c)}
                      className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${
                        c.active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {c.active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleEdit(c)}
                        className="p-1.5 text-gray-500 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
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
      )}
    </div>
  );
}
