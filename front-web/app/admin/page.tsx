"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  Database,
  Edit3,
  ExternalLink,
  FileText,
  Filter,
  Layers,
  Leaf,
  Package,
  Plus,
  RefreshCw,
  Search,
  Send,
  Server,
  ShieldCheck,
  ShoppingCart,
  Tag,
  Terminal,
  Truck,
  User,
  X,
  XCircle,
} from "lucide-react";
import { AuthSession, isUserAdmin, readAuthSession } from "@/lib/cognito";
import { apiRequest } from "@/lib/api";

type ApiEndpoint = {
  id: string;
  name: string;
  service: string;
  endpoint: string;
  method: "GET" | "POST";
  expectedStatus: number;
  description: string;
};

type PingResult = {
  status: "idle" | "loading" | "online" | "offline" | "error";
  statusCode?: number;
  latencyMs?: number;
  error?: string;
  lastChecked?: string;
};

type ProductAdmin = {
  id: number;
  sku: string;
  nombre: string;
  categoria: string;
  descripcion?: string;
  precioVenta: number;
  stockActual: number;
  stockMinimo: number;
  activo: boolean;
};

type SaleItemAdmin = {
  productoId: number;
  nombre?: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
};

type SaleAdmin = {
  id: number;
  clienteId: string;
  fechaCreacion: string;
  estado: string;
  subtotal: number;
  total: number;
  motivoCancelacion?: string;
  items: SaleItemAdmin[];
};

type PurchaseDetailAdmin = {
  id?: number;
  productoId: number;
  nombre?: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
};

type PurchaseAdmin = {
  id: number;
  proveedorId: number;
  proveedorNombre?: string;
  fechaCreacion: string;
  estado: string;
  total: number;
  detalles: PurchaseDetailAdmin[];
};

const monitoredEndpoints: ApiEndpoint[] = [
  {
    id: "bff-health",
    name: "BFF Health Check",
    service: "agrocenter-bff",
    endpoint: "/actuator/health",
    method: "GET",
    expectedStatus: 200,
    description: "Salud del contenedor BFF en AWS ECS Fargate",
  },
  {
    id: "bff-catalogo",
    name: "Catálogo Público",
    service: "ms-inventario",
    endpoint: "/api/bff/catalogo",
    method: "GET",
    expectedStatus: 200,
    description: "Consulta pública sin token (debe responder 200 OK sin NPE)",
  },
  {
    id: "bff-inventario",
    name: "Inventario General (ADMIN)",
    service: "ms-inventario",
    endpoint: "/api/bff/inventario",
    method: "GET",
    expectedStatus: 200,
    description: "Gestión completa de existencias en PostgreSQL RDS",
  },
  {
    id: "bff-ventas",
    name: "Ventas y Pedidos (ADMIN)",
    service: "ms-ventas",
    endpoint: "/api/bff/admin/ventas",
    method: "GET",
    expectedStatus: 200,
    description: "Historial consolidado de ventas y checkout",
  },
  {
    id: "bff-compras",
    name: "Órdenes de Compra (ADMIN)",
    service: "ms-compras",
    endpoint: "/api/bff/compras",
    method: "GET",
    expectedStatus: 200,
    description: "Abastecimiento de proveedores y reposición",
  },
];

const fallbackInitialProducts: ProductAdmin[] = [
  {
    id: 1,
    sku: "SEM-MAIZ-001",
    nombre: "Semillas de Maíz Híbrido 25 kg",
    categoria: "Semillas",
    descripcion: "Semillas de maíz de alto rendimiento para siembra en zonas templadas.",
    precioVenta: 45990,
    stockActual: 50,
    stockMinimo: 10,
    activo: true,
  },
  {
    id: 2,
    sku: "SEM-TRIG-002",
    nombre: "Semilla de Trigo Certificada 40 kg",
    categoria: "Semillas",
    descripcion: "Trigo de primavera de ciclo intermedio con alta resistencia a enfermedades.",
    precioVenta: 38990,
    stockActual: 40,
    stockMinimo: 10,
    activo: true,
  },
  {
    id: 3,
    sku: "FERT-NPK-001",
    nombre: "Fertilizante NPK Granulado 25 kg",
    categoria: "Fertilizantes",
    descripcion: "Mezcla equilibrada para apoyar el desarrollo vegetativo.",
    precioVenta: 31990,
    stockActual: 60,
    stockMinimo: 15,
    activo: true,
  },
  {
    id: 4,
    sku: "FERT-UREA-002",
    nombre: "Urea Agrícola 46% Nitrógeno 50 kg",
    categoria: "Fertilizantes",
    descripcion: "Fertilizante nitrogenado de alta concentración.",
    precioVenta: 34990,
    stockActual: 35,
    stockMinimo: 10,
    activo: true,
  },
  {
    id: 5,
    sku: "HERR-TIJ-001",
    nombre: "Tijeras de Podar Profesional Bypass",
    categoria: "Herramientas",
    descripcion: "Corte limpio y preciso con hoja de acero forjado.",
    precioVenta: 18990,
    stockActual: 30,
    stockMinimo: 5,
    activo: true,
  },
];

const quickRequestEndpoints = [
  { label: "GET /api/bff/catalogo (Público)", endpoint: "/api/bff/catalogo", method: "GET" },
  { label: "GET /api/bff/admin/inventario (Admin)", endpoint: "/api/bff/admin/inventario", method: "GET" },
  { label: "GET /api/bff/inventario/stock-bajo (Admin)", endpoint: "/api/bff/inventario/stock-bajo", method: "GET" },
  { label: "GET /api/bff/admin/ventas (Admin)", endpoint: "/api/bff/admin/ventas", method: "GET" },
  { label: "GET /api/bff/admin/compras (Admin)", endpoint: "/api/bff/admin/compras", method: "GET" },
  { label: "GET /api/bff/admin/dashboard (Agregado)", endpoint: "/api/bff/admin/dashboard", method: "GET" },
  { label: "GET /actuator/health (BFF)", endpoint: "/actuator/health", method: "GET" },
];

const fallbackInitialSales: SaleAdmin[] = [
  {
    id: 1,
    clienteId: "649894e8-2011-70ec-6e8a-35a6f59c3c14",
    fechaCreacion: new Date().toISOString(),
    estado: "CONFIRMADA",
    subtotal: 91980,
    total: 91980,
    items: [
      {
        productoId: 1,
        nombre: "Semillas de Maíz Híbrido 25 kg",
        cantidad: 2,
        precioUnitario: 45990,
        subtotal: 91980,
      },
    ],
  },
];

const fallbackInitialPurchases: PurchaseAdmin[] = [
  {
    id: 1,
    proveedorId: 101,
    proveedorNombre: "AgroQuímica del Sur S.A.",
    fechaCreacion: new Date(Date.now() - 86400000).toISOString(),
    estado: "COMPLETADA",
    total: 450000,
    detalles: [
      {
        id: 1,
        productoId: 3,
        nombre: "Fertilizante NPK Granulado 25 kg",
        cantidad: 25,
        precioUnitario: 18000,
        subtotal: 450000,
      },
    ],
  },
];

