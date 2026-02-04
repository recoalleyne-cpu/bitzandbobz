import { useEffect, useMemo, useState } from 'react'
import { brand } from '@bitz/config/brand'
import { catalogCategories, getCatalogCategoryLabel, type CatalogCategoryId } from '@bitz/config/categories'
import { currency, formatMoney } from '@bitz/config/currency'
import { getDefaultShippingCountry } from '@bitz/config/shipping'
import './App.css'

type Category = CatalogCategoryId

type Product = {
  id: string
  title: string
  slug: string
  description: string | null
  priceCents: number
  currency: string
  category: Category
  imageUrl: string | null
  imageUrls: string[]
  stockQty: number
  active: boolean
}

type ProductDetailResponse = {
  product: Product
  related: Product[]
}

type CheckoutForm = {
  customerName: string
  customerPhone: string
  customerEmail: string
  shippingAddress: string
  parish: string
}

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/+$/, '')
const SESSION_KEY = 'bb_store_session_id'
const CART_KEY = 'bb_store_cart'
const DEFAULT_SHIPPING_COUNTRY = getDefaultShippingCountry()

function apiUnreachableMessage(): string {
  return `Can't reach the API at ${API_BASE}. Please try again shortly.`
}

function isNetworkFailure(error: unknown): boolean {
  return error instanceof TypeError
}

