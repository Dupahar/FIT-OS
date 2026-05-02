import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Plus, AlertTriangle, Package, X, ArrowUpCircle, ArrowDownCircle } from 'lucide-react'
import {
  useInventoryItems,
  useInventoryMovements,
  useCreateInventoryItem,
  useCreateInventoryMovement,
  useMembers,
} from '@/hooks/useApi'
import { formatPaise } from '@/lib/utils'
import { useToast } from '@/components/shared/Toast'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'

type CategoryFilter = 'all' | 'protein' | 'creatine' | 'supplements' | 'snacks' | 'drinks' | 'accessories' | 'other'

const categoryLabels: Record<CategoryFilter, string> = {
  all: 'All',
  protein: 'Protein',
  creatine: 'Creatine',
  supplements: 'Supplements',
  snacks: 'Snacks',
  drinks: 'Drinks',
  accessories: 'Accessories',
  other: 'Other',
}

const categoryOptions = ['protein', 'creatine', 'supplements', 'snacks', 'drinks', 'accessories', 'other'] as const

type MovementModalState = {
  open: boolean
  type: 'in' | 'out'
  itemId?: string
}

export default function InventoryPage() {
  const { toast } = useToast()
  const { data: inventoryItems } = useInventoryItems()
  const { data: inventoryMovements } = useInventoryMovements()
  const { data: members } = useMembers()
  const createItem = useCreateInventoryItem()
  const createMovement = useCreateInventoryMovement()

  const [activeTab, setActiveTab] = useState<CategoryFilter>('all')
  const [search, setSearch] = useState('')
  const [showNewItem, setShowNewItem] = useState(false)
  const [movementModal, setMovementModal] = useState<MovementModalState>({ open: false, type: 'in' })

  const items = inventoryItems ?? []
  const movements = inventoryMovements ?? []
  const memberList = members ?? []

  const summary = useMemo(() => {
    const totalSkus = items.length
    const lowStock = items.filter((item) => Number(item.current_stock) <= Number(item.reorder_level)).length
    const stockValue = items.reduce(
      (sum, item) => sum + Number(item.unit_price_paise) * Number(item.current_stock),
      0,
    )
    const recentStart = new Date()
    recentStart.setDate(recentStart.getDate() - 30)
    const outbound = movements.filter((m) => {
      const createdAt = new Date(m.created_at)
      return m.movement_type === 'out' && createdAt >= recentStart
    }).length
    return { totalSkus, lowStock, stockValue, outbound }
  }, [items, movements])

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase()
    return items.filter((item) => {
      const matchesCategory = activeTab === 'all' || item.category === activeTab
      const matchesSearch = !query
        || item.name.toLowerCase().includes(query)
        || (item.sku || '').toLowerCase().includes(query)
        || (item.brand || '').toLowerCase().includes(query)
      return matchesCategory && matchesSearch
    })
  }, [activeTab, search, items])

  const lowStockItems = useMemo(
    () => items.filter((item) => Number(item.current_stock) <= Number(item.reorder_level)),
    [items],
  )

  const topMovers = useMemo(() => {
    const recentStart = new Date()
    recentStart.setDate(recentStart.getDate() - 30)
    const counts = new Map<string, number>()
    for (const movement of movements) {
      if (movement.movement_type !== 'out') continue
      const createdAt = new Date(movement.created_at)
      if (createdAt < recentStart) continue
      counts.set(movement.item_id, (counts.get(movement.item_id) ?? 0) + Number(movement.quantity))
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([itemId]) => items.find((item) => item.id === itemId))
      .filter(Boolean)
  }, [movements, items])

  const openMovement = (type: 'in' | 'out', itemId?: string) => {
    setMovementModal({ open: true, type, itemId })
  }

  return (
    <div className="p-8">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between mb-6">
        <div>
          <h1 className="font-syne font-bold text-2xl text-gray-900">Inventory</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Track protein, creatine, snacks, drinks, and retail stock
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => openMovement('in')}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <ArrowUpCircle size={16} /> Receive Stock
          </button>
          <button
            onClick={() => setShowNewItem(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#00B894] hover:bg-emerald-600 text-white font-medium rounded-lg transition-all active:scale-[0.97] text-sm"
          >
            <Plus size={16} /> New Item
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 mb-6">
        {[
          { label: 'Total SKUs', value: summary.totalSkus, color: '#0984E3' },
          { label: 'Low Stock', value: summary.lowStock, color: '#F39C12' },
          { label: 'Stock Value', value: formatPaise(summary.stockValue), color: '#00B894' },
          { label: 'Outbound (30d)', value: summary.outbound, color: '#6C5CE7' },
        ].map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="border rounded-xl p-5 relative overflow-hidden"
            style={{ borderColor: 'rgba(0,0,0,0.08)' }}
          >
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">{kpi.label}</p>
            <p className="font-syne font-bold text-2xl text-gray-900">{kpi.value}</p>
            <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ backgroundColor: kpi.color }} />
          </motion.div>
        ))}
      </div>

      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between mb-4">
        <div className="flex items-center gap-1 border-b border-gray-100">
          {(Object.keys(categoryLabels) as CategoryFilter[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium transition-all relative ${
                activeTab === tab ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {categoryLabels[tab]}
              {activeTab === tab && (
                <motion.div layoutId="inventoryTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00B894]" />
              )}
            </button>
          ))}
        </div>
        <div className="relative w-full xl:w-80">
          <Search size={16} className="absolute left-3 top-3 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search item, brand, or SKU"
            className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
          />
        </div>
      </div>

      <div className="border rounded-xl overflow-hidden" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
        {filteredItems.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">No inventory matches that filter.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50/60">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Reorder</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Price</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Stock Value</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Supplier</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'rgba(0,0,0,0.05)' }}>
              {filteredItems.map((item, i) => {
                const stock = Number(item.current_stock)
                const isLow = stock <= Number(item.reorder_level)
                const stockValue = stock * Number(item.unit_price_paise)
                return (
                  <motion.tr
                    key={item.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center">
                          <Package size={16} className="text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-800">{item.name}</p>
                          <p className="text-xs text-gray-400">{item.brand || 'Brand'} · {item.sku || 'SKU'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{categoryLabels[item.category as CategoryFilter] ?? item.category}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 font-medium">
                      {stock}
                      {isLow && (
                        <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                          <AlertTriangle size={10} /> Low
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{item.reorder_level}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{formatPaise(item.unit_price_paise)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{formatPaise(stockValue)}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{item.supplier || '-'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openMovement('in', item.id)}
                          className="text-xs text-emerald-600 hover:underline"
                        >
                          Restock
                        </button>
                        <button
                          onClick={() => openMovement('out', item.id)}
                          className="text-xs text-red-500 hover:underline"
                        >
                          Sell
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-6">
        <div className="border rounded-xl p-5" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
          <div className="flex items-center justify-between mb-3">
            <p className="font-semibold text-gray-900">Low Stock Alerts</p>
            <span className="text-xs text-amber-600 font-medium">{summary.lowStock} items</span>
          </div>
          <div className="space-y-3">
            {lowStockItems.length === 0 ? (
              <p className="text-sm text-gray-400">All items are stocked above reorder level.</p>
            ) : (
              lowStockItems.slice(0, 4).map((item) => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="text-gray-700 font-medium">{item.name}</p>
                    <p className="text-xs text-gray-400">Reorder at {item.reorder_level} units</p>
                  </div>
                  <span className="text-amber-600 font-semibold">{Number(item.current_stock)} left</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="border rounded-xl p-5" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
          <p className="font-semibold text-gray-900 mb-3">Top Movers</p>
          <div className="space-y-3">
            {topMovers.length === 0 ? (
              <p className="text-sm text-gray-400">No outbound movements logged yet.</p>
            ) : (
              topMovers.map((item) => (
                <div key={item!.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="text-gray-700 font-medium">{item!.name}</p>
                    <p className="text-xs text-gray-400">{item!.category}</p>
                  </div>
                  <span className="text-emerald-600 font-semibold">{Number(item!.current_stock)} in stock</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="border rounded-xl p-5" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
          <p className="font-semibold text-gray-900 mb-3">Reorder Plan</p>
          <ul className="text-sm text-gray-600 space-y-2">
            <li>Set supplier lead times for protein and creatine SKUs.</li>
            <li>Log every sale so stock levels stay accurate.</li>
            <li>Review low stock alerts before peak hours.</li>
          </ul>
        </div>
      </div>

      <AnimatePresence>
        {showNewItem && (
          <NewItemModal
            onClose={() => setShowNewItem(false)}
            onSave={async (payload) => {
              try {
                await createItem.mutateAsync(payload)
                toast('success', 'Inventory item added')
                setShowNewItem(false)
              } catch {
                toast('error', 'Failed to add item')
              }
            }}
            isSaving={createItem.isPending}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {movementModal.open && (
          <MovementModal
            items={items}
            members={memberList}
            type={movementModal.type}
            itemId={movementModal.itemId}
            onClose={() => setMovementModal({ open: false, type: 'in' })}
            onSave={async (data) => {
              try {
                await createMovement.mutateAsync(data)
                toast('success', data.movement_type === 'in' ? 'Stock received' : 'Stock deducted')
                setMovementModal({ open: false, type: 'in' })
              } catch (err: any) {
                if (err?.response?.data?.error === 'insufficient_stock') {
                  toast('error', 'Not enough stock for this sale')
                } else {
                  toast('error', 'Failed to update stock')
                }
              }
            }}
            isSaving={createMovement.isPending}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function NewItemModal({
  onClose,
  onSave,
  isSaving,
}: {
  onClose: () => void
  onSave: (payload: {
    name: string
    sku?: string
    category: string
    brand?: string
    unit_price_paise: number
    unit?: string
    reorder_level?: number
    current_stock?: number
    supplier?: string
  }) => void
  isSaving: boolean
}) {
  const [form, setForm] = useState({
    name: '',
    sku: '',
    category: 'protein',
    brand: '',
    price: '',
    unit: 'unit',
    reorder_level: '',
    current_stock: '',
    supplier: '',
  })

  const submit = () => {
    const unitPricePaise = Math.round(Number(form.price || 0) * 100)
    onSave({
      name: form.name.trim(),
      sku: form.sku.trim() || undefined,
      category: form.category,
      brand: form.brand.trim() || undefined,
      unit_price_paise: unitPricePaise,
      unit: form.unit.trim() || undefined,
      reorder_level: form.reorder_level ? Number(form.reorder_level) : undefined,
      current_stock: form.current_stock ? Number(form.current_stock) : undefined,
      supplier: form.supplier.trim() || undefined,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg mx-4"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-syne font-semibold text-lg">New Inventory Item</h3>
            <p className="text-xs text-gray-400">Add product details and opening stock</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Item Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
            >
              {categoryOptions.map((option) => (
                <option key={option} value={option}>
                  {categoryLabels[option]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
            <input
              value={form.brand}
              onChange={(e) => setForm({ ...form, brand: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
            <input
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unit Price (INR)</label>
            <input
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              type="number"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
            <input
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Opening Stock</label>
            <input
              value={form.current_stock}
              onChange={(e) => setForm({ ...form, current_stock: e.target.value })}
              type="number"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reorder Level</label>
            <input
              value={form.reorder_level}
              onChange={(e) => setForm({ ...form, reorder_level: e.target.value })}
              type="number"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
            <input
              value={form.supplier}
              onChange={(e) => setForm({ ...form, supplier: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
          </div>
        </div>

        <button
          onClick={submit}
          disabled={isSaving || !form.name.trim()}
          className="mt-6 w-full py-2.5 bg-[#00B894] hover:bg-emerald-600 text-white font-medium rounded-lg transition-all active:scale-[0.97] disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isSaving ? <LoadingSpinner size="sm" /> : <Plus size={16} />}
          {isSaving ? 'Saving...' : 'Save Item'}
        </button>
      </motion.div>
    </div>
  )
}

function MovementModal({
  items,
  members,
  type,
  itemId,
  onClose,
  onSave,
  isSaving,
}: {
  items: Array<{
    id: string
    name: string
    current_stock: number | string
  }>
  members: Array<{
    id: string
    first_name: string
    last_name: string
    phone: string
  }>
  type: 'in' | 'out'
  itemId?: string
  onClose: () => void
  onSave: (payload: {
    item_id: string
    movement_type: 'in' | 'out'
    quantity: number
    unit_price_paise?: number
    member_id?: string
    reason?: string
    notes?: string
  }) => void
  isSaving: boolean
}) {
  const [form, setForm] = useState({
    item_id: itemId || '',
    quantity: '',
    unit_price: '',
    reason: type === 'in' ? 'restock' : 'sale',
    notes: '',
    create_invoice: false,
    member_id: '',
  })

  const shouldInvoice = type === 'out' && form.create_invoice

  const submit = () => {
    const unitPrice = form.unit_price ? Math.round(Number(form.unit_price) * 100) : undefined
    onSave({
      item_id: form.item_id,
      movement_type: type,
      quantity: Number(form.quantity || 0),
      unit_price_paise: unitPrice,
      member_id: shouldInvoice ? form.member_id : undefined,
      reason: form.reason.trim() || undefined,
      notes: form.notes.trim() || undefined,
    })
  }

  const selectedItem = items.find((item) => item.id === form.item_id)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-syne font-semibold text-lg">
              {type === 'in' ? 'Receive Stock' : 'Sell Stock'}
            </h3>
            <p className="text-xs text-gray-400">
              {type === 'in' ? 'Add units into inventory' : 'Record a sale or stock-out'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

      <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Item</label>
            <select
              value={form.item_id}
              onChange={(e) => setForm({ ...form, item_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
            >
              <option value="">Select item</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            {selectedItem && (
              <p className="text-xs text-gray-400 mt-1">In stock: {selectedItem.current_stock}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
            <input
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              type="number"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unit Price (INR, optional)</label>
            <input
              value={form.unit_price}
              onChange={(e) => setForm({ ...form, unit_price: e.target.value })}
              type="number"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
          </div>
          {type === 'out' && (
            <div className="border rounded-lg p-3 bg-gray-50/60 border-gray-200">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={form.create_invoice}
                  onChange={(e) => setForm({ ...form, create_invoice: e.target.checked })}
                />
                Create invoice for member
              </label>
              {shouldInvoice && (
                <div className="mt-3 space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Member</label>
                  <select
                    value={form.member_id}
                    onChange={(e) => setForm({ ...form, member_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                  >
                    <option value="">Select member</option>
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.first_name} {member.last_name} - {member.phone}
                      </option>
                    ))}
                  </select>
                  {!form.unit_price && (
                    <p className="text-xs text-amber-600">
                      Unit price is required to generate an invoice.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
            <input
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none"
            />
          </div>
        </div>

        <button
          onClick={submit}
          disabled={
            isSaving ||
            !form.item_id ||
            Number(form.quantity) <= 0 ||
            (shouldInvoice && (!form.member_id || !form.unit_price))
          }
          className="mt-6 w-full py-2.5 bg-[#00B894] hover:bg-emerald-600 text-white font-medium rounded-lg transition-all active:scale-[0.97] disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isSaving ? <LoadingSpinner size="sm" /> : type === 'in' ? <ArrowUpCircle size={16} /> : <ArrowDownCircle size={16} />}
          {isSaving ? 'Saving...' : type === 'in' ? 'Add Stock' : 'Record Sale'}
        </button>
      </motion.div>
    </div>
  )
}
