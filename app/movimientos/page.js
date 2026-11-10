
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function MovimientosPage() {
  const router = useRouter();

  const [productos, setProductos] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const [form, setForm] = useState({
    producto_id: "",
    tipo: "ENTRADA",
    cantidad: "",
    motivo: "",
  });

  const cargarDatos = useCallback(async () => {
    const [respuestaProductos, respuestaMovimientos] =
      await Promise.all([
        supabase
          .from("productos")
          .select("id, codigo, nombre, stock_actual")
          .order("nombre"),

        supabase
          .from("movimientos_inventario")
          .select(`
            id,
            producto_id,
            tipo,
            cantidad,
            stock_anterior,
            stock_nuevo,
            motivo,
            fecha
          `)
          .order("fecha", { ascending: false })
          .limit(100),
      ]);

    if (respuestaProductos.error) {
      throw respuestaProductos.error;
    }

    if (respuestaMovimientos.error) {
      throw respuestaMovimientos.error;
    }

    setProductos(respuestaProductos.data ?? []);
    setMovimientos(respuestaMovimientos.data ?? []);
  }, []);

  useEffect(() => {
    let activo = true;

    async function iniciar() {
      try {
        const { data, error } = await supabase.auth.getUser();

        if (error || !data.user) {
          router.replace("/login");
          return;
        }

        if (!activo) return;

        setUsuario(data.user);
        await cargarDatos();
      } catch (err) {
        if (activo) setError(err.message);
      } finally {
        if (activo) setCargando(false);
      }
    }

    iniciar();

    return () => {
      activo = false;
    };
  }, [router, cargarDatos]);

  async function registrarMovimiento(e) {
    e.preventDefault();

    if (guardando || !usuario) return;

    setError("");
    setMensaje("");

    const cantidad = Number(form.cantidad);

    if (!form.producto_id) {
      setError("Selecciona un producto");
      return;
    }

    if (!Number.isSafeInteger(cantidad) || cantidad <= 0) {
      setError("Ingresa una cantidad entera mayor a cero");
      return;
    }

    if (!form.motivo.trim()) {
      setError("Debes ingresar un motivo");
      return;
    }

    setGuardando(true);

    try {
      const { error } = await supabase.rpc(
        "registrar_movimiento",
        {
          p_producto_id: form.producto_id,
          p_tipo: form.tipo,
          p_cantidad: cantidad,
          p_motivo: form.motivo.trim(),
        }
      );

      if (error) throw error;

      await cargarDatos();

      setForm({
        producto_id: "",
        tipo: "ENTRADA",
        cantidad: "",
        motivo: "",
      });

      setMensaje("Movimiento registrado correctamente");
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  const nombresProductos = Object.fromEntries(
    productos.map((p) => [p.id, p.nombre])
  );

  if (cargando) {
    return <main className="p-8">Cargando inventario...</main>;
  }

  if (!usuario) {
    return <main className="p-8">Verificando acceso...</main>;
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6 text-slate-900">
      <div className="max-w-6xl mx-auto">
        <header className="mb-6">
          <button
            onClick={() => router.push("/")}
            className="text-blue-600 mb-3"
          >
            ← Volver al dashboard
          </button>

          <h1 className="text-3xl font-bold">
            Movimientos de inventario
          </h1>

          <p className="text-slate-500 mt-2">
            Registra entradas y salidas de productos
          </p>
        </header>

        {error && (
          <p role="alert" className="bg-red-100 text-red-700 p-4 rounded-lg mb-4">
            {error}
          </p>
        )}

        {mensaje && (
          <p role="status" className="bg-green-100 text-green-700 p-4 rounded-lg mb-4">
            {mensaje}
          </p>
        )}

        <form
          onSubmit={registrarMovimiento}
          className="bg-white rounded-xl p-6 shadow-sm mb-8"
        >
          <h2 className="text-xl font-bold mb-5">
            Nuevo movimiento
          </h2>

          <div className="grid md:grid-cols-2 gap-4">
            <label className="block">
              Producto
              <select
                required
                value={form.producto_id}
                onChange={(e) =>
                  setForm({
                    ...form,
                    producto_id: e.target.value,
                  })
                }
                className="w-full border p-3 rounded-lg mt-1"
              >
                <option value="">Seleccionar producto</option>
                {productos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} — Stock: {p.stock_actual}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              Tipo de movimiento
              <select
                value={form.tipo}
                onChange={(e) =>
                  setForm({ ...form, tipo: e.target.value })
                }
                className="w-full border p-3 rounded-lg mt-1"
              >
                <option value="ENTRADA">Entrada</option>
                <option value="SALIDA">Salida</option>
              </select>
            </label>

            <label className="block">
              Cantidad
              <input
                required
                type="number"
                min="1"
                step="1"
                value={form.cantidad}
                onChange={(e) =>
                  setForm({
                    ...form,
                    cantidad: e.target.value,
                  })
                }
                className="w-full border p-3 rounded-lg mt-1"
              />
            </label>

            <label className="block">
              Motivo
              <input
                required
                maxLength={300}
                placeholder="Compra, venta, devolución..."
                value={form.motivo}
                onChange={(e) =>
                  setForm({
                    ...form,
                    motivo: e.target.value,
                  })
                }
                className="w-full border p-3 rounded-lg mt-1"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={guardando || productos.length === 0}
            className="mt-6 bg-blue-600 text-white px-6 py-3 rounded-lg disabled:opacity-50"
          >
            {guardando
              ? "Registrando..."
              : "Guardar movimiento"}
          </button>
        </form>

        <section className="bg-white rounded-xl shadow-sm overflow-hidden">
          <h2 className="text-xl font-bold p-6">
            Historial de movimientos
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-100">
                <tr>
                  {[
                    "Fecha",
                    "Producto",
                    "Tipo",
                    "Cantidad",
                    "Stock anterior",
                    "Stock nuevo",
                    "Motivo",
                  ].map((titulo) => (
                    <th key={titulo} className="p-4">
                      {titulo}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {movimientos.map((m) => (
                  <tr key={m.id} className="border-t">
                    <td className="p-4 whitespace-nowrap">
                      {new Date(m.fecha).toLocaleString("es-PE")}
                    </td>
                    <td className="p-4">
                      {nombresProductos[m.producto_id] ??
                        m.producto_id}
                    </td>
                    <td className="p-4">
                      <span className={
                        m.tipo === "ENTRADA"
                          ? "text-green-600 font-bold"
                          : "text-red-600 font-bold"
                      }>
                        {m.tipo}
                      </span>
                    </td>
                    <td className="p-4">{m.cantidad}</td>
                    <td className="p-4">{m.stock_anterior}</td>
                    <td className="p-4 font-semibold">
                      {m.stock_nuevo}
                    </td>
                    <td className="p-4">{m.motivo}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {movimientos.length === 0 && (
              <p className="p-6 text-slate-500">
                Todavía no hay movimientos registrados.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