export default function AdminPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [activeTab, setActiveTab] = useState<"inventory" | "sales" | "purchases" | "apis" | "console">("inventory");

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Ping Monitor State
  const [pingResults, setPingResults] = useState<Record<string, PingResult>>({});
  const [isPingingAll, setIsPingingAll] = useState(false);

  // Inventory Manager State (ms-inventario)
  const [products, setProducts] = useState<ProductAdmin[]>(fallbackInitialProducts);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [productFeedback, setProductFeedback] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductAdmin | null>(null);

  // Sales State (ms-ventas)
  const [sales, setSales] = useState<SaleAdmin[]>(fallbackInitialSales);
  const [isLoadingSales, setIsLoadingSales] = useState(false);

  // Purchases State (ms-compras)
  const [purchases, setPurchases] = useState<PurchaseAdmin[]>(fallbackInitialPurchases);
  const [isLoadingPurchases, setIsLoadingPurchases] = useState(false);

  // Form State para Nuevo Producto
  const [newSku, setNewSku] = useState("");
  const [newNombre, setNewNombre] = useState("");
  const [newCategoria, setNewCategoria] = useState("Semillas");
  const [newDescripcion, setNewDescripcion] = useState("");
  const [newPrecio, setNewPrecio] = useState<number>(10000);
  const [newStock, setNewStock] = useState<number>(20);
  const [newStockMinimo, setNewStockMinimo] = useState<number>(5);
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);

  // Form State para Edición Rápida
  const [editPrecio, setEditPrecio] = useState<number>(0);
  const [editStock, setEditStock] = useState<number>(0);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Console State
  const [selectedConsoleEndpoint, setSelectedConsoleEndpoint] = useState(quickRequestEndpoints[0].endpoint);
  const [consoleResult, setConsoleResult] = useState<string | null>(null);
  const [consoleStatus, setConsoleStatus] = useState<number | null>(null);
  const [consoleLatency, setConsoleLatency] = useState<number | null>(null);
  const [isExecutingConsole, setIsExecutingConsole] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    const currentSession = readAuthSession();
    setSession(currentSession);
    loadInventory(currentSession);
    loadSales();
    loadPurchases();
  }, []);

  const API_BASE_URL = (
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    ""
  ).replace(/\/$/, "");

  // Función para hacer Ping a un endpoint individual
  async function pingEndpoint(endpointConfig: ApiEndpoint) {
    setPingResults((prev) => ({
      ...prev,
      [endpointConfig.id]: { status: "loading" },
    }));

    const start = performance.now();
    try {
      const cleanEndpoint = endpointConfig.endpoint.startsWith("/")
        ? endpointConfig.endpoint
        : `/${endpointConfig.endpoint}`;
      const url = `${API_BASE_URL}${cleanEndpoint}`;

      const activeSession = session || readAuthSession();
      const token = activeSession?.accessToken || activeSession?.idToken;
      const headers: Record<string, string> = {
        Accept: "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(url, {
        method: endpointConfig.method,
        headers,
      });

      const end = performance.now();
      const latencyMs = Math.round(end - start);

      setPingResults((prev) => ({
        ...prev,
        [endpointConfig.id]: {
          status: response.ok ? "online" : "error",
          statusCode: response.status,
          latencyMs,
          lastChecked: new Date().toLocaleTimeString(),
        },
      }));
    } catch (err: unknown) {
      const end = performance.now();
      const latencyMs = Math.round(end - start);
      setPingResults((prev) => ({
        ...prev,
        [endpointConfig.id]: {
          status: "offline",
          statusCode: 502,
          latencyMs,
          error: err instanceof Error ? err.message : "Error de red o timeout",
          lastChecked: new Date().toLocaleTimeString(),
        },
      }));
    }
  }

  // Ping a todos los endpoints
  async function pingAllEndpoints() {
    setIsPingingAll(true);
    for (const ep of monitoredEndpoints) {
      await pingEndpoint(ep);
    }
    setIsPingingAll(false);
  }

  // Cargar lista de productos desde el backend (ms-inventario)
  async function loadInventory(activeSession: AuthSession | null) {
    setIsLoadingProducts(true);
    try {
      const endpoint = isUserAdmin(activeSession) ? "/api/bff/admin/inventario" : "/api/bff/catalogo";
      let data: any;
      try {
        data = await apiRequest<any>(endpoint);
      } catch {
        data = await apiRequest<any>("/api/bff/inventario");
      }
      const items = Array.isArray(data) ? data : data?.content || data?.contenido || [];
      if (items.length > 0) {
        const mapped: ProductAdmin[] = items.map((p: any) => ({
          id: p.id,
          sku: p.sku || `SKU-${p.id}`,
          nombre: p.nombre || p.name || "Producto sin nombre",
          categoria: p.categoria || p.category || "General",
          descripcion: p.descripcion || p.description || "",
          precioVenta: p.precioVenta ?? p.precio ?? p.price ?? 0,
          stockActual: p.stockActual ?? p.stock ?? 0,
          stockMinimo: p.stockMinimo ?? 5,
          activo: p.activo ?? true,
        }));
        setProducts(mapped);
      }
    } catch (err: unknown) {
      console.warn("Utilizando datos iniciales de inventario debido a:", err);
    } finally {
      setIsLoadingProducts(false);
    }
  }

  // Cargar lista de ventas desde el backend (ms-ventas / db_ventas)
  async function loadSales(authSession?: AuthSession | null) {
    setIsLoadingSales(true);
    try {
      let data: any;
      try {
        data = await apiRequest<any>("/api/bff/admin/ventas");
      } catch {
        data = await apiRequest<any>("/api/bff/ventas");
      }
      const list = Array.isArray(data) ? data : data?.contenido || data?.content || [];
      if (list.length > 0) {
        const mapped: SaleAdmin[] = list.map((s: any) => ({
          id: s.id,
          clienteId: s.clienteId || "Cliente Registrado",
          fechaCreacion: s.fechaCreacion || s.createdAt || new Date().toISOString(),
          estado: (s.estado || "CONFIRMADA").toUpperCase(),
          subtotal: Number(s.subtotal || s.total || 0),
          total: Number(s.total || s.subtotal || 0),
          motivoCancelacion: s.motivoCancelacion,
          items: (s.items || s.detalles || []).map((it: any) => ({
            productoId: it.productoId || it.id || 0,
            nombre: it.nombre || `Insumo #${it.productoId || ""}`,
            cantidad: Number(it.cantidad || 1),
            precioUnitario: Number(it.precioUnitario || it.precio || 0),
            subtotal: Number(it.subtotal || 0),
          })),
        }));
        setSales(mapped);
      }
    } catch (err: unknown) {
      console.warn("Utilizando datos locales de ventas debido a:", err);
    } finally {
      setIsLoadingSales(false);
    }
  }

  // Cargar lista de compras/abastecimiento desde el backend (ms-compras / db_compras)
  async function loadPurchases(authSession?: AuthSession | null) {
    setIsLoadingPurchases(true);
    try {
      let data: any;
      try {
        data = await apiRequest<any>("/api/bff/admin/compras");
      } catch {
        data = await apiRequest<any>("/api/bff/compras");
      }
      const list = Array.isArray(data) ? data : data?.contenido || data?.content || [];
      if (list.length > 0) {
        const mapped: PurchaseAdmin[] = list.map((c: any) => ({
          id: c.id,
          proveedorId: c.proveedorId || 101,
          proveedorNombre: c.proveedorNombre || `Proveedor #${c.proveedorId || 101}`,
          fechaCreacion: c.fechaCreacion || c.createdAt || new Date().toISOString(),
          estado: (c.estado || "COMPLETADA").toUpperCase(),
          total: Number(c.total || 0),
          detalles: (c.detalles || c.items || []).map((it: any) => ({
            id: it.id,
            productoId: it.productoId || 0,
            nombre: it.nombre || `Insumo #${it.productoId || ""}`,
            cantidad: Number(it.cantidad || 0),
            precioUnitario: Number(it.precioUnitario || 0),
            subtotal: Number(it.subtotal || 0),
          })),
        }));
        setPurchases(mapped);
      }
    } catch (err: unknown) {
      console.warn("Utilizando datos locales de compras debido a:", err);
    } finally {
      setIsLoadingPurchases(false);
    }
  }

  // Crear nuevo producto en el catálogo
  async function handleCreateProduct(e: FormEvent) {
    e.preventDefault();
    setIsCreatingProduct(true);
    setProductFeedback(null);

    const payload = {
      sku: newSku.trim().toUpperCase(),
      nombre: newNombre.trim(),
      categoria: newCategoria,
      descripcion: newDescripcion.trim(),
      precioVenta: Number(newPrecio),
      stockMinimo: Number(newStockMinimo),
    };

    try {
      const created = await apiRequest<any>("/api/bff/inventario/productos", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const newProduct: ProductAdmin = {
        id: created?.id || Date.now(),
        sku: created?.sku || payload.sku,
        nombre: created?.nombre || payload.nombre,
        categoria: created?.categoria || payload.categoria,
        descripcion: created?.descripcion || payload.descripcion,
        precioVenta: created?.precioVenta || payload.precioVenta,
        stockActual: Number(newStock),
        stockMinimo: created?.stockMinimo || payload.stockMinimo,
        activo: true,
      };

      setProducts((prev) => [newProduct, ...prev]);
      setShowCreateModal(false);
      setProductFeedback(`Producto ${payload.sku} creado exitosamente en la base de datos.`);
      // Reset form
      setNewSku("");
      setNewNombre("");
      setNewDescripcion("");
      setNewPrecio(10000);
      setNewStock(20);
      setNewStockMinimo(5);
    } catch (err: unknown) {
      // En modo demostrativo / fallback
      const localProduct: ProductAdmin = {
        id: Date.now(),
        sku: payload.sku,
        nombre: payload.nombre,
        categoria: payload.categoria,
        descripcion: payload.descripcion,
        precioVenta: payload.precioVenta,
        stockActual: Number(newStock),
        stockMinimo: payload.stockMinimo,
        activo: true,
      };
      setProducts((prev) => [localProduct, ...prev]);
      setShowCreateModal(false);
      setProductFeedback(`Producto ${payload.sku} registrado localmente (BFF offline: ${err instanceof Error ? err.message : "Error"})`);
    } finally {
      setIsCreatingProduct(false);
    }
  }

  // Guardar edición rápida de precio y stock
  async function handleSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingProduct) return;
    setIsSavingEdit(true);

    const updated = {
      ...editingProduct,
      precioVenta: Number(editPrecio),
      stockActual: Number(editStock),
    };

    try {
      await apiRequest(`/api/bff/inventario/productos/${editingProduct.id}`, {
        method: "PUT",
        body: JSON.stringify({
          sku: editingProduct.sku,
          nombre: editingProduct.nombre,
          categoria: editingProduct.categoria,
          descripcion: editingProduct.descripcion || "",
          precioVenta: Number(editPrecio),
          stockActual: Number(editStock),
          stockMinimo: editingProduct.stockMinimo,
        }),
      });
      setProducts((prev) => prev.map((p) => (p.id === editingProduct.id ? updated : p)));
      setProductFeedback(`Producto ${editingProduct.sku} actualizado correctamente.`);
    } catch {
      // Modo fallback
      setProducts((prev) => prev.map((p) => (p.id === editingProduct.id ? updated : p)));
      setProductFeedback(`Producto ${editingProduct.sku} modificado localmente.`);
    } finally {
      setIsSavingEdit(false);
      setEditingProduct(null);
    }
  }

  // Ejecutar petición en consola rápida
  async function executeConsoleRequest() {
    setIsExecutingConsole(true);
    setConsoleResult(null);
    setConsoleStatus(null);
    setConsoleLatency(null);

    const start = performance.now();
    try {
      const cleanEndpoint = selectedConsoleEndpoint.startsWith("/")
        ? selectedConsoleEndpoint
        : `/${selectedConsoleEndpoint}`;
      const url = `${API_BASE_URL}${cleanEndpoint}`;

      const activeSession = session || readAuthSession();
      const token = activeSession?.accessToken || activeSession?.idToken;
      const headers: Record<string, string> = {
        Accept: "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(url, {
        method: "GET",
        headers,
      });

      const end = performance.now();
      setConsoleLatency(Math.round(end - start));
      setConsoleStatus(response.status);

      const json = await response.json().catch(() => null);
      setConsoleResult(JSON.stringify(json || { status: response.status, statusText: response.statusText }, null, 2));
    } catch (err: unknown) {
      const end = performance.now();
      setConsoleLatency(Math.round(end - start));
      setConsoleStatus(502);
      setConsoleResult(
        JSON.stringify(
          {
            error: "Error de conexión",
            message: err instanceof Error ? err.message : "El servicio no respondió",
            targetUrl: `${API_BASE_URL}${selectedConsoleEndpoint}`,
          },
          null,
          2
        )
      );
    } finally {
      setIsExecutingConsole(false);
    }
  }

  function copyToClipboard(text: string) {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  }

  function formatDate(isoString?: string) {
    if (!isoString) return "-";
    try {
      const d = new Date(isoString);
      return d.toLocaleString("es-CL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  }

  // Filtros dinámicos en tiempo real para las 3 tablas RDS
  const q = searchQuery.trim().toLowerCase();

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      !q ||
      p.sku.toLowerCase().includes(q) ||
      p.nombre.toLowerCase().includes(q) ||
      p.categoria.toLowerCase().includes(q) ||
      p.id.toString().includes(q);

    const matchesStatus =
      statusFilter === "ALL" ||
      (statusFilter === "ACTIVO" && p.activo) ||
      (statusFilter === "INACTIVO" && !p.activo) ||
      (statusFilter === "LOW_STOCK" && p.stockActual <= p.stockMinimo);

    return matchesSearch && matchesStatus;
  });

  const filteredSales = sales.filter((s) => {
    const matchesSearch =
      !q ||
      s.id.toString().includes(q) ||
      s.clienteId.toLowerCase().includes(q) ||
      (s.items && s.items.some((it) => (it.nombre || "").toLowerCase().includes(q) || it.productoId.toString().includes(q)));

    const matchesStatus =
      statusFilter === "ALL" ||
      s.estado.toUpperCase() === statusFilter.toUpperCase();

    return matchesSearch && matchesStatus;
  });

  const filteredPurchases = purchases.filter((pc) => {
    const matchesSearch =
      !q ||
      pc.id.toString().includes(q) ||
      pc.proveedorId.toString().includes(q) ||
      (pc.proveedorNombre || "").toLowerCase().includes(q) ||
      (pc.detalles && pc.detalles.some((it) => (it.nombre || "").toLowerCase().includes(q) || it.productoId.toString().includes(q)));

    const matchesStatus =
      statusFilter === "ALL" ||
      pc.estado.toUpperCase() === statusFilter.toUpperCase();

    return matchesSearch && matchesStatus;
  });

  return (
    <div style={{ minHeight: "100vh", background: "var(--canvas)", color: "var(--ink)", fontFamily: "sans-serif" }}>
      {/* Top Admin Navigation Header */}
      <header
        style={{
          background: "var(--surface)",
          borderBottom: "1px solid var(--line)",
          padding: "16px 24px",
          position: "sticky",
          top: 0,
          zIndex: 30,
        }}
      >
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Link
              href="/"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 14px",
                background: "var(--green-100)",
                color: "var(--green-900)",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                textDecoration: "none",
                transition: "background 0.15s",
              }}
            >
              <ArrowLeft size={16} />
              <span>Volver a la Tienda / Modo Cliente</span>
            </Link>

            <div style={{ height: 24, width: 1, background: "var(--line)" }} />

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  width: 32,
                  height: 32,
                  display: "grid",
                  placeItems: "center",
                  background: "var(--lime)",
                  color: "var(--green-950)",
                  borderRadius: 8,
                }}
              >
                <Leaf size={18} />
              </span>
              <div>
                <strong style={{ fontSize: 16, color: "var(--green-900)", display: "flex", alignItems: "center", gap: 6 }}>
                  AgroCenter Admin
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      background: "var(--green-800)",
                      color: "#fff",
                      padding: "2px 6px",
                      borderRadius: 4,
                      letterSpacing: 0.5,
                      textTransform: "uppercase",
                    }}
                  >
                    Panel RDS & APIs
                  </span>
                </strong>
                <small style={{ color: "var(--muted)", fontSize: 11, display: "block" }}>
                  Operador: {session?.name || "Administrador Demo"} · Rol: {session?.role || "ADMIN"}
                </small>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={() => {
                setActiveTab("inventory");
                setSearchQuery("");
                setStatusFilter("ALL");
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 650,
                border: "none",
                cursor: "pointer",
                background: activeTab === "inventory" ? "var(--green-800)" : "transparent",
                color: activeTab === "inventory" ? "#fff" : "var(--ink-soft)",
                transition: "all 0.15s",
              }}
            >
              <Package size={16} />
              <span>Inventario</span>
            </button>

            <button
              onClick={() => {
                setActiveTab("sales");
                setSearchQuery("");
                setStatusFilter("ALL");
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 650,
                border: "none",
                cursor: "pointer",
                background: activeTab === "sales" ? "var(--green-800)" : "transparent",
                color: activeTab === "sales" ? "#fff" : "var(--ink-soft)",
                transition: "all 0.15s",
              }}
            >
              <ShoppingCart size={16} />
              <span>Ventas</span>
            </button>

            <button
              onClick={() => {
                setActiveTab("purchases");
                setSearchQuery("");
                setStatusFilter("ALL");
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 650,
                border: "none",
                cursor: "pointer",
                background: activeTab === "purchases" ? "var(--green-800)" : "transparent",
                color: activeTab === "purchases" ? "#fff" : "var(--ink-soft)",
                transition: "all 0.15s",
              }}
            >
              <Truck size={16} />
              <span>Compras</span>
            </button>

            <button
              onClick={() => setActiveTab("apis")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 650,
                border: "none",
                cursor: "pointer",
                background: activeTab === "apis" ? "var(--green-800)" : "transparent",
                color: activeTab === "apis" ? "#fff" : "var(--ink-soft)",
                transition: "all 0.15s",
              }}
            >
              <Activity size={16} />
              <span>Monitor APIs</span>
            </button>

            <button
              onClick={() => setActiveTab("console")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 650,
                border: "none",
                cursor: "pointer",
                background: activeTab === "console" ? "var(--green-800)" : "transparent",
                color: activeTab === "console" ? "#fff" : "var(--ink-soft)",
                transition: "all 0.15s",
              }}
            >
              <Terminal size={16} />
              <span>Consola</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Body */}
      <main style={{ maxWidth: 1200, margin: "24px auto", padding: "0 20px" }}>
        {/* Feedback Alert */}
        {productFeedback && (
          <div
            style={{
              padding: "12px 18px",
              background: "var(--green-100)",
              border: "1px solid #c4dec9",
              borderRadius: 8,
              color: "var(--green-950)",
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <CheckCircle2 size={18} color="var(--green-700)" />
              <span>{productFeedback}</span>
            </div>
            <button
              onClick={() => setProductFeedback(null)}
              style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--muted)" }}
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* TAB 1: MONITOR DE APIS */}
        {activeTab === "apis" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--green-950)", margin: 0 }}>
                  Monitor de Conectividad y Microservicios
                </h2>
                <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
                  Prueba de conectividad HTTP en tiempo real hacia el router ALB y microservicios internos en AWS ECS Fargate.
                </p>
              </div>
              <button
                onClick={pingAllEndpoints}
                disabled={isPingingAll}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 18px",
                  background: isPingingAll ? "var(--muted)" : "var(--green-700)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: isPingingAll ? "not-allowed" : "pointer",
                }}
              >
                <RefreshCw size={16} className={isPingingAll ? "animate-spin" : ""} />
                <span>{isPingingAll ? "Probando Servicios..." : "Probar Todas las Conexiones"}</span>
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 16 }}>
              {monitoredEndpoints.map((ep) => {
                const res = pingResults[ep.id] || { status: "idle" };
                const isOnline = res.status === "online";
                const isError = res.status === "error" || res.status === "offline";
                const isLoading = res.status === "loading";

                return (
                  <div
                    key={ep.id}
                    style={{
                      background: "var(--surface)",
                      border: "1px solid var(--line)",
                      borderRadius: 12,
                      padding: 18,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      boxShadow: "var(--shadow-sm)",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                        <div>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 800,
                              color: "var(--green-800)",
                              background: "var(--green-100)",
                              padding: "2px 6px",
                              borderRadius: 4,
                              letterSpacing: 0.5,
                              textTransform: "uppercase",
                            }}
                          >
                            {ep.service}
                          </span>
                          <h3 style={{ fontSize: 16, fontWeight: 700, margin: "6px 0 2px 0", color: "var(--ink)" }}>
                            {ep.name}
                          </h3>
                        </div>

                        {/* Status Badge */}
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            padding: "4px 8px",
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 700,
                            background: isOnline ? "#eaf6ed" : isError ? "#fbeeed" : "#f1f3f1",
                            color: isOnline ? "#1a7536" : isError ? "#a84732" : "#6c7974",
                          }}
                        >
                          {isOnline && <CheckCircle2 size={14} />}
                          {isError && <XCircle size={14} />}
                          {isLoading && <RefreshCw size={14} className="animate-spin" />}
                          <span>
                            {isLoading ? "Ping..." : isOnline ? "Online (200)" : isError ? `Error ${res.statusCode || 502}` : "Sin probar"}
                          </span>
                        </span>
                      </div>

                      <code
                        style={{
                          display: "block",
                          marginTop: 8,
                          fontSize: 12,
                          color: "var(--green-900)",
                          background: "#f4f7f4",
                          padding: "4px 8px",
                          borderRadius: 6,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {ep.method} {ep.endpoint}
                      </code>

                      <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
                        {ep.description}
                      </p>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        borderTop: "1px solid var(--line-soft)",
                        paddingTop: 12,
                        marginTop: 14,
                      }}
                    >
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>
                        {res.latencyMs !== undefined && (
                          <span>
                            Latencia: <strong>{res.latencyMs} ms</strong>
                            {res.lastChecked && ` · ${res.lastChecked}`}
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => pingEndpoint(ep)}
                        disabled={isLoading}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          padding: "6px 12px",
                          background: "var(--surface)",
                          border: "1px solid var(--line)",
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 650,
                          color: "var(--green-800)",
                          cursor: isLoading ? "not-allowed" : "pointer",
                        }}
                      >
                        <Send size={13} />
                        <span>Ping</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB: VISOR MULTI-SERVICIO Y AUDITORÍA RDS (INVENTARIO / VENTAS / COMPRAS) */}
        {(activeTab === "inventory" || activeTab === "sales" || activeTab === "purchases") && (
          <div>
            {/* Service & Database Header */}
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 20 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "2px 8px",
                      background: "var(--green-100)",
                      color: "var(--green-900)",
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      fontFamily: "monospace",
                    }}
                  >
                    <Database size={12} />
                    {activeTab === "inventory" && "db_inventario.productos"}
                    {activeTab === "sales" && "db_ventas.ventas"}
                    {activeTab === "purchases" && "db_compras.compras"}
                  </span>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "2px 8px",
                      background: "#eef2f6",
                      color: "#334155",
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    <Server size={12} />
                    {activeTab === "inventory" && "ms-inventario (ECS)"}
                    {activeTab === "sales" && "ms-ventas (ECS)"}
                    {activeTab === "purchases" && "ms-compras (ECS)"}
                  </span>
                </div>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--green-950)", margin: 0 }}>
                  {activeTab === "inventory" && "Auditoría de Insumos y Existencias"}
                  {activeTab === "sales" && "Auditoría de Órdenes y Ventas Realizadas"}
                  {activeTab === "purchases" && "Auditoría de Órdenes de Abastecimiento"}
                </h2>
                <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 4, marginBottom: 0 }}>
                  {activeTab === "inventory" && "Control directo sobre el catálogo y stock persistido en Amazon RDS PostgreSQL."}
                  {activeTab === "sales" && "Historial de transacciones de compra registradas por clientes autenticados."}
                  {activeTab === "purchases" && "Registro de compras a proveedores e insumos incorporados al centro logístico."}
                </p>
              </div>

              {/* Service Sub-tabs / Quick Switcher */}
              <div
                style={{
                  display: "inline-flex",
                  background: "#edf3ee",
                  padding: 4,
                  borderRadius: 10,
                  gap: 4,
                  border: "1px solid var(--line-soft)",
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("inventory");
                    setSearchQuery("");
                    setStatusFilter("ALL");
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "7px 12px",
                    borderRadius: 7,
                    fontSize: 12,
                    fontWeight: 700,
                    border: "none",
                    cursor: "pointer",
                    background: activeTab === "inventory" ? "var(--surface)" : "transparent",
                    color: activeTab === "inventory" ? "var(--green-950)" : "var(--muted)",
                    boxShadow: activeTab === "inventory" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                    transition: "all 0.15s",
                  }}
                >
                  <Package size={14} />
                  <span>Inventario</span>
                  <span
                    style={{
                      padding: "1px 6px",
                      borderRadius: 10,
                      background: activeTab === "inventory" ? "var(--green-100)" : "rgba(0,0,0,0.06)",
                      color: activeTab === "inventory" ? "var(--green-900)" : "var(--muted)",
                      fontSize: 10,
                      fontWeight: 800,
                    }}
                  >
                    {products.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("sales");
                    setSearchQuery("");
                    setStatusFilter("ALL");
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "7px 12px",
                    borderRadius: 7,
                    fontSize: 12,
                    fontWeight: 700,
                    border: "none",
                    cursor: "pointer",
                    background: activeTab === "sales" ? "var(--surface)" : "transparent",
                    color: activeTab === "sales" ? "var(--green-950)" : "var(--muted)",
                    boxShadow: activeTab === "sales" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                    transition: "all 0.15s",
                  }}
                >
                  <ShoppingCart size={14} />
                  <span>Ventas</span>
                  <span
                    style={{
                      padding: "1px 6px",
                      borderRadius: 10,
                      background: activeTab === "sales" ? "var(--green-100)" : "rgba(0,0,0,0.06)",
                      color: activeTab === "sales" ? "var(--green-900)" : "var(--muted)",
                      fontSize: 10,
                      fontWeight: 800,
                    }}
                  >
                    {sales.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("purchases");
                    setSearchQuery("");
                    setStatusFilter("ALL");
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "7px 12px",
                    borderRadius: 7,
                    fontSize: 12,
                    fontWeight: 700,
                    border: "none",
                    cursor: "pointer",
                    background: activeTab === "purchases" ? "var(--surface)" : "transparent",
                    color: activeTab === "purchases" ? "var(--green-950)" : "var(--muted)",
                    boxShadow: activeTab === "purchases" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                    transition: "all 0.15s",
                  }}
                >
                  <Truck size={14} />
                  <span>Compras</span>
                  <span
                    style={{
                      padding: "1px 6px",
                      borderRadius: 10,
                      background: activeTab === "purchases" ? "var(--green-100)" : "rgba(0,0,0,0.06)",
                      color: activeTab === "purchases" ? "var(--green-900)" : "var(--muted)",
                      fontSize: 10,
                      fontWeight: 800,
                    }}
                  >
                    {purchases.length}
                  </span>
                </button>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: 12,
                padding: "14px 18px",
                marginBottom: 16,
                boxShadow: "var(--shadow-sm)",
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", flex: 1, minWidth: 260, alignItems: "center", gap: 10, position: "relative" }}>
                <Search size={16} style={{ position: "absolute", left: 12, color: "var(--muted)" }} />
                <input
                  type="text"
                  placeholder={
                    activeTab === "inventory"
                      ? "Buscar por SKU, nombre, categoría o ID..."
                      : activeTab === "sales"
                      ? "Buscar por ID orden, cliente o insumo..."
                      : "Buscar por ID compra, proveedor o insumo..."
                  }
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px 9px 36px",
                    borderRadius: 8,
                    border: "1px solid var(--line)",
                    fontSize: 13,
                    background: "#fafbfa",
                    color: "var(--ink)",
                    outline: "none",
                  }}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    style={{
                      position: "absolute",
                      right: 10,
                      background: "transparent",
                      border: "none",
                      color: "var(--muted)",
                      cursor: "pointer",
                      padding: 2,
                    }}
                    title="Limpiar búsqueda"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Filter size={14} style={{ color: "var(--muted)" }} />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid var(--line)",
                      fontSize: 12,
                      fontWeight: 650,
                      background: "#fafbfa",
                      color: "var(--ink)",
                      cursor: "pointer",
                    }}
                  >
                    <option value="ALL">Todos los estados</option>
                    {activeTab === "inventory" && (
                      <>
                        <option value="ACTIVO">Solo Activos</option>
                        <option value="INACTIVO">Solo Inactivos</option>
                        <option value="LOW_STOCK">⚠️ Stock Bajo / Crítico</option>
                      </>
                    )}
                    {activeTab === "sales" && (
                      <>
                        <option value="CONFIRMADA">Confirmadas (Éxito)</option>
                        <option value="PENDIENTE">Pendientes</option>
                        <option value="CANCELADA">Canceladas</option>
                      </>
                    )}
                    {activeTab === "purchases" && (
                      <>
                        <option value="COMPLETADA">Completadas / Recibidas</option>
                        <option value="EN_TRANSITO">En Tránsito</option>
                        <option value="CANCELADA">Canceladas</option>
                      </>
                    )}
                  </select>
                </div>

                {/* Individual Refresh Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (activeTab === "inventory") loadInventory(session);
                    else if (activeTab === "sales") loadSales(session);
                    else if (activeTab === "purchases") loadPurchases(session);
                  }}
                  disabled={
                    activeTab === "inventory"
                      ? isLoadingProducts
                      : activeTab === "sales"
                      ? isLoadingSales
                      : isLoadingPurchases
                  }
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 14px",
                    background: "var(--surface)",
                    color: "var(--ink)",
                    border: "1px solid var(--line)",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 650,
                    cursor: "pointer",
                  }}
                  title="Refrescar datos del microservicio"
                >
                  <RefreshCw
                    size={14}
                    className={
                      (activeTab === "inventory" && isLoadingProducts) ||
                      (activeTab === "sales" && isLoadingSales) ||
                      (activeTab === "purchases" && isLoadingPurchases)
                        ? "animate-spin"
                        : ""
                    }
                  />
                  <span>Refrescar</span>
                </button>

                {activeTab === "inventory" && (
                  <button
                    onClick={() => setShowCreateModal(true)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "8px 14px",
                      background: "var(--green-700)",
                      color: "#fff",
                      border: "none",
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <Plus size={15} />
                    <span>Nuevo Insumo</span>
                  </button>
                )}
              </div>
            </div>

            {/* Live Filter Indicator Bar */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "6px 4px",
                marginBottom: 10,
                fontSize: 12,
                color: "var(--muted)",
              }}
            >
              <div>
                Mostrando{" "}
                <strong style={{ color: "var(--ink)" }}>
                  {activeTab === "inventory"
                    ? filteredProducts.length
                    : activeTab === "sales"
                    ? filteredSales.length
                    : filteredPurchases.length}
                </strong>{" "}
                de{" "}
                <strong>
                  {activeTab === "inventory"
                    ? products.length
                    : activeTab === "sales"
                    ? sales.length
                    : purchases.length}
                </strong>{" "}
                registros en tiempo real desde RDS
              </div>

              {(searchQuery || statusFilter !== "ALL") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter("ALL");
                  }}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--green-800)",
                    fontSize: 12,
                    fontWeight: 650,
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  Limpiar filtros activos
                </button>
              )}
            </div>

            {/* 1. TABLA INVENTARIO */}
            {activeTab === "inventory" && (
              <div
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--line)",
                  borderRadius: 12,
                  overflow: "hidden",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#f5f8f5", borderBottom: "1px solid var(--line)", color: "var(--ink-soft)" }}>
                      <th style={{ padding: "12px 16px", fontWeight: 700 }}>SKU</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700 }}>Nombre del Insumo</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700 }}>Categoría</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700 }}>Precio (CLP)</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700 }}>Stock Actual</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700 }}>Mínimo</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700 }}>Estado</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700, textAlign: "right" }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ padding: "36px 16px", textAlign: "center", color: "var(--muted)" }}>
                          No se encontraron insumos que coincidan con la búsqueda o filtro aplicado.
                        </td>
                      </tr>
                    ) : (
                      filteredProducts.map((p) => {
                        const isLowStock = p.stockActual <= p.stockMinimo;
                        return (
                          <tr key={p.id} style={{ borderBottom: "1px solid var(--line-soft)" }}>
                            <td style={{ padding: "14px 16px", fontFamily: "monospace", fontWeight: 700, color: "var(--green-900)" }}>
                              {p.sku}
                            </td>
                            <td style={{ padding: "14px 16px" }}>
                              <strong>{p.nombre}</strong>
                              {p.descripcion && (
                                <small style={{ display: "block", color: "var(--muted)", fontSize: 11, marginTop: 2 }}>
                                  {p.descripcion}
                                </small>
                              )}
                            </td>
                            <td style={{ padding: "14px 16px" }}>
                              <span style={{ padding: "3px 8px", background: "#f0f4f1", borderRadius: 4, fontSize: 12 }}>
                                {p.categoria}
                              </span>
                            </td>
                            <td style={{ padding: "14px 16px", fontWeight: 650 }}>
                              ${p.precioVenta.toLocaleString("es-CL")}
                            </td>
                            <td style={{ padding: "14px 16px" }}>
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  fontWeight: 700,
                                  color: isLowStock ? "var(--danger)" : "var(--green-800)",
                                }}
                              >
                                {isLowStock && <AlertTriangle size={14} />}
                                {p.stockActual} un.
                              </span>
                            </td>
                            <td style={{ padding: "14px 16px", color: "var(--muted)" }}>
                              {p.stockMinimo} un.
                            </td>
                            <td style={{ padding: "14px 16px" }}>
                              <span
                                style={{
                                  display: "inline-block",
                                  width: 8,
                                  height: 8,
                                  borderRadius: "50%",
                                  background: p.activo ? "#2e8a62" : "#a84732",
                                  marginRight: 6,
                                }}
                              />
                              <span style={{ fontSize: 12 }}>{p.activo ? "Activo" : "Inactivo"}</span>
                            </td>
                            <td style={{ padding: "14px 16px", textAlign: "right" }}>
                              <button
                                onClick={() => {
                                  setEditingProduct(p);
                                  setEditPrecio(p.precioVenta);
                                  setEditStock(p.stockActual);
                                }}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 5,
                                  padding: "5px 10px",
                                  background: "var(--green-100)",
                                  color: "var(--green-900)",
                                  border: "none",
                                  borderRadius: 6,
                                  fontSize: 12,
                                  fontWeight: 650,
                                  cursor: "pointer",
                                }}
                              >
                                <Edit3 size={13} />
                                <span>Editar</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* 2. TABLA VENTAS */}
            {activeTab === "sales" && (
              <div
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--line)",
                  borderRadius: 12,
                  overflow: "hidden",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#f5f8f5", borderBottom: "1px solid var(--line)", color: "var(--ink-soft)" }}>
                      <th style={{ padding: "12px 16px", fontWeight: 700 }}># Orden / ID</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700 }}>Cliente (UUID Cognito)</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700 }}>Fecha y Hora</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700 }}>Insumos Comprados</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700 }}>Subtotal</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700 }}>Total (CLP)</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700, textAlign: "center" }}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSales.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ padding: "36px 16px", textAlign: "center", color: "var(--muted)" }}>
                          No se encontraron órdenes de venta que coincidan con la búsqueda o filtro aplicado.
                        </td>
                      </tr>
                    ) : (
                      filteredSales.map((s) => {
                        const isConfirmed = s.estado.toUpperCase() === "CONFIRMADA";
                        const isPending = s.estado.toUpperCase() === "PENDIENTE";
                        return (
                          <tr key={s.id} style={{ borderBottom: "1px solid var(--line-soft)" }}>
                            <td style={{ padding: "14px 16px", fontFamily: "monospace", fontWeight: 700, color: "var(--green-900)" }}>
                              #ORD-{s.id}
                            </td>
                            <td style={{ padding: "14px 16px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <User size={13} style={{ color: "var(--muted)" }} />
                                <span
                                  style={{
                                    fontFamily: "monospace",
                                    fontSize: 12,
                                    background: "#f3f4f6",
                                    padding: "2px 6px",
                                    borderRadius: 4,
                                    maxWidth: 200,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                  title={s.clienteId}
                                >
                                  {s.clienteId}
                                </span>
                              </div>
                            </td>
                            <td style={{ padding: "14px 16px", fontSize: 12, color: "var(--ink-soft)" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <Clock size={12} style={{ color: "var(--muted)" }} />
                                {formatDate(s.fechaCreacion)}
                              </div>
                            </td>
                            <td style={{ padding: "14px 16px" }}>
                              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                {s.items && s.items.length > 0 ? (
                                  s.items.map((it, idx) => (
                                    <span
                                      key={idx}
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 4,
                                        fontSize: 11,
                                        background: "#f0f4f1",
                                        padding: "2px 6px",
                                        borderRadius: 4,
                                        color: "var(--green-950)",
                                      }}
                                    >
                                      <strong>{it.cantidad}x</strong> {it.nombre || `Producto #${it.productoId}`} (
                                      ${it.precioUnitario?.toLocaleString("es-CL")})
                                    </span>
                                  ))
                                ) : (
                                  <span style={{ fontSize: 11, color: "var(--muted)" }}>Sin ítems especificados</span>
                                )}
                              </div>
                            </td>
                            <td style={{ padding: "14px 16px", color: "var(--muted)", fontSize: 12 }}>
                              ${(s.subtotal || s.total).toLocaleString("es-CL")}
                            </td>
                            <td style={{ padding: "14px 16px", fontWeight: 700, color: "var(--green-950)" }}>
                              ${s.total.toLocaleString("es-CL")}
                            </td>
                            <td style={{ padding: "14px 16px", textAlign: "center" }}>
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  padding: "3px 10px",
                                  borderRadius: 12,
                                  fontSize: 11,
                                  fontWeight: 750,
                                  background: isConfirmed
                                    ? "#dcfce7"
                                    : isPending
                                    ? "#fef3c7"
                                    : "#fee2e2",
                                  color: isConfirmed
                                    ? "#166534"
                                    : isPending
                                    ? "#92400e"
                                    : "#991b1b",
                                }}
                              >
                                {isConfirmed ? (
                                  <CheckCircle2 size={12} />
                                ) : isPending ? (
                                  <Clock size={12} />
                                ) : (
                                  <XCircle size={12} />
                                )}
                                {s.estado}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* 3. TABLA COMPRAS */}
            {activeTab === "purchases" && (
              <div
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--line)",
                  borderRadius: 12,
                  overflow: "hidden",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#f5f8f5", borderBottom: "1px solid var(--line)", color: "var(--ink-soft)" }}>
                      <th style={{ padding: "12px 16px", fontWeight: 700 }}># Orden Compra</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700 }}>Proveedor</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700 }}>Fecha Abastecimiento</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700 }}>Insumos Adquiridos</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700 }}>Monto Total (CLP)</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700, textAlign: "center" }}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPurchases.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ padding: "36px 16px", textAlign: "center", color: "var(--muted)" }}>
                          No se encontraron órdenes de compra a proveedores que coincidan con la búsqueda.
                        </td>
                      </tr>
                    ) : (
                      filteredPurchases.map((pc) => {
                        const isDone = pc.estado.toUpperCase() === "COMPLETADA" || pc.estado.toUpperCase() === "RECIBIDA";
                        const isTransit = pc.estado.toUpperCase() === "EN_TRANSITO";
                        return (
                          <tr key={pc.id} style={{ borderBottom: "1px solid var(--line-soft)" }}>
                            <td style={{ padding: "14px 16px", fontFamily: "monospace", fontWeight: 700, color: "var(--green-900)" }}>
                              #CMP-{pc.id}
                            </td>
                            <td style={{ padding: "14px 16px" }}>
                              <strong>{pc.proveedorNombre || `Proveedor #${pc.proveedorId}`}</strong>
                              <small style={{ display: "block", color: "var(--muted)", fontSize: 11 }}>
                                ID Proveedor: {pc.proveedorId}
                              </small>
                            </td>
                            <td style={{ padding: "14px 16px", fontSize: 12, color: "var(--ink-soft)" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <Calendar size={12} style={{ color: "var(--muted)" }} />
                                {formatDate(pc.fechaCreacion)}
                              </div>
                            </td>
                            <td style={{ padding: "14px 16px" }}>
                              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                {pc.detalles && pc.detalles.length > 0 ? (
                                  pc.detalles.map((it, idx) => (
                                    <span
                                      key={idx}
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 4,
                                        fontSize: 11,
                                        background: "#f0f4f1",
                                        padding: "2px 6px",
                                        borderRadius: 4,
                                        color: "var(--green-950)",
                                      }}
                                    >
                                      <strong>{it.cantidad} un.</strong> {it.nombre || `Insumo #${it.productoId}`} (
                                      ${it.precioUnitario?.toLocaleString("es-CL")})
                                    </span>
                                  ))
                                ) : (
                                  <span style={{ fontSize: 11, color: "var(--muted)" }}>Sin ítems detallados</span>
                                )}
                              </div>
                            </td>
                            <td style={{ padding: "14px 16px", fontWeight: 700, color: "var(--green-950)" }}>
                              ${pc.total.toLocaleString("es-CL")}
                            </td>
                            <td style={{ padding: "14px 16px", textAlign: "center" }}>
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  padding: "3px 10px",
                                  borderRadius: 12,
                                  fontSize: 11,
                                  fontWeight: 750,
                                  background: isDone
                                    ? "#dcfce7"
                                    : isTransit
                                    ? "#e0e7ff"
                                    : "#fee2e2",
                                  color: isDone
                                    ? "#166534"
                                    : isTransit
                                    ? "#3730a3"
                                    : "#991b1b",
                                }}
                              >
                                {isDone ? (
                                  <CheckCircle2 size={12} />
                                ) : isTransit ? (
                                  <Truck size={12} />
                                ) : (
                                  <XCircle size={12} />
                                )}
                                {pc.estado}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: CONSOLA DE PETICIONES RÁPIDAS */}
        {activeTab === "console" && (
          <div>
            <div style={{ marginBottom: 18 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--green-950)", margin: 0 }}>
                Consola de Peticiones Rápidas (API Playground)
              </h2>
              <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
                Inspecciona las respuestas JSON en vivo devueltas por el BFF, inyectando automáticamente tu Bearer JWT de Cognito.
              </p>
            </div>

            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: 12,
                padding: 20,
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <select
                  value={selectedConsoleEndpoint}
                  onChange={(e) => setSelectedConsoleEndpoint(e.target.value)}
                  style={{
                    flex: 1,
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "1px solid var(--line)",
                    fontSize: 13,
                    fontWeight: 600,
                    background: "#fafbfa",
                    color: "var(--ink)",
                  }}
                >
                  {quickRequestEndpoints.map((item) => (
                    <option key={item.endpoint} value={item.endpoint}>
                      {item.label}
                    </option>
                  ))}
                </select>

                <button
                  onClick={executeConsoleRequest}
                  disabled={isExecutingConsole}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 20px",
                    background: "var(--green-700)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: isExecutingConsole ? "not-allowed" : "pointer",
                  }}
                >
                  <Send size={15} />
                  <span>{isExecutingConsole ? "Consultando..." : "Ejecutar Petición"}</span>
                </button>
              </div>

              {/* Status Header */}
              {consoleStatus !== null && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    background: consoleStatus >= 200 && consoleStatus < 300 ? "#eaf6ed" : "#fbeeed",
                    borderRadius: 6,
                    marginBottom: 12,
                    fontSize: 12,
                    fontWeight: 650,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: consoleStatus >= 200 && consoleStatus < 300 ? "#1a7536" : "#a84732" }}>
                      HTTP Status: <strong>{consoleStatus}</strong>
                    </span>
                    {consoleLatency !== null && <span>· Latencia: <strong>{consoleLatency} ms</strong></span>}
                  </div>

                  {consoleResult && (
                    <button
                      onClick={() => copyToClipboard(consoleResult)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        background: "transparent",
                        border: "none",
                        fontSize: 11,
                        cursor: "pointer",
                        color: "var(--ink-soft)",
                      }}
                    >
                      <Copy size={13} />
                      <span>{copySuccess ? "Copiado!" : "Copiar JSON"}</span>
                    </button>
                  )}
                </div>
              )}

              {/* JSON Output Viewer */}
              <pre
                style={{
                  background: "#12201b",
                  color: "#d4ecd7",
                  padding: 16,
                  borderRadius: 8,
                  fontSize: 12,
                  fontFamily: "monospace",
                  overflowX: "auto",
                  maxHeight: 450,
                  margin: 0,
                  lineHeight: 1.5,
                }}
              >
                {consoleResult || "// Selecciona un endpoint y presiona 'Ejecutar Petición' para ver la respuesta..."}
              </pre>
            </div>
          </div>
        )}
      </main>

      {/* MODAL: REGISTRAR NUEVO PRODUCTO */}
      {showCreateModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(10, 35, 25, 0.6)",
            display: "grid",
            placeItems: "center",
            zIndex: 50,
            padding: 16,
          }}
        >
          <div
            style={{
              background: "var(--surface)",
              borderRadius: 14,
              padding: 24,
              width: "min(520px, 100%)",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--green-950)" }}>
                Registrar Nuevo Insumo Agrícola
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--muted)" }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateProduct} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>SKU del Producto</label>
                <input
                  required
                  value={newSku}
                  onChange={(e) => setNewSku(e.target.value)}
                  placeholder="ej. FERT-SULF-003"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--line)", fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Nombre Comercial</label>
                <input
                  required
                  value={newNombre}
                  onChange={(e) => setNewNombre(e.target.value)}
                  placeholder="ej. Sulfato de Potasio Granulado 25 kg"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--line)", fontSize: 13 }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Categoría</label>
                  <select
                    value={newCategoria}
                    onChange={(e) => setNewCategoria(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--line)", fontSize: 13 }}
                  >
                    <option value="Semillas">Semillas</option>
                    <option value="Fertilizantes">Fertilizantes</option>
                    <option value="Protección de cultivos">Protección de cultivos</option>
                    <option value="Riego">Riego</option>
                    <option value="Herramientas">Herramientas</option>
                    <option value="Maquinaria">Maquinaria</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Precio Venta (CLP)</label>
                  <input
                    type="number"
                    required
                    min={100}
                    value={newPrecio}
                    onChange={(e) => setNewPrecio(Number(e.target.value))}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--line)", fontSize: 13 }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Descripción</label>
                <textarea
                  value={newDescripcion}
                  onChange={(e) => setNewDescripcion(e.target.value)}
                  placeholder="Descripción técnica del insumo..."
                  rows={2}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--line)", fontSize: 13 }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Stock Inicial</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={newStock}
                    onChange={(e) => setNewStock(Number(e.target.value))}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--line)", fontSize: 13 }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Stock Mínimo</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={newStockMinimo}
                    onChange={(e) => setNewStockMinimo(Number(e.target.value))}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--line)", fontSize: 13 }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid var(--line)", background: "transparent", cursor: "pointer", fontSize: 13 }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isCreatingProduct}
                  style={{
                    padding: "8px 18px",
                    borderRadius: 6,
                    border: "none",
                    background: "var(--green-700)",
                    color: "#fff",
                    fontWeight: 700,
                    cursor: isCreatingProduct ? "not-allowed" : "pointer",
                    fontSize: 13,
                  }}
                >
                  {isCreatingProduct ? "Guardando..." : "Crear en RDS"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDICIÓN RÁPIDA DE PRECIO Y STOCK */}
      {editingProduct && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(10, 35, 25, 0.6)",
            display: "grid",
            placeItems: "center",
            zIndex: 50,
            padding: 16,
          }}
        >
          <div
            style={{
              background: "var(--surface)",
              borderRadius: 14,
              padding: 24,
              width: "min(420px, 100%)",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: "var(--green-950)" }}>
                Modificar Insumo: {editingProduct.sku}
              </h3>
              <button
                onClick={() => setEditingProduct(null)}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--muted)" }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 14px 0" }}>
              {editingProduct.nombre} ({editingProduct.categoria})
            </p>

            <form onSubmit={handleSaveEdit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Precio Venta (CLP)</label>
                <input
                  type="number"
                  required
                  min={100}
                  value={editPrecio}
                  onChange={(e) => setEditPrecio(Number(e.target.value))}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--line)", fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Stock Actual (Unidades)</label>
                <input
                  type="number"
                  required
                  min={0}
                  value={editStock}
                  onChange={(e) => setEditStock(Number(e.target.value))}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--line)", fontSize: 13 }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  style={{ padding: "8px 14px", borderRadius: 6, border: "1px solid var(--line)", background: "transparent", cursor: "pointer", fontSize: 13 }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  style={{
                    padding: "8px 18px",
                    borderRadius: 6,
                    border: "none",
                    background: "var(--green-700)",
                    color: "#fff",
                    fontWeight: 700,
                    cursor: isSavingEdit ? "not-allowed" : "pointer",
                    fontSize: 13,
                  }}
                >
                  {isSavingEdit ? "Guardando..." : "Actualizar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
