"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  ChevronDown,
  CircleUserRound,
  CreditCard,
  Headphones,
  Heart,
  Leaf,
  MapPin,
  Menu,
  Minus,
  PackageCheck,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  ShoppingCart,
  Sprout,
  Tag,
  Tractor,
  Truck,
  Wrench,
  X,
} from "lucide-react";
import Link from "next/link";
import {
  AuthSession,
  beginCognitoSignIn,
  cognitoIsConfigured,
  completeCognitoSignIn,
  createDemoSession,
  isUserAdmin,
  readAuthSession,
  signOut,
} from "@/lib/cognito";
import { apiRequest } from "@/lib/api";

type Product = {
  id: number;
  name: string;
  category: string;
  price: number;
  oldPrice?: number;
  image: string;
  badge?: string;
  unit: string;
  stock: number;
  rating: number;
  description: string;
};

const categoryOptions = [
  { name: "Semillas", icon: Sprout, copy: "Cultivos y praderas" },
  { name: "Fertilizantes", icon: Leaf, copy: "Nutrición vegetal" },
  { name: "Protección de cultivos", icon: ShieldCheck, copy: "Manejo y cuidado" },
  { name: "Riego", icon: Truck, copy: "Conducción y goteo" },
  { name: "Herramientas", icon: Wrench, copy: "Trabajo diario" },
  { name: "Maquinaria", icon: Tractor, copy: "Equipos y repuestos" },
];

function getProductImage(item: any): string {
  if (item.imagenUrl) return item.imagenUrl;
  if (item.image) return item.image;
  const sku = (item.sku || "").toUpperCase();
  const name = (item.nombre || item.name || "").toLowerCase();
  const cat = (item.categoria || item.category || "").toLowerCase();

  if (sku.includes("MAIZ") || name.includes("maíz") || name.includes("maiz")) {
    return "https://images.unsplash.com/photo-1551754655-cd27e38d2076?auto=format&fit=crop&w=900&q=82";
  }
  if (sku.includes("TRIG") || name.includes("trigo")) {
    return "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=900&q=82";
  }
  if (sku.includes("NPK") || name.includes("npk")) {
    return "https://valleyfertilizer.net/wp-content/uploads/2024/02/generic-fertilizer-bag.jpg";
  }
  if (sku.includes("UREA") || name.includes("urea")) {
    return "https://images.unsplash.com/photo-1628352081506-83c43123ed6d?auto=format&fit=crop&w=900&q=82";
  }
  if (sku.includes("TIJ") || name.includes("tijera")) {
    return "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=900&q=82";
  }
  if (cat.includes("semilla")) {
    return "https://images.unsplash.com/photo-1492496913980-501348b61469?auto=format&fit=crop&w=900&q=82";
  }
  if (cat.includes("fertilizante")) {
    return "https://valleyfertilizer.net/wp-content/uploads/2024/02/generic-fertilizer-bag.jpg";
  }
  if (cat.includes("riego")) {
    return "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?auto=format&fit=crop&w=900&q=82";
  }
  if (cat.includes("herramienta")) {
    return "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=900&q=82";
  }
  return "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?auto=format&fit=crop&w=900&q=82";
}

const regions = [
  "Región de Coquimbo",
  "Región de Valparaíso",
  "Región Metropolitana",
  "Región de O’Higgins",
  "Región del Maule",
  "Región de Ñuble",
  "Región del Biobío",
  "Región de La Araucanía",
  "Región de Los Lagos",
];

const money = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