function toUserFacingError(error: unknown): string {
  if (isNetworkFailure(error)) return apiUnreachableMessage()
  if (error instanceof Error) return error.message
  return 'Request failed.'
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

function getSessionId(): string {
  const existing = localStorage.getItem(SESSION_KEY)
  if (existing) return existing
  const next = `sess_${Math.random().toString(36).slice(2)}_${Date.now()}`
  localStorage.setItem(SESSION_KEY, next)
  return next
}

async function trackEvent(eventType: string, payload: Record<string, unknown>) {
  const sessionId = getSessionId()
  await fetch(`${API_BASE}/analytics/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventType, sessionId, payload }),
  }).catch(() => undefined)
}

function App() {
  const [view, setView] = useState<'catalog' | 'product' | 'checkout'>('catalog')
  const [catalog, setCatalog] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<Category | ''>('')
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('Loading products...')
  const [apiUnreachable, setApiUnreachable] = useState(false)
  const [checkoutMessage, setCheckoutMessage] = useState<string>('')
  const [quote, setQuote] = useState<{ subtotalCents: number; shippingCents: number; totalCents: number } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [cart, setCart] = useState<Record<string, number>>(() => {
    try {
      const raw = localStorage.getItem(CART_KEY)
      if (!raw) return {}
      return JSON.parse(raw) as Record<string, number>
    } catch {
      return {}
    }
  })
  const [checkoutForm, setCheckoutForm] = useState<CheckoutForm>({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    shippingAddress: '',
    parish: '',
  })

  const cartItems = useMemo(() => {
    return catalog
      .filter((product) => cart[product.id] !== undefined)
      .map((product) => ({ product, quantity: cart[product.id] }))
      .filter((line) => line.quantity > 0)
  }, [catalog, cart])

  const cartSubtotalCents = useMemo(() => {
    return cartItems.reduce((sum, line) => sum + line.product.priceCents * line.quantity, 0)
  }, [cartItems])

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(cart))
  }, [cart])

  async function loadCatalog() {
    setStatus('Loading products...')
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('search', search.trim())
      if (category) params.set('category', category)

      const response = await fetch(`${API_BASE}/catalog/products?${params.toString()}`)
      if (!response.ok) throw new Error(await parseErrorMessage(response))
      const data = (await response.json()) as Product[]
      setCatalog(data)
      setApiUnreachable(false)
      setStatus('Live catalog ready.')
    } catch (error) {
      setApiUnreachable(isNetworkFailure(error))
      setStatus(toUserFacingError(error))
    }
  }

  useEffect(() => {
    void loadCatalog()
  }, [category])

  useEffect(() => {
    const timeout = setTimeout(() => {
      void loadCatalog()
      if (search.trim()) {
        void trackEvent('search', { q: search.trim() })
      }
    }, 250)
    return () => clearTimeout(timeout)
  }, [search])

  async function openProduct(product: Product) {
    setView('product')
    setStatus('Loading product...')
    try {
      const response = await fetch(`${API_BASE}/catalog/products/${product.slug}`)
      if (!response.ok) throw new Error(await parseErrorMessage(response))
      const data = (await response.json()) as ProductDetailResponse
      setSelectedProduct(data.product)
      setRelatedProducts(data.related)
      const gallery = [data.product.imageUrl, ...(data.product.imageUrls || [])].filter(Boolean) as string[]
      setSelectedImage(gallery[0] || null)
      setApiUnreachable(false)
      setStatus('Product detail loaded.')
      void trackEvent('view_product', { productId: data.product.id, slug: data.product.slug })
    } catch (error) {
      setApiUnreachable(isNetworkFailure(error))
      setStatus(toUserFacingError(error))
    }
  }

  function addToCart(productId: string) {
    setCart((prev) => ({ ...prev, [productId]: (prev[productId] ?? 0) + 1 }))
    void trackEvent('add_to_cart', { productId })
  }

  function removeFromCart(productId: string) {
    setCart((prev) => {
      const next = { ...prev }
      const currentQty = next[productId] ?? 0
      if (currentQty <= 1) delete next[productId]
      else next[productId] = currentQty - 1
      return next
    })
  }

  async function quoteCheckout() {
    if (cartItems.length === 0) return
    setCheckoutMessage('Calculating shipping...')
    try {
      const response = await fetch(`${API_BASE}/checkout/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currency: currency.code,
          shippingCountry: DEFAULT_SHIPPING_COUNTRY.name,
          parish: checkoutForm.parish || null,
          items: cartItems.map((line) => ({ productId: line.product.id, quantity: line.quantity })),
        }),
      })
      if (!response.ok) throw new Error(await parseErrorMessage(response))
      const data = (await response.json()) as { subtotalCents: number; shippingCents: number; totalCents: number }
      setQuote(data)
      setApiUnreachable(false)
      setCheckoutMessage('Shipping quote ready.')
    } catch (error) {
      setApiUnreachable(isNetworkFailure(error))
      setCheckoutMessage(toUserFacingError(error))
    }
  }

  async function submitCheckout() {
    if (cartItems.length === 0) return
    setSubmitting(true)
    setCheckoutMessage('Processing payment...')
    void trackEvent('begin_checkout', { items: cartItems.length, subtotalCents: cartSubtotalCents })

    try {
      const response = await fetch(`${API_BASE}/checkout/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...checkoutForm,
          currency: currency.code,
          shippingCountry: DEFAULT_SHIPPING_COUNTRY.name,
          paymentMethod: 'SIMULATED_CARD',
          items: cartItems.map((line) => ({ productId: line.product.id, quantity: line.quantity })),
        }),
      })
      if (!response.ok) throw new Error(await parseErrorMessage(response))
      const data = (await response.json()) as { orderId: string; totalCents: number; paymentStatus: string }
      setCheckoutMessage(`Order ${data.orderId} placed. Payment: ${data.paymentStatus}. Total: ${formatMoney(data.totalCents)}.`)
      setCart({})
      setQuote(null)
      setCheckoutForm({ customerName: '', customerPhone: '', customerEmail: '', shippingAddress: '', parish: '' })
      await loadCatalog()
      setApiUnreachable(false)
    } catch (error) {
      setApiUnreachable(isNetworkFailure(error))
      setCheckoutMessage(toUserFacingError(error))
    } finally {
      setSubmitting(false)
    }
  }

  function applyCategoryFilter(next: Category | '') {
    setCategory(next)
    if (next) {
      void trackEvent('filter_category', { category: next })
    }
  }

  return (
    <main className="app">
      <header className="hero">
        <h1>{brand.storeName}</h1>
        <p>{brand.tagline}</p>
        <nav className="tabs">
          <button type="button" className={view === 'catalog' ? 'active' : ''} onClick={() => setView('catalog')}>Catalog</button>
          <button type="button" className={view === 'checkout' ? 'active' : ''} onClick={() => setView('checkout')}>Checkout ({cartItems.length})</button>
          {view === 'product' && <button type="button" className="active" onClick={() => setView('catalog')}>Back to catalog</button>}
        </nav>
        <p className="status">{status}</p>
        {apiUnreachable && (
          <div className="alert" role="alert" aria-live="polite">
            <div>
              <strong>API unreachable.</strong> {apiUnreachableMessage()}
            </div>
            <button type="button" onClick={() => void loadCatalog()}>Retry</button>
          </div>
        )}
      </header>

      {view === 'catalog' && (
        <section>
          <div className="filters">
            <input
              placeholder="Search products"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <select value={category} onChange={(event) => applyCategoryFilter(event.target.value as Category | '')}>
              <option value="">All categories</option>
              {catalogCategories.map((option) => (
                <option value={option.id} key={option.id}>{option.label}</option>
              ))}
            </select>
          </div>

          <div className="grid">
            {catalog.map((product) => (
              <article className="card" key={product.id}>
                <h2>{product.title}</h2>
                <p>{product.description ?? 'No description yet.'}</p>
                <p className="price">{formatMoney(product.priceCents)}</p>
                <p className="meta">{getCatalogCategoryLabel(product.category)} | Stock: {product.stockQty}</p>
                <div className="row">
                  <button type="button" onClick={() => void openProduct(product)}>View details</button>
                  <button type="button" onClick={() => addToCart(product.id)} disabled={product.stockQty === 0}>
                    {product.stockQty === 0 ? 'Out of stock' : 'Add to cart'}
                  </button>
                </div>
              </article>
            ))}
            {catalog.length === 0 && <p>No products found for this filter.</p>}
          </div>
        </section>
      )}

      {view === 'product' && selectedProduct && (
        <section className="checkout">
          <h2>{selectedProduct.title}</h2>
          {selectedImage && <img src={selectedImage} alt={selectedProduct.title} className="productImage" />}
          {([selectedProduct.imageUrl, ...(selectedProduct.imageUrls || [])].filter(Boolean) as string[]).length > 1 && (
            <div className="row">
              {([selectedProduct.imageUrl, ...(selectedProduct.imageUrls || [])].filter(Boolean) as string[]).map((image) => (
                <button key={image} type="button" onClick={() => setSelectedImage(image)}>
                  View image
                </button>
              ))}
            </div>
          )}
          <p>{selectedProduct.description ?? 'No description yet.'}</p>
          <p className="price">{formatMoney(selectedProduct.priceCents)}</p>
          <p>Category: {getCatalogCategoryLabel(selectedProduct.category)}</p>
          <p>Variant: Standard</p>
          <p>Availability: {selectedProduct.stockQty > 0 ? `${selectedProduct.stockQty} in stock` : 'Out of stock'}</p>
          <button type="button" onClick={() => addToCart(selectedProduct.id)} disabled={selectedProduct.stockQty === 0}>
            {selectedProduct.stockQty === 0 ? 'Out of stock' : 'Add to cart'}
          </button>

          <h3>Related products</h3>
          <div className="row">
            {relatedProducts.map((related) => (
              <button type="button" key={related.id} onClick={() => void openProduct(related)}>{related.title}</button>
            ))}
            {relatedProducts.length === 0 && <p>No related products yet.</p>}
          </div>
        </section>
      )}

      {view === 'checkout' && (
        <section className="checkout">
          <h2>Checkout</h2>
          <p>Shipping country: {DEFAULT_SHIPPING_COUNTRY.name} only</p>
          <p>Currency: {currency.code} only</p>
          <p>Items: {cartItems.length}</p>
          <p>Cart subtotal: {formatMoney(cartSubtotalCents)}</p>

          <div className="grid2">
            <div>
              <label>Name<input value={checkoutForm.customerName} onChange={(event) => setCheckoutForm({ ...checkoutForm, customerName: event.target.value })} /></label>
              <label>Phone<input value={checkoutForm.customerPhone} onChange={(event) => setCheckoutForm({ ...checkoutForm, customerPhone: event.target.value })} /></label>
              <label>Email<input value={checkoutForm.customerEmail} onChange={(event) => setCheckoutForm({ ...checkoutForm, customerEmail: event.target.value })} /></label>
              <label>Address<input value={checkoutForm.shippingAddress} onChange={(event) => setCheckoutForm({ ...checkoutForm, shippingAddress: event.target.value })} /></label>
              <label>Parish<input value={checkoutForm.parish} onChange={(event) => setCheckoutForm({ ...checkoutForm, parish: event.target.value })} /></label>
              <div className="row">
                <button type="button" onClick={() => void quoteCheckout()} disabled={cartItems.length === 0}>Get shipping quote</button>
                <button type="button" onClick={() => void submitCheckout()} disabled={cartItems.length === 0 || submitting}>Pay (Simulated Card)</button>
              </div>
            </div>

            <div>
              <h3>Order summary</h3>
              <ul>
                {cartItems.map((line) => (
                  <li key={line.product.id}>
                    {line.product.title} x {line.quantity} ({formatMoney(line.product.priceCents * line.quantity)}){' '}
                    <button type="button" onClick={() => removeFromCart(line.product.id)}>Remove one</button>
                  </li>
                ))}
              </ul>
              {quote && (
                <p>
                  Subtotal: {formatMoney(quote.subtotalCents)} | Shipping: {formatMoney(quote.shippingCents)} | Total: {formatMoney(quote.totalCents)}
                </p>
              )}
            </div>
          </div>

          {checkoutMessage && <p className="status">{checkoutMessage}</p>}
        </section>
      )}
    </main>
  )
}

export default App
