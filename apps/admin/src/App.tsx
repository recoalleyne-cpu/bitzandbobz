import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

type Category =
  | 'CAR_ACCESSORIES'
  | 'DIY_TOOLS_GADGETS'
  | 'MENS_ACCESSORIES'
  | 'PHONE_ACCESSORIES'
  | 'SPECIAL'
  | 'WOMENS_ACCESSORIES'

type OrderStatus = 'PENDING' | 'PAID' | 'PACKED' | 'SHIPPED' | 'CANCELLED'

type Product = {
  id: string
  title: string
  slug: string
  description: string | null
  priceCents: number
  category: Category
  imageUrl: string | null
  imageUrls: string[]
  stockQty: number
  active: boolean
}

type Order = {
  id: string
  customerName: string
  customerPhone: string | null
  customerEmail: string | null
  shippingAddress1: string
  parish: string | null
  currency: 'BBD'
  totalCents: number
  status: OrderStatus
  payments?: Array<{ status: 'PENDING' | 'PAID' | 'FAILED' }>
}

type AnalyticsSummary = {
  views: number
  addToCart: number
  beginCheckout: number
  purchases: number
}

type OutboxItem = {
  id: string
  channel: string
  to: string
  subject?: string
  eventType?: string
  createdAt: string
}

type ProductForm = {
  title: string
  slug: string
  description: string
  priceBbd: string
  category: Category
  imageUrl: string
  extraImages: string
  stockQty: string
  active: boolean
}

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/+$/, '')
const TOKEN_KEY = 'bb_admin_token'

const categoryOptions: Category[] = [
  'CAR_ACCESSORIES',
  'DIY_TOOLS_GADGETS',
  'MENS_ACCESSORIES',
  'PHONE_ACCESSORIES',
  'SPECIAL',
  'WOMENS_ACCESSORIES',
]

const blankProductForm: ProductForm = {
  title: '',
  slug: '',
  description: '',
  priceBbd: '',
  category: 'SPECIAL',
  imageUrl: '',
  extraImages: '',
  stockQty: '0',
  active: true,
}

function formatBbd(cents: number): string {
  return new Intl.NumberFormat('en-BB', {
    style: 'currency',
    currency: 'BBD',
  }).format(cents / 100)
}

async function parseErrorMessage(response: Response): Promise<string> {
  const fallback = `Request failed (${response.status})`
  try {
    const data = (await response.json()) as { error?: unknown }
    if (typeof data.error === 'string') return data.error
    if (data.error && typeof data.error === 'object') return JSON.stringify(data.error)
    return fallback
  } catch {
    return fallback
  }
}

function isUnauthorized(message: string): boolean {
  return message.toLowerCase().includes('token') || message.includes('401') || message.toLowerCase().includes('unauthorized')
}

