import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Package, Plus, ShoppingCart, TrendingDown, TrendingUp, History, AlertTriangle } from 'lucide-react';

interface InventoryItem {
  id: string;
  name: string;
  unit: string;
  category: string;
  reorder_level: number;
  active: boolean;
}

interface Transaction {
  id: string;
  item_id: string;
  community_id: string | null;
  transaction_type: 'in' | 'out';
  quantity: number;
  balance_after: number;
  transaction_date: string;
  remarks: string;
  inventory_items: { name: string; unit: string } | null;
  communities: { name: string } | null;
}

interface Order {
  id: string;
  item_id: string;
  community_id: string | null;
  quantity_ordered: number;
  status: 'pending' | 'placed' | 'received' | 'cancelled';
  order_date: string;
  expected_date: string | null;
  remarks: string;
  inventory_items: { name: string; unit: string } | null;
  communities: { name: string } | null;
}

interface Community {
  id: string;
  name: string;
}

interface Balance {
  item_id: string;
  balance: number;
}

type Tab = 'stock' | 'transactions' | 'orders';

export function InventoryManagement() {
  const { employee } = useAuth();
  const [tab, setTab] = useState<Tab>('stock');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Forms
  const [showItemForm, setShowItemForm] = useState(false);
  const [itemForm, setItemForm] = useState({ name: '', unit: 'pcs', category: 'general', reorder_level: '0' });

  const [showTxnForm, setShowTxnForm] = useState(false);
  const [txnForm, setTxnForm] = useState({ item_id: '', community_id: '', transaction_type: 'in' as 'in' | 'out', quantity: '', remarks: '' });

  const [showOrderForm, setShowOrderForm] = useState(false);
  const [orderForm, setOrderForm] = useState({ item_id: '', community_id: '', quantity_ordered: '', expected_date: '', remarks: '' });

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [itemsRes, communitiesRes, txnRes, orderRes] = await Promise.all([
      supabase.from('inventory_items').select('*').order('name'),
      supabase.from('communities').select('id, name').eq('active', true).order('name'),
      supabase.from('inventory_transactions')
        .select('*, inventory_items(name, unit), communities(name)')
        .order('transaction_date', { ascending: false }).limit(50),
      supabase.from('inventory_orders')
        .select('*, inventory_items(name, unit), communities(name)')
        .order('order_date', { ascending: false }).limit(50),
    ]);

    if (itemsRes.error || communitiesRes.error || txnRes.error || orderRes.error) {
      setError(itemsRes.error?.message || communitiesRes.error?.message || txnRes.error?.message || orderRes.error?.message || null);
      setLoading(false);
      return;
    }

    setItems((itemsRes.data ?? []) as InventoryItem[]);
    setCommunities((communitiesRes.data ?? []) as Community[]);
    setTransactions((txnRes.data ?? []) as Transaction[]);
    setOrders((orderRes.data ?? []) as Order[]);

    // Calculate balances per item (sum of all 'in' minus sum of all 'out')
    const allTxn = txnRes.data ?? [];
    const balanceMap: Record<string, number> = {};
    for (const t of allTxn as any[]) {
      if (!balanceMap[t.item_id]) balanceMap[t.item_id] = 0;
      balanceMap[t.item_id] += t.transaction_type === 'in' ? t.quantity : -t.quantity;
    }
    setBalances(Object.entries(balanceMap).map(([item_id, balance]) => ({ item_id, balance })));

    setError(null);
    setLoading(false);
  };

  const addItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemForm.name.trim()) { setError('Item name is required.'); return; }
    const { error: err } = await supabase.from('inventory_items').insert({
      name: itemForm.name.trim(),
      unit: itemForm.unit.trim(),
      category: itemForm.category.trim(),
      reorder_level: parseFloat(itemForm.reorder_level) || 0,
    });
    if (err) { setError(err.message); return; }
    setItemForm({ name: '', unit: 'pcs', category: 'general', reorder_level: '0' });
    setShowItemForm(false);
    fetchAll();
  };

  const addTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee || !txnForm.item_id || !txnForm.quantity) { setError('Item and quantity are required.'); return; }

    const itemId = txnForm.item_id;
    const qty = parseFloat(txnForm.quantity);
    const currentBalance = balances.find(b => b.item_id === itemId)?.balance ?? 0;
    const newBalance = txnForm.transaction_type === 'in' ? currentBalance + qty : currentBalance - qty;

    const { error: err } = await supabase.from('inventory_transactions').insert({
      item_id: itemId,
      community_id: txnForm.community_id || null,
      transaction_type: txnForm.transaction_type,
      quantity: qty,
      balance_after: newBalance,
      employee_id: employee.id,
      transaction_date: new Date().toISOString().split('T')[0],
      remarks: txnForm.remarks.trim(),
    });

    if (err) { setError(err.message); return; }
    setTxnForm({ item_id: '', community_id: '', transaction_type: 'in', quantity: '', remarks: '' });
    setShowTxnForm(false);
    fetchAll();
  };

  const addOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee || !orderForm.item_id || !orderForm.quantity_ordered) { setError('Item and quantity are required.'); return; }

    const { error: err } = await supabase.from('inventory_orders').insert({
      item_id: orderForm.item_id,
      community_id: orderForm.community_id || null,
      quantity_ordered: parseFloat(orderForm.quantity_ordered),
      status: 'pending',
      ordered_by: employee.id,
      order_date: new Date().toISOString().split('T')[0],
      expected_date: orderForm.expected_date || null,
      remarks: orderForm.remarks.trim(),
    });

    if (err) { setError(err.message); return; }
    setOrderForm({ item_id: '', community_id: '', quantity_ordered: '', expected_date: '', remarks: '' });
    setShowOrderForm(false);
    fetchAll();
  };

  const updateOrderStatus = async (orderId: string, status: Order['status']) => {
    const { error: err } = await supabase.from('inventory_orders').update({ status }).eq('id', orderId);
    if (err) { setError(err.message); return; }
    fetchAll();
  };

  const getBalance = (itemId: string) => balances.find(b => b.item_id === itemId)?.balance ?? 0;
  const isLowStock = (item: InventoryItem) => getBalance(item.id) <= item.reorder_level;

  const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm';

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-cyan-100 rounded-full flex items-center justify-center">
            <Package className="w-5 h-5 text-cyan-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Inventory Management</h2>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {([
          { id: 'stock' as Tab, label: 'Stock Overview', icon: Package },
          { id: 'transactions' as Tab, label: 'Transactions', icon: History },
          { id: 'orders' as Tab, label: 'Orders', icon: ShoppingCart },
        ]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-3 font-medium transition border-b-2 ${
              tab === id ? 'text-cyan-600 border-cyan-600' : 'text-gray-600 border-transparent hover:text-gray-900'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span className="text-sm">{label}</span>
          </button>
        ))}
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>}

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading inventory...</div>
      ) : tab === 'stock' ? (
        <div>
          <div className="flex justify-end mb-4">
            <button onClick={() => setShowItemForm(!showItemForm)} className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition font-medium text-sm">
              <Plus className="w-4 h-4" />Add Item
            </button>
          </div>

          {showItemForm && (
            <form onSubmit={addItem} className="mb-4 p-4 bg-cyan-50 border border-cyan-200 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
                <input type="text" placeholder="Item name" value={itemForm.name} onChange={e => setItemForm({ ...itemForm, name: e.target.value })} className={inputCls} />
                <input type="text" placeholder="Unit (kg, pcs, pairs)" value={itemForm.unit} onChange={e => setItemForm({ ...itemForm, unit: e.target.value })} className={inputCls} />
                <input type="text" placeholder="Category" value={itemForm.category} onChange={e => setItemForm({ ...itemForm, category: e.target.value })} className={inputCls} />
                <input type="number" min="0" placeholder="Reorder level" value={itemForm.reorder_level} onChange={e => setItemForm({ ...itemForm, reorder_level: e.target.value })} className={inputCls} />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition font-medium text-sm">Save Item</button>
                <button type="button" onClick={() => setShowItemForm(false)} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium text-sm">Cancel</button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.filter(i => i.active).map(item => {
              const balance = getBalance(item.id);
              const low = isLowStock(item);
              return (
                <div key={item.id} className={`p-4 rounded-lg border-2 transition ${low ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                      <p className="text-xs text-gray-500">{item.category} - {item.unit}</p>
                    </div>
                    {low && (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-800 text-xs font-medium rounded-full">
                        <AlertTriangle className="w-3 h-3" />Low
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-gray-900">{balance}</span>
                    <span className="text-sm text-gray-500">{item.unit}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Reorder at: {item.reorder_level} {item.unit}</p>
                </div>
              );
            })}
          </div>
        </div>
      ) : tab === 'transactions' ? (
        <div>
          <div className="flex justify-end mb-4">
            <button onClick={() => setShowTxnForm(!showTxnForm)} className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition font-medium text-sm">
              <Plus className="w-4 h-4" />Add Transaction
            </button>
          </div>

          {showTxnForm && (
            <form onSubmit={addTransaction} className="mb-4 p-4 bg-cyan-50 border border-cyan-200 rounded-lg space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <select value={txnForm.item_id} onChange={e => setTxnForm({ ...txnForm, item_id: e.target.value })} className={inputCls}>
                  <option value="">Select item</option>
                  {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
                <select value={txnForm.community_id} onChange={e => setTxnForm({ ...txnForm, community_id: e.target.value })} className={inputCls}>
                  <option value="">No community</option>
                  {communities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select value={txnForm.transaction_type} onChange={e => setTxnForm({ ...txnForm, transaction_type: e.target.value as 'in' | 'out' })} className={inputCls}>
                  <option value="in">Stock In</option>
                  <option value="out">Stock Out</option>
                </select>
                <input type="number" min="0" step="0.1" placeholder="Quantity" value={txnForm.quantity} onChange={e => setTxnForm({ ...txnForm, quantity: e.target.value })} className={inputCls} />
                <input type="text" placeholder="Remarks" value={txnForm.remarks} onChange={e => setTxnForm({ ...txnForm, remarks: e.target.value })} className={inputCls} />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition font-medium text-sm">Save</button>
                <button type="button" onClick={() => setShowTxnForm(false)} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium text-sm">Cancel</button>
              </div>
            </form>
          )}

          {transactions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No transactions recorded yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Date</th>
                    <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Item</th>
                    <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Community</th>
                    <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Type</th>
                    <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Quantity</th>
                    <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Balance</th>
                    <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(t => (
                    <tr key={t.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                      <td className="py-2 px-3 text-sm text-gray-900">{new Date(t.transaction_date).toLocaleDateString()}</td>
                      <td className="py-2 px-3 text-sm font-medium text-gray-900">{t.inventory_items?.name || '-'}</td>
                      <td className="py-2 px-3 text-sm text-gray-700">{t.communities?.name || '-'}</td>
                      <td className="py-2 px-3">
                        <span className={`flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${
                          t.transaction_type === 'in' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
                        }`}>
                          {t.transaction_type === 'in' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {t.transaction_type === 'in' ? 'In' : 'Out'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-sm text-gray-900">{t.quantity} {t.inventory_items?.unit}</td>
                      <td className="py-2 px-3 text-sm text-gray-700">{t.balance_after}</td>
                      <td className="py-2 px-3 text-sm text-gray-600">{t.remarks || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div>
          <div className="flex justify-end mb-4">
            <button onClick={() => setShowOrderForm(!showOrderForm)} className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition font-medium text-sm">
              <Plus className="w-4 h-4" />Place Order
            </button>
          </div>

          {showOrderForm && (
            <form onSubmit={addOrder} className="mb-4 p-4 bg-cyan-50 border border-cyan-200 rounded-lg space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <select value={orderForm.item_id} onChange={e => setOrderForm({ ...orderForm, item_id: e.target.value })} className={inputCls}>
                  <option value="">Select item</option>
                  {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
                <select value={orderForm.community_id} onChange={e => setOrderForm({ ...orderForm, community_id: e.target.value })} className={inputCls}>
                  <option value="">No community</option>
                  {communities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <input type="number" min="0" step="0.1" placeholder="Quantity" value={orderForm.quantity_ordered} onChange={e => setOrderForm({ ...orderForm, quantity_ordered: e.target.value })} className={inputCls} />
                <input type="date" value={orderForm.expected_date} onChange={e => setOrderForm({ ...orderForm, expected_date: e.target.value })} className={inputCls} />
                <input type="text" placeholder="Remarks" value={orderForm.remarks} onChange={e => setOrderForm({ ...orderForm, remarks: e.target.value })} className={inputCls} />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition font-medium text-sm">Place Order</button>
                <button type="button" onClick={() => setShowOrderForm(false)} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium text-sm">Cancel</button>
              </div>
            </form>
          )}

          {orders.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No orders placed yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Order Date</th>
                    <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Item</th>
                    <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Community</th>
                    <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Quantity</th>
                    <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Expected</th>
                    <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Status</th>
                    <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(o => (
                    <tr key={o.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                      <td className="py-2 px-3 text-sm text-gray-900">{new Date(o.order_date).toLocaleDateString()}</td>
                      <td className="py-2 px-3 text-sm font-medium text-gray-900">{o.inventory_items?.name || '-'}</td>
                      <td className="py-2 px-3 text-sm text-gray-700">{o.communities?.name || '-'}</td>
                      <td className="py-2 px-3 text-sm text-gray-900">{o.quantity_ordered} {o.inventory_items?.unit}</td>
                      <td className="py-2 px-3 text-sm text-gray-700">{o.expected_date ? new Date(o.expected_date).toLocaleDateString() : '-'}</td>
                      <td className="py-2 px-3">
                        <select
                          value={o.status}
                          onChange={e => updateOrderStatus(o.id, e.target.value as Order['status'])}
                          className={`px-2 py-0.5 text-xs font-medium rounded-full border-0 cursor-pointer ${
                            o.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            o.status === 'placed' ? 'bg-blue-100 text-blue-800' :
                            o.status === 'received' ? 'bg-green-100 text-green-800' :
                            'bg-gray-100 text-gray-600'
                          }`}
                        >
                          <option value="pending">Pending</option>
                          <option value="placed">Placed</option>
                          <option value="received">Received</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </td>
                      <td className="py-2 px-3 text-sm text-gray-600">{o.remarks || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