export default function AgroCenterApp() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todas");
  const [sort, setSort] = useState("featured");
  const [cart, setCart] = useState<Record<number, number>>({});
  const [wishlist, setWishlist] = useState<number[]>([]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [region, setRegion] = useState("Región Metropolitana");
  const [session, setSession] = useState<AuthSession | null>(null);
  const [authError, setAuthError] = useState("");
  const [toast, setToast] = useState("");

  // Estado del catálogo dinámico proveniente del BFF (fuente de datos única)
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState<boolean>(true);

  useEffect(() => {
    completeCognitoSignIn()
      .then((completed) => {
        const active = completed ?? readAuthSession();
        if (active) {
          setSession(active);
          setAuthError("");
        }
      })
      .catch((error: unknown) => {
        const active = readAuthSession();
        if (active) {
          setSession(active);
          setAuthError("");
        } else {
          setAuthError(error instanceof Error ? error.message : "No fue posible iniciar sesión.");
        }
      });
  }, []);

  // Cargar catálogo exclusivamente desde GET /api/bff/catalogo (disponible para visitantes anónimos y autenticados)
  useEffect(() => {
    setIsLoadingCatalog(true);
    apiRequest<any>("/api/bff/catalogo")
      .then((data) => {
        const items = Array.isArray(data) ? data : data?.content || [];
        const mapped: Product[] = items.map((p: any) => ({
          id: p.id,
          name: p.nombre || p.name || `Insumo ${p.sku || p.id}`,
          category: p.categoria || p.category || "General",
          price: p.precioVenta ?? p.precio ?? p.price ?? 0,
          oldPrice: p.precioAnterior || p.oldPrice,
          badge: p.badge || (p.enOferta ? "Oferta" : undefined),
          unit: p.unidad || p.unit || "Unidad",
          stock: p.stockActual ?? p.stock ?? 0,
          rating: p.calificacion || p.rating || 4.8,
          description: p.descripcion || p.description || "",
          image: getProductImage(p),
        }));
        setCatalog(mapped);
      })
      .catch((err) => {
        console.warn("BFF catálogo no disponible o error de red:", err.message);
        setCatalog([]);
      })
      .finally(() => {
        setIsLoadingCatalog(false);
      });
  }, [session]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const visibleProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filtered = catalog.filter((product) => {
      const matchesSearch =
        !normalized ||
        `${product.name} ${product.category} ${product.description}`
          .toLowerCase()
          .includes(normalized);
      return matchesSearch && (category === "Todas" || product.category === category);
    });
    return [...filtered].sort((a, b) => {
      if (sort === "price-low") return a.price - b.price;
      if (sort === "price-high") return b.price - a.price;
      if (sort === "rating") return b.rating - a.rating;
      return Number(Boolean(b.badge)) - Number(Boolean(a.badge));
    });
  }, [catalog, category, query, sort]);

  const cartItems = useMemo(
    () =>
      catalog
        .filter((product) => cart[product.id])
        .map((product) => ({ ...product, quantity: cart[product.id] })),
    [catalog, cart]
  );
  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  function addToCart(product: Product, open = false) {
    setCart((current) => ({ ...current, [product.id]: (current[product.id] ?? 0) + 1 }));
    setToast(`${product.name} se agregó al carrito.`);
    if (open) setCartOpen(true);
  }

  function changeQuantity(id: number, delta: number) {
    setCart((current) => {
      const nextQuantity = (current[id] ?? 0) + delta;
      if (nextQuantity <= 0) {
        const next = { ...current };
        delete next[id];
        return next;
      }
      return { ...current, [id]: nextQuantity };
    });
  }

  function chooseCategory(nextCategory: string) {
    setCategory(nextCategory);
    setMobileOpen(false);
    window.setTimeout(
      () => document.querySelector("#productos")?.scrollIntoView({ behavior: "smooth" }),
      0
    );
  }

  async function submitCheckout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session) {
      setCheckoutOpen(false);
      setAuthError("Debes iniciar sesión con AgroCenter para completar la compra.");
      setAccountOpen(true);
      return;
    }

    // Contrato exigido por el BFF: POST /api/bff/ventas
    const payload = {
      items: cartItems.map((item) => ({
        productoId: item.id,
        cantidad: item.quantity,
      })),
    };

    setIsSubmittingOrder(true);
    try {
      await apiRequest("/api/bff/ventas", {
        method: "POST",
        headers: {
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify(payload),
      });

      setOrderPlaced(true);
      setCart({});
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : "No fue posible procesar la orden en el servidor.");
    } finally {
      setIsSubmittingOrder(false);
    }
  }

  return (
    <main className="storefront">
      <div className="promo-bar">
        <p><Truck size={14} /> Despacho a todo Chile</p>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          {isUserAdmin(session) && (
            <Link
              href="/admin"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                background: "rgba(220, 236, 183, 0.22)",
                border: "1px solid rgba(220, 236, 183, 0.4)",
                color: "#dcecb7",
                padding: "2px 8px",
                borderRadius: "5px",
                fontSize: "11px",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              <ShieldCheck size={12} />
              <span>Modo Admin</span>
            </Link>
          )}
          <p>Compra segura · Atención experta</p>
        </div>
      </div>

      <header className="store-header">
        <div className="header-main shell">
          <button className="mobile-trigger" type="button" onClick={() => setMobileOpen(true)} aria-label="Abrir categorías"><Menu /></button>
          <a className="store-logo" href="#inicio" aria-label="AgroCenter inicio">
            <span><Leaf size={25} /></span>
            <strong>AgroCenter<small>Todo para tu campo</small></strong>
          </a>
          <label className="main-search">
            <Search size={20} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="¿Qué necesitas para tu campo?" />
            <a href="#productos">Buscar</a>
          </label>
          <button className="header-action location-action" type="button" onClick={() => setLocationOpen(true)}><MapPin /><span>Entregar en<small>{region}</small></span><ChevronDown size={15} /></button>
          <button className="header-action" type="button" onClick={() => setAccountOpen(true)}><CircleUserRound /><span>{session ? `Hola, ${session.name.split(" ")[0]}` : "Hola, ingresa"}<small>Mi cuenta</small></span></button>
          {isUserAdmin(session) && (
            <Link
              href="/admin"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "6px 12px",
                background: "var(--green-100)",
                color: "var(--green-900)",
                border: "1px solid #c7decb",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: 700,
                textDecoration: "none",
              }}
              title="Panel de Administración"
            >
              <ShieldCheck size={15} color="var(--green-800)" />
              <span>Admin</span>
            </Link>
          )}
          <button className="cart-button" type="button" onClick={() => setCartOpen(true)} aria-label={`Carrito con ${cartCount} productos`}><ShoppingCart /><span>{cartCount}</span></button>
        </div>

        <nav className={`category-nav ${mobileOpen ? "open" : ""}`} aria-label="Categorías principales">
          <div className="mobile-nav-head"><strong>Categorías</strong><button type="button" onClick={() => setMobileOpen(false)} aria-label="Cerrar menú"><X /></button></div>
          <div className="shell nav-inner">
            <button className="all-categories" type="button" onClick={() => chooseCategory("Todas")}><Menu size={17} /> Todas las categorías <ChevronDown size={14} /></button>
            <a href="#ofertas">Ofertas</a>
            <a href="#temporada">Temporada de siembra</a>
            <button type="button" onClick={() => chooseCategory("Fertilizantes")}>Insumos agrícolas</button>
            <button type="button" onClick={() => chooseCategory("Maquinaria")}>Maquinaria</button>
            <a href="#ayuda">Asesoría técnica</a>
            <a className="seller-link" href="#vender">Vende en AgroCenter</a>
          </div>
        </nav>
        {mobileOpen && <button className="nav-overlay" type="button" onClick={() => setMobileOpen(false)} aria-label="Cerrar menú" />}
      </header>

      <section className="hero shell" id="inicio">
        <div className="hero-copy">
          <span className="hero-kicker"><Tag size={14} /> Especial de temporada</span>
          <h1>Prepara hoy una cosecha más productiva.</h1>
          <p>Insumos, herramientas y soluciones agrícolas seleccionadas por expertos, con despacho directo a tu campo.</p>
          <div className="hero-actions"><a className="primary-cta" href="#productos">Ver ofertas</a><a className="secondary-cta" href="#categorias">Explorar categorías</a></div>
          <div className="hero-trust"><PackageCheck size={18} /><span><b>Compra protegida</b><small>Soporte antes y después de tu compra</small></span></div>
        </div>
        <div className="hero-offer"><span>Hasta</span><strong>25%</strong><b>de descuento</b><p>en productos seleccionados</p></div>
      </section>

      <section className="value-strip shell" aria-label="Beneficios de compra">
        <div><Truck /><span><b>Despacho nacional</b><small>Cobertura de Arica a Chiloé</small></span></div>
        <div><CreditCard /><span><b>Pago flexible</b><small>Débito, crédito y transferencia</small></span></div>
        <div><Headphones /><span><b>Asesoría agrícola</b><small>Expertos antes de comprar</small></span></div>
        <div><RotateCcw /><span><b>Compra protegida</b><small>Resolvemos cualquier problema</small></span></div>
      </section>

      <section className="section shell" id="categorias">
        <div className="section-heading"><div><span className="eyebrow">Encuentra más rápido</span><h2>Compra por categoría</h2></div><button type="button" onClick={() => chooseCategory("Todas")}>Ver todas <ArrowRight size={15} /></button></div>
        <div className="category-grid">
          {categoryOptions.map(({ name, icon: Icon, copy }) => <button type="button" className={`category-card ${category === name ? "active" : ""}`} onClick={() => chooseCategory(name)} key={name}><span><Icon /></span><b>{name}</b><small>{copy}</small><ArrowRight size={15} /></button>)}
        </div>
      </section>

      <section className="campaign-grid shell" id="ofertas">
        <article className="campaign-card campaign-dark"><span>Compra inteligente</span><h2>Precios por volumen para tu operación.</h2><p>Cotiza cantidades mayores y recibe atención comercial personalizada.</p><a href="#ayuda">Solicitar cotización <ArrowRight size={16} /></a></article>
        <article className="campaign-card campaign-light"><span>Riego eficiente</span><h2>Aprovecha mejor cada gota.</h2><p>Encuentra cintas, mangueras y conexiones para tu próxima instalación.</p><button type="button" onClick={() => chooseCategory("Riego")}>Ver soluciones <ArrowRight size={16} /></button></article>
      </section>

      <section className="section products-section shell" id="productos">
        <div className="section-heading"><div><span className="eyebrow">Precios especiales online</span><h2>{category === "Todas" ? "Ofertas para tu campo" : category}</h2></div><p>{visibleProducts.length} productos</p></div>
        <div className="catalog-toolbar">
          <div className="filter-chips">
            {["Todas", ...categoryOptions.map((item) => item.name)].map((item) => <button type="button" className={category === item ? "active" : ""} onClick={() => setCategory(item)} key={item}>{item}</button>)}
          </div>
          <label>Ordenar por<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="featured">Destacados</option><option value="price-low">Menor precio</option><option value="price-high">Mayor precio</option><option value="rating">Mejor evaluados</option></select></label>
        </div>
        <div className="product-grid">
          {visibleProducts.map((product) => (
            <article className="product-card" key={product.id}>
              <div className="product-image" onClick={() => setSelectedProduct(product)}><img src={product.image} alt={product.name} />{product.badge && <span>{product.badge}</span>}<button type="button" className={wishlist.includes(product.id) ? "saved" : ""} onClick={(event) => { event.stopPropagation(); setWishlist((current) => current.includes(product.id) ? current.filter((id) => id !== product.id) : [...current, product.id]); }} aria-label={`Guardar ${product.name}`}><Heart size={18} fill={wishlist.includes(product.id) ? "currentColor" : "none"} /></button></div>
              <div className="product-info"><p>{product.category}</p><button className="product-title" type="button" onClick={() => setSelectedProduct(product)}><h3>{product.name}</h3></button><div className="rating"><span>★</span> {product.rating} <small>· {product.stock} disponibles</small></div><small>{product.unit}</small><div className="product-price">{product.oldPrice && <del>{money.format(product.oldPrice)}</del>}<strong>{money.format(product.price)}</strong><em>Precio con IVA</em></div><button className="add-button" type="button" onClick={() => addToCart(product)}><ShoppingCart size={17} /> Agregar al carrito</button></div>
            </article>
          ))}
        </div>
        {isLoadingCatalog && visibleProducts.length === 0 && (
          <div className="empty-products">
            <h3>Cargando catálogo oficial...</h3>
            <p>Conectando con el inventario de AgroCenter en tiempo real.</p>
          </div>
        )}
        {!isLoadingCatalog && visibleProducts.length === 0 && (
          <div className="empty-products"><Search /><h3>No encontramos coincidencias</h3><p>Prueba con “semillas”, “riego” o “fertilizante”.</p><button type="button" onClick={() => { setQuery(""); setCategory("Todas"); }}>Limpiar búsqueda</button></div>
        )}
      </section>

      <section className="season-banner shell" id="temporada">
        <div><span className="eyebrow">Planifica la campaña</span><h2>Temporada de siembra</h2><p>Reúne semillas, nutrición, riego y herramientas en una sola compra. Te ayudamos a elegir según cultivo, superficie y ubicación.</p><a href="#ayuda">Hablar con un especialista <ArrowRight size={16} /></a></div>
        <div className="season-steps"><span><b>1</b>Cuéntanos tu cultivo</span><span><b>2</b>Recibe una recomendación</span><span><b>3</b>Despachamos a tu campo</span></div>
      </section>

      <section className="section brands shell"><span className="eyebrow">Marcas seleccionadas</span><h2>Calidad que trabaja contigo</h2><div><b>BioCampo</b><b>AquaRiego</b><b>TerraNorte</b><b>AgriPro</b><b>CampoSur</b></div></section>

      <section className="help-section" id="ayuda"><div className="shell help-inner"><div><span className="eyebrow">¿No sabes cuál elegir?</span><h2>Conversemos sobre tu campo.</h2><p>Nuestro equipo te orienta para encontrar una solución adecuada a tu cultivo, escala y presupuesto.</p></div><a href="mailto:ventas@agrocenter.cl"><Headphones size={19} /> Pedir asesoría</a></div></section>

      <footer className="store-footer">
        <div className="shell footer-grid">
          <div><a className="store-logo footer-logo" href="#inicio"><span><Leaf size={25} /></span><strong>AgroCenter<small>Todo para tu campo</small></strong></a><p>Una forma simple y confiable de comprar soluciones agrícolas en Chile.</p></div>
          <div><h3>Comprar</h3><a href="#categorias">Categorías</a><a href="#productos">Ofertas</a><a href="#temporada">Temporada</a></div>
          <div><h3>Ayuda</h3><a href="#ayuda">Asesoría técnica</a><button type="button" onClick={() => setLocationOpen(true)}>Despachos</button><button type="button" onClick={() => setAccountOpen(true)}>Mi cuenta</button></div>
          <div id="vender"><h3>Empresas</h3><a href="mailto:ventas@agrocenter.cl">Ventas por volumen</a><a href="mailto:proveedores@agrocenter.cl">Vender en AgroCenter</a><a href="mailto:contacto@agrocenter.cl">Contacto</a></div>
        </div>
        <div className="shell footer-bottom"><p>© 2026 AgroCenter. MVP demostrativo.</p><div><span>Compra segura</span><span>Datos protegidos</span></div></div>
      </footer>

      {cartOpen && <><button className="drawer-overlay" type="button" onClick={() => setCartOpen(false)} aria-label="Cerrar carrito" /><aside className="cart-drawer" aria-label="Carrito de compras"><div className="drawer-head"><div><span>Tu compra</span><h2>Carrito ({cartCount})</h2></div><button type="button" onClick={() => setCartOpen(false)} aria-label="Cerrar carrito"><X /></button></div>{cartItems.length ? <><div className="cart-items">{cartItems.map((item) => <article className="cart-item" key={item.id}><img src={item.image} alt="" /><div><b>{item.name}</b><small>{item.unit}</small><div className="quantity-control"><button type="button" onClick={() => changeQuantity(item.id, -1)} aria-label="Quitar una unidad"><Minus size={14} /></button><span>{item.quantity}</span><button type="button" onClick={() => changeQuantity(item.id, 1)} aria-label="Agregar una unidad"><Plus size={14} /></button></div></div><strong>{money.format(item.price * item.quantity)}</strong></article>)}</div><div className="cart-summary"><p><span>Subtotal</span><b>{money.format(subtotal)}</b></p><p><span>Despacho</span><small>Se calcula según comuna</small></p><button type="button" onClick={() => { setCartOpen(false); setOrderPlaced(false); setCheckoutOpen(true); }}>Continuar compra <ArrowRight size={16} /></button><span><ShieldCheck size={15} /> Compra protegida por AgroCenter</span></div></> : <div className="empty-cart"><ShoppingCart /><h3>Tu carrito está vacío</h3><p>Explora el catálogo y agrega lo que necesita tu campo.</p><button type="button" onClick={() => setCartOpen(false)}>Ver productos</button></div>}</aside></>}

      {selectedProduct && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setSelectedProduct(null)}><section className="product-modal"><button className="modal-close" type="button" onClick={() => setSelectedProduct(null)} aria-label="Cerrar detalle"><X /></button><div className="modal-product-image"><img src={selectedProduct.image} alt={selectedProduct.name} />{selectedProduct.badge && <span>{selectedProduct.badge}</span>}</div><div className="modal-product-copy"><span className="eyebrow">{selectedProduct.category}</span><h2>{selectedProduct.name}</h2><div className="rating"><span>★</span> {selectedProduct.rating} · {selectedProduct.stock} disponibles</div><p>{selectedProduct.description}</p><ul><li><Check size={15} /> Despacho disponible a regiones</li><li><Check size={15} /> Soporte técnico para tu compra</li><li><Check size={15} /> Garantía de satisfacción</li></ul><div className="modal-price">{selectedProduct.oldPrice && <del>{money.format(selectedProduct.oldPrice)}</del>}<strong>{money.format(selectedProduct.price)}</strong><small>{selectedProduct.unit} · IVA incluido</small></div><button className="primary-modal-action" type="button" onClick={() => { addToCart(selectedProduct, true); setSelectedProduct(null); }}><ShoppingCart size={18} /> Agregar y ver carrito</button></div></section></div>}

      {checkoutOpen && <div className="modal-backdrop"><section className="checkout-modal"><button className="modal-close" type="button" onClick={() => { setCheckoutOpen(false); setOrderPlaced(false); }} aria-label="Cerrar checkout"><X /></button>{orderPlaced ? <div className="success-state"><span><Check /></span><p>Solicitud recibida</p><h2>¡Gracias por comprar en AgroCenter!</h2><p>Tu orden ha sido registrada en el sistema de ventas con éxito.</p><button type="button" onClick={() => { setCheckoutOpen(false); setOrderPlaced(false); }}>Volver a la tienda</button></div> : <><div className="checkout-head"><span>Último paso</span><h2>Datos de entrega</h2><p>Completa tus datos para confirmar el pedido a través de nuestros servicios.</p></div><form onSubmit={submitCheckout}><div className="form-grid"><label>Nombre y apellido<input required placeholder="Ej. Daniela Soto" /></label><label>Correo<input required type="email" placeholder="nombre@empresa.cl" /></label><label>Teléfono<input required type="tel" placeholder="+56 9 1234 5678" /></label><label>Región<select value={region} onChange={(event) => setRegion(event.target.value)}>{regions.map((item) => <option key={item}>{item}</option>)}</select></label><label className="full-field">Dirección o referencia de entrega<input required placeholder="Camino, parcela, comuna" /></label></div><div className="payment-demo"><CreditCard /><div><b>Pago en la siguiente etapa</b><p>La orden se registrará directamente en ms-ventas.</p></div></div><div className="checkout-total"><span>Total productos</span><strong>{money.format(subtotal)}</strong></div><button className="primary-modal-action" type="submit" disabled={isSubmittingOrder}><BadgeCheck size={18} /> {isSubmittingOrder ? "Procesando orden..." : "Confirmar solicitud"}</button></form></>}</section></div>}

      {accountOpen && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setAccountOpen(false)}><section className="small-modal"><button className="modal-close" type="button" onClick={() => setAccountOpen(false)} aria-label="Cerrar cuenta"><X /></button><span className="modal-symbol"><CircleUserRound /></span>{session ? <><p>Mi cuenta</p><h2>Hola, {session.name}</h2><small>{session.demo ? "Sesión de demostración" : session.role}</small><button className="primary-modal-action" type="button" onClick={() => { signOut(); setSession(null); setAccountOpen(false); }}>Cerrar sesión</button></> : <><p>Clientes AgroCenter</p><h2>Ingresa a tu cuenta</h2><small>Revisa compras, guarda productos y agiliza tus próximos pedidos.</small>{authError && <div className="form-error">{authError}</div>}<button className="primary-modal-action" type="button" onClick={() => { setAuthError(""); if (cognitoIsConfigured()) beginCognitoSignIn().catch((error: unknown) => setAuthError(error instanceof Error ? error.message : "No fue posible conectar.")); else setSession(createDemoSession()); }}>{cognitoIsConfigured() ? "Ingresar con AgroCenter" : "Entrar en modo demo"}</button></>}</section></div>}

      {locationOpen && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setLocationOpen(false)}><section className="small-modal"><button className="modal-close" type="button" onClick={() => setLocationOpen(false)} aria-label="Cerrar ubicación"><X /></button><span className="modal-symbol"><MapPin /></span><p>Zona de entrega</p><h2>¿Dónde está tu campo?</h2><small>Usamos tu región para orientar cobertura y despacho.</small><label className="region-select">Región<select value={region} onChange={(event) => setRegion(event.target.value)}>{regions.map((item) => <option key={item}>{item}</option>)}</select></label><button className="primary-modal-action" type="button" onClick={() => setLocationOpen(false)}>Guardar ubicación</button></section></div>}

      {toast && <div className="toast" role="status"><Check size={17} /> {toast}</div>}
    </main>
  );
}