function App() {
  const [token, setToken] = useState<string>(() => localStorage.getItem(TOKEN_KEY) ?? '')
  const [password, setPassword] = useState('')
  const [tab, setTab] = useState<'products' | 'orders' | 'insights'>('products')
  const [products, setProducts] = useState<Product[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null)
  const [lowStock, setLowStock] = useState<Product[]>([])
  const [outbox, setOutbox] = useState<OutboxItem[]>([])
  const [editingProductId, setEditingProductId] = useState<string | null>(null)
  const [productForm, setProductForm] = useState<ProductForm>(blankProductForm)
  const [status, setStatus] = useState('Ready.')
  const [saving, setSaving] = useState(false)

  const stats = useMemo(
    () => ({
      active: products.filter((product) => product.active).length,
      lowStock: products.filter((product) => product.stockQty <= 5).length,
    }),
    [products],
  )

  function handleLogout() {
    localStorage.removeItem(TOKEN_KEY)
    setToken('')
    setProducts([])
    setOrders([])
    setAnalytics(null)
    setLowStock([])
  }

  async function apiFetch(pathname: string, init?: RequestInit): Promise<Response> {
    const headers = new Headers(init?.headers)
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return fetch(`${API_BASE}${pathname}`, { ...init, headers })
  }

  async function refreshAdminData() {
    if (!token) return
    setStatus('Loading admin data...')

    try {
      const [productsRes, ordersRes, analyticsRes, lowStockRes, outboxRes] = await Promise.all([
        apiFetch('/admin/products'),
        apiFetch('/admin/orders'),
        apiFetch('/admin/analytics/summary'),
        apiFetch('/admin/alerts/low-stock'),
        apiFetch('/admin/automations/outbox'),
      ])

      if (!productsRes.ok) throw new Error(await parseErrorMessage(productsRes))
      if (!ordersRes.ok) throw new Error(await parseErrorMessage(ordersRes))
      if (!analyticsRes.ok) throw new Error(await parseErrorMessage(analyticsRes))
      if (!lowStockRes.ok) throw new Error(await parseErrorMessage(lowStockRes))
      if (!outboxRes.ok) throw new Error(await parseErrorMessage(outboxRes))

      const [productsData, ordersData, analyticsData, lowStockData, outboxData] = (await Promise.all([
        productsRes.json(),
        ordersRes.json(),
        analyticsRes.json(),
        lowStockRes.json(),
        outboxRes.json(),
      ])) as [Product[], Order[], AnalyticsSummary, Product[], OutboxItem[]]

      setProducts(productsData)
      setOrders(ordersData)
      setAnalytics(analyticsData)
      setLowStock(lowStockData)
      setOutbox(outboxData)
      setStatus('Admin data loaded.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load admin data.'
      setStatus(message)
      if (isUnauthorized(message)) {
        handleLogout()
      }
    }
  }

  useEffect(() => {
    void refreshAdminData()
  }, [token])

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    try {
      const response = await fetch(`${API_BASE}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (!response.ok) throw new Error(await parseErrorMessage(response))
      const data = (await response.json()) as { token: string }
      localStorage.setItem(TOKEN_KEY, data.token)
      setToken(data.token)
      setPassword('')
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Login failed.')
    } finally {
      setSaving(false)
    }
  }

  function resetProductForm() {
    setEditingProductId(null)
    setProductForm(blankProductForm)
  }

  function beginEdit(product: Product) {
    setEditingProductId(product.id)
    setProductForm({
      title: product.title,
      slug: product.slug,
      description: product.description ?? '',
      priceBbd: (product.priceCents / 100).toFixed(2),
      category: product.category,
      imageUrl: product.imageUrl ?? '',
      extraImages: (product.imageUrls ?? []).join('\n'),
      stockQty: String(product.stockQty),
      active: product.active,
    })
  }

  async function submitProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setStatus('Saving product...')

    const price = Number.parseFloat(productForm.priceBbd)
    const stock = Number.parseInt(productForm.stockQty, 10)

    if (!Number.isFinite(price) || price <= 0) {
      setSaving(false)
      setStatus('Price must be a positive number.')
      return
    }

    if (!Number.isFinite(stock) || stock < 0) {
      setSaving(false)
      setStatus('Stock qty must be 0 or more.')
      return
    }

    const imageUrls = productForm.extraImages
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)

    const payload = {
      title: productForm.title.trim(),
      slug: productForm.slug.trim(),
      description: productForm.description.trim() || null,
      priceCents: Math.round(price * 100),
      currency: 'BBD',
      category: productForm.category,
      imageUrl: productForm.imageUrl.trim() || null,
      imageUrls,
      stockQty: stock,
      active: productForm.active,
    }

    try {
      const response = await apiFetch(
        editingProductId ? `/admin/products/${editingProductId}` : '/admin/products',
        {
          method: editingProductId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      )

      if (!response.ok) throw new Error(await parseErrorMessage(response))

      resetProductForm()
      await refreshAdminData()
      setStatus(editingProductId ? 'Product updated.' : 'Product created.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Save failed.'
      setStatus(message)
      if (isUnauthorized(message)) {
        handleLogout()
      }
    } finally {
      setSaving(false)
    }
  }

  async function removeProduct(productId: string) {
    setSaving(true)
    try {
      const response = await apiFetch(`/admin/products/${productId}`, { method: 'DELETE' })
      if (!response.ok && response.status !== 204) throw new Error(await parseErrorMessage(response))
      await refreshAdminData()
      setStatus('Product deleted.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Delete failed.'
      setStatus(message)
      if (isUnauthorized(message)) {
        handleLogout()
      }
    } finally {
      setSaving(false)
    }
  }

  async function updateOrderStatus(orderId: string, nextStatus: OrderStatus) {
    setSaving(true)
    try {
      const response = await apiFetch(`/admin/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      if (!response.ok) throw new Error(await parseErrorMessage(response))
      await refreshAdminData()
      setStatus('Order status updated.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Update failed.'
      setStatus(message)
      if (isUnauthorized(message)) {
        handleLogout()
      }
    } finally {
      setSaving(false)
    }
  }

  async function queueDailySummary() {
    setSaving(true)
    try {
      const response = await apiFetch('/admin/automations/daily-sales-email', { method: 'POST' })
      if (!response.ok) throw new Error(await parseErrorMessage(response))
      await refreshAdminData()
      setStatus('Daily sales summary queued.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Queue failed.'
      setStatus(message)
    } finally {
      setSaving(false)
    }
  }

  if (!token) {
    return (
      <main className="authWrap">
        <form className="authCard" onSubmit={login}>
          <h1>Admin Login</h1>
          <p>Use your admin password to unlock product and order management.</p>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          <button type="submit" disabled={saving}>Sign in</button>
          <p className="status">{status}</p>
        </form>
      </main>
    )
  }

  return (
    <main className="app">
      <header className="hero">
        <h1>Bitz Bobz Admin</h1>
        <p className="status">{status}</p>
        <div className="row">
          <button type="button" className={tab === 'products' ? 'active' : ''} onClick={() => setTab('products')}>Products</button>
          <button type="button" className={tab === 'orders' ? 'active' : ''} onClick={() => setTab('orders')}>Orders</button>
          <button type="button" className={tab === 'insights' ? 'active' : ''} onClick={() => setTab('insights')}>Insights</button>
          <button type="button" onClick={handleLogout}>Logout</button>
        </div>
        <p>Active products: {stats.active} | Low stock (&lt;=5): {stats.lowStock}</p>
      </header>

      {tab === 'products' && (
        <section className="grid2">
          <form className="panel" onSubmit={submitProduct}>
            <h2>{editingProductId ? 'Edit product' : 'Create product'}</h2>
            <label>Title<input value={productForm.title} onChange={(event) => setProductForm({ ...productForm, title: event.target.value })} required /></label>
            <label>Slug<input value={productForm.slug} onChange={(event) => setProductForm({ ...productForm, slug: event.target.value })} required /></label>
            <label>Description<textarea value={productForm.description} onChange={(event) => setProductForm({ ...productForm, description: event.target.value })} /></label>
            <label>Price (BBD)<input type="number" min="0.01" step="0.01" value={productForm.priceBbd} onChange={(event) => setProductForm({ ...productForm, priceBbd: event.target.value })} required /></label>
            <label>Main image URL<input value={productForm.imageUrl} onChange={(event) => setProductForm({ ...productForm, imageUrl: event.target.value })} placeholder="https://..." /></label>
            <label>Extra image URLs (one per line)<textarea value={productForm.extraImages} onChange={(event) => setProductForm({ ...productForm, extraImages: event.target.value })} /></label>
            <label>Stock qty<input type="number" min="0" step="1" value={productForm.stockQty} onChange={(event) => setProductForm({ ...productForm, stockQty: event.target.value })} required /></label>
            <label>
              Category
              <select value={productForm.category} onChange={(event) => setProductForm({ ...productForm, category: event.target.value as Category })}>
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </label>
            <label className="check">
              <input type="checkbox" checked={productForm.active} onChange={(event) => setProductForm({ ...productForm, active: event.target.checked })} />
              Active in storefront
            </label>
            <div className="row">
              <button type="submit" disabled={saving}>{editingProductId ? 'Save changes' : 'Create product'}</button>
              <button type="button" onClick={resetProductForm} disabled={saving}>Reset</button>
            </div>
          </form>

          <div className="panel">
            <h2>Products</h2>
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>State</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id}>
                    <td>{product.title}</td>
                    <td>{formatBbd(product.priceCents)}</td>
                    <td>{product.stockQty}</td>
                    <td>{product.active ? 'Active' : 'Inactive'}</td>
                    <td className="row">
                      <button type="button" onClick={() => beginEdit(product)}>Edit</button>
                      <button type="button" onClick={() => void removeProduct(product.id)} disabled={saving}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'orders' && (
        <section className="panel">
          <h2>Orders</h2>
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Contact</th>
                <th>Total</th>
                <th>Payment</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>{order.customerName}<br /><span className="muted">{order.shippingAddress1}</span></td>
                  <td>{order.customerPhone ?? '-'}<br /><span className="muted">{order.customerEmail ?? '-'}</span></td>
                  <td>{formatBbd(order.totalCents)}</td>
                  <td>{order.payments?.[0]?.status ?? 'N/A'}</td>
                  <td>{order.status}</td>
                  <td>
                    <select value={order.status} onChange={(event) => void updateOrderStatus(order.id, event.target.value as OrderStatus)} disabled={saving}>
                      <option value="PENDING">PENDING</option>
                      <option value="PAID">PAID</option>
                      <option value="PACKED">PACKED</option>
                      <option value="SHIPPED">SHIPPED</option>
                      <option value="CANCELLED">CANCELLED</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {tab === 'insights' && (
        <section className="panel">
          <h2>Insights</h2>
          <p>
            view_product: {analytics?.views ?? 0} | add_to_cart: {analytics?.addToCart ?? 0} | begin_checkout: {analytics?.beginCheckout ?? 0} | purchase: {analytics?.purchases ?? 0}
          </p>
          <h3>Low stock alerts</h3>
          <ul>
            {lowStock.map((product) => (
              <li key={product.id}>{product.title} ({product.stockQty} left)</li>
            ))}
            {lowStock.length === 0 && <li>No low stock alerts.</li>}
          </ul>
          <div className="row">
            <button type="button" onClick={() => void queueDailySummary()} disabled={saving}>Queue daily sales email</button>
          </div>
          <h3>Automation outbox</h3>
          <ul>
            {outbox.slice(-10).reverse().map((item) => (
              <li key={item.id}>
                [{item.channel}] {item.eventType ?? item.subject ?? 'notification'} to {item.to} at {new Date(item.createdAt).toLocaleString()}
              </li>
            ))}
            {outbox.length === 0 && <li>No queued notifications yet.</li>}
          </ul>
        </section>
      )}
    </main>
  )
}

export default App
