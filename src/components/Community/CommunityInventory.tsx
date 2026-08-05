import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Package, Plus, ShoppingCart, TrendingDown, TrendingUp, History, AlertTriangle } from 'lucide-react';
import type { PermissionConfig } from '../../lib/communityPermissions';

interface InventoryItem { id: string; name: string; unit: string; category: string; reorder_level: number; }
interface Transaction { id: string; item_id: string; transaction_type: 'in' | 'out'; quantity: number; balance_after: number; transaction_date: string; remarks: string; inventory_items: { name: string; unit: string } | null; }
interface Order { id: string; item_id: string; quantity_ordered: number; status: string; order_date: string; expected_date: string | null; remarks: string; inventory_items: { name: string; unit: string } | null; }

type Tab = 'stock' | 'transactions' | 'orders';

export function CommunityInventory({ communityId, permissions }: { communityId: string; permissions: PermissionConfig }) {
  const { communityUser } = useAuth();
  const [tab, setTab] = useState<Tab>('stock');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showTxnForm, setShowTxnForm] = useState(false);
  const [txnForm, setTxnForm] = useState({ item_id: '', transaction_type: 'in' as 'in' | 'out', quantity: '', remarks: '' });

  const [showOrderForm, setShowOrderForm] = useState(false);
  const [orderForm, setOrderForm] = useState({ item_id: '', quantity_ordered: '', expected_date: '', remarks: '' });

  useEffect(() => { fetchAll(); }, [communityId]);

  const fetchAll = async () => {
    setLoading(true);
    const [itemsRes, txnRes, orderRes] = await Promise.all([
      supabase.from('inventory_items').select('*').eq('active', true).order('name'),
      supabase.from('inventory_transactions').select('*, inventory_items(name, unit)').eq('community_id', communityId).order('transaction_date', { ascending: false }).limit(50),
      supabase.from('inventory_orders').select('*, inventory_items(name, unit)').eq('community_id', communityId).order('order_date', { ascending: false }).limit(50),
    ]);

    if (itemsRes.error || txnRes.error || orderRes.error) {
      setError(itemsRes.error?.message || txnRes.error?.message || orderRes.error?.message || null);
    } else {
      setItems((itemsRes.data ?? []) as InventoryItem[]);
      setTransactions((txnRes.data ?? []) as Transaction[]);
      setOrders((orderRes.data ?? []) as Order[]);

      const balMap: Record<string, number> = {};
      for (const t of (txnRes.data ?? []) as any[]) {
        if (!balMap[t.item_id]) balMap[t.item_id] = 0;
        balMap[t.item_id] += t.transaction_type === 'in' ? t.quantity : -t.quantity;
      }
      setBalances(balMap);
      setError(null);
    }
    setLoading(false);
  };

  const addTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!communityUser || !txnForm.item_id || !txnForm.quantity) { setError('Item and quantity are required.'); return; }
    const qty = parseFloat(txnForm.quantity);
    const currentBalance = balances[txnForm.item_id] ?? 0;
    const newBalance = txnForm.transaction_type === 'in' ? currentBalance + qty : currentBalance - qty;

    const { error: err } = await supabase.from('inventory_transactions').insert({
      item_id: txnForm.item_id,
      community_id: communityId,
      transaction_type: txnForm.transaction_type,
      quantity: qty,
      balance_after: newBalance,
      employee_id: null as any,
      transaction_date: new Date().toISOString().split('T')[0],
      remarks: txnForm.remarks.trim(),
    } as any);
    if (err) { setError(err.message); return; }
    setTxnForm({ item_id: '', transaction_type: 'in', quantity: '', remarks: '' });
    setShowTxnForm(false);
    fetchAll();
  };

  const addOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!communityUser || !orderForm.item_id || !orderForm.quantity_ordered) { setError('Item and quantity are required.'); return; }
    const { error: err } = await supabase.from('inventory_orders').insert({
      item_id: orderForm.item_id,
      community_id: communityId,
      quantity_ordered: parseFloat(orderForm.quantity_ordered),
      status: 'pending',
      ordered_by: null as any,
      order_date: new Date().toISOString().split('T')[0],
      expected_date: orderForm.expected_date || null,
      remarks: orderForm.remarks.trim(),
    } as any);
    if (err) { setError(err.message); return; }
    setOrderForm({ item_id: '', quantity_ordered: '', expected_date: '', remarks: '' });
    setShowOrderForm(false);
    fetchAll();
  };

  const updateOrderStatus = async (orderId: string, status: 'pending' | 'placed' | 'received' | 'cancelled') => {
    const { error: err } = await supabase.from('inventory_orders').update({ status }).eq('id', orderId);
    if (err) { setError(err.message); return; }
    fetchAll();
  };

  const getBalance = (itemId: string) => balances[itemId] ?? 0;
  const isLowStock = (item: InventoryItem) => getBalance(item.id) <= item.reorder_level;
  const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm';

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-cyan-100 rounded-full flex items-center justify-center"><Package className="w-5 h-5 text-cyan-600" /></div>
        <h2 className="text-xl font-bold text-gray-900">Inventory Management</h2>
      </div>

      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {([{ id: 'stock' as Tab, label: 'Stock Overview', icon: Package }, { id: 'transactions' as Tab, label: 'Transactions', icon: History }, { id: 'orders' as Tab, label: 'Orders', icon: ShoppingCart }]).map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)} className={`flex items-center gap-2 px-4 py-3 font-medium transition border-b-2 ${tab === id ? 'text-cyan-600 border-cyan-600' : 'text-gray-600 border-transparent hover:text-gray-900'}`}>
            <Icon className="w-4 h-4" /><span className="text-sm">{label}</span>
          </button>
        ))}
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>}

      {loading ? <div className="text-center py-12 text-gray-500">Loading...</div> : tab === 'stock' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(item => {
            const balance = getBalance(item.id);
            const low = isLowStock(item);
            return (
              <div key={item.id} className={`p-4 rounded-lg border-2 transition ${low ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}>
                <div className="flex items-start justify-between mb-2">
                  <div><p className="text-sm font-semibold text-gray-900">{item.name}</p><p className="text-xs text-gray-500">{item.category} - {item.unit}</p></div>
                  {low && <span className="flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-800 text-xs font-medium rounded-full"><AlertTriangle className="w-3 h-3" />Low</span>}
                </div>
                <div className="flex items-baseline gap-2"><span className="text-2xl font-bold text-gray-900">{balance}</span><span className="text-sm text-gray-500">{item.unit}</span></div>
                <p className="text-xs text-gray-500 mt-1">Reorder at: {item.reorder_level} {item.unit}</p>
              </div>
            );
          })}
        </div>
      ) : tab === 'transactions' ? (
        <div>
          {permissions.canManageInventory && (
            <div className="flex justify-end mb-4">
              <button onClick={() => setShowTxnForm(!showTxnForm)} className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition font-medium text-sm"><Plus className="w-4 h-4" />Add Transaction</button>
            </div>
          )}
          {showTxnForm && permissions.canManageInventory && (
            <form onSubmit={addTransaction} className="mb-4 p-4 bg-cyan-50 border border-cyan-200 rounded-lg space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <select value={txnForm.item_id} onChange={e => setTxnForm({ ...txnForm, item_id: e.target.value })} className={inputCls}><option value="">Select item</option>{items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select>
                <select value={txnForm.transaction_type} onChange={e => setTxnForm({ ...txnForm, transaction_type: e.target.value as 'in' | 'out' })} className={inputCls}><option value="in">Stock In</option><option value="out">Stock Out</option></select>
                <input type="number" min="0" step="0.1" placeholder="Quantity" value={txnForm.quantity} onChange={e => setTxnForm({ ...txnForm, quantity: e.target.value })} className={inputCls} />
                <input type="text" placeholder="Remarks" value={txnForm.remarks} onChange={e => setTxnForm({ ...txnForm, remarks: e.target.value })} className={inputCls} />
              </div>
              <button type="submit" className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition font-medium text-sm">Save</button>
            </form>
          )}
          {transactions.length === 0 ? <div className="text-center py-8 text-gray-500">No transactions recorded</div> : (
            <div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b border-gray-200"><th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Date</th><th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Item</th><th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Type</th><th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Qty</th><th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Balance</th></tr></thead><tbody>
              {transactions.map(t => (<tr key={t.id} className="border-b border-gray-100 hover:bg-gray-50 transition"><td className="py-2 px-3 text-sm text-gray-900">{new Date(t.transaction_date).toLocaleDateString()}</td><td className="py-2 px-3 text-sm font-medium text-gray-900">{t.inventory_items?.name ?? '-'}</td><td className="py-2 px-3"><span className={`flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${t.transaction_type === 'in' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>{t.transaction_type === 'in' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}{t.transaction_type === 'in' ? 'In' : 'Out'}</span></td><td className="py-2 px-3 text-sm text-gray-900">{t.quantity} {t.inventory_items?.unit}</td><td className="py-2 px-3 text-sm text-gray-700">{t.balance_after}</td></tr>))}
            </tbody></table></div>
          )}
        </div>
      ) : (
        <div>
          {permissions.canManageInventory && (
            <div className="flex justify-end mb-4">
              <button onClick={() => setShowOrderForm(!showOrderForm)} className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition font-medium text-sm"><Plus className="w-4 h-4" />Place Order</button>
            </div>
          )}
          {showOrderForm && permissions.canManageInventory && (
            <form onSubmit={addOrder} className="mb-4 p-4 bg-cyan-50 border border-cyan-200 rounded-lg space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <select value={orderForm.item_id} onChange={e => setOrderForm({ ...orderForm, item_id: e.target.value })} className={inputCls}><option value="">Select item</option>{items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select>
                <input type="number" min="0" step="0.1" placeholder="Quantity" value={orderForm.quantity_ordered} onChange={e => setOrderForm({ ...orderForm, quantity_ordered: e.target.value })} className={inputCls} />
                <input type="date" value={orderForm.expected_date} onChange={e => setOrderForm({ ...orderForm, expected_date: e.target.value })} className={inputCls} />
                <input type="text" placeholder="Remarks" value={orderForm.remarks} onChange={e => setOrderForm({ ...orderForm, remarks: e.target.value })} className={inputCls} />
              </div>
              <button type="submit" className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition font-medium text-sm">Place Order</button>
            </form>
          )}
          {orders.length === 0 ? <div className="text-center py-8 text-gray-500">No orders placed</div> : (
            <div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b border-gray-200"><th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Date</th><th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Item</th><th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Qty</th><th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Expected</th><th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Status</th></tr></thead><tbody>
              {orders.map(o => (<tr key={o.id} className="border-b border-gray-100 hover:bg-gray-50 transition"><td className="py-2 px-3 text-sm text-gray-900">{new Date(o.order_date).toLocaleDateString()}</td><td className="py-2 px-3 text-sm font-medium text-gray-900">{o.inventory_items?.name ?? '-'}</td><td className="py-2 px-3 text-sm text-gray-900">{o.quantity_ordered} {o.inventory_items?.unit}</td><td className="py-2 px-3 text-sm text-gray-700">{o.expected_date ? new Date(o.expected_date).toLocaleDateString() : '-'}</td><td className="py-2 px-3">{permissions.canManageInventory ? <select value={o.status} onChange={e => updateOrderStatus(o.id, e.target.value as 'pending' | 'placed' | 'received' | 'cancelled')} className={`px-2 py-0.5 text-xs font-medium rounded-full border-0 cursor-pointer ${o.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : o.status === 'placed' ? 'bg-blue-100 text-blue-800' : o.status === 'received' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}><option value="pending">Pending</option><option value="placed">Placed</option><option value="received">Received</option><option value="cancelled">Cancelled</option></select> : <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${o.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : o.status === 'placed' ? 'bg-blue-100 text-blue-800' : o.status === 'received' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>{o.status}</span>}</td></tr>))}
            </tbody></table></div>
          )}
        </div>
      )}
    </div>
  );
}
