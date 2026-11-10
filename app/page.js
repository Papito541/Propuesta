"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const formularioVacio = {
  codigo: "",
  nombre: "",
  precio: "",
  stock_actual: "",
  stock_minimo: "",
  stock_objetivo: "",
};

const moneda = (valor) =>
  new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
  }).format(valor);

export default function Home() {
  const router = useRouter();

  const [usuario, setUsuario] = useState(null);
  const [productos, setProductos] = useState([]);
  const [form, setForm] = useState(formularioVacio);
  const [editando, setEditando] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [vista, setVista] = useState("dashboard");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  const cargarProductos = useCallback(async () => {
    const { data, error } = await supabase
      .from("productos")
      .select("*")
      .order("fecha_creacion", { ascending: false });

    if (error) throw error;
    setProductos(data ?? []);
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

        if (activo) {
          setUsuario(data.user);
          await cargarProductos();
        }
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
  }, [router, cargarProductos]);

  function cambiarCampo(e) {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  }

  function limpiarFormulario() {
    setForm(formularioVacio);
    setEditando(null);
  }

  async function guardarProducto(e) {
    e.preventDefault();
    if (!usuario || guardando) return;

    setGuardando(true);
    setError("");
    setMensaje("");

    try {
      const producto = {
        codigo: form.codigo.trim(),
        nombre: form.nombre.trim(),
        precio: Number(form.precio),
        stock_actual: Number(form.stock_actual),
        stock_minimo: Number(form.stock_minimo),
        stock_objetivo: Number(form.stock_objetivo),
      };

      if (!producto.codigo || !producto.nombre) {
        throw new Error("Código y nombre son obligatorios.");
      }

      for (const campo of [
        "precio",
        "stock_actual",
        "stock_minimo",
        "stock_objetivo",
      ]) {
        if (
          form[campo] === "" ||
          !Number.isFinite(producto[campo]) ||
          producto[campo] < 0
        ) {
          throw new Error("Ingresa valores numéricos válidos.");
        }
      }

      for (const campo of ["stock_actual", "stock_minimo", "stock_objetivo"]) {
        if (!Number.isInteger(producto[campo])) {
          throw new Error("Las cantidades deben ser enteras.");
        }
      }

      if (producto.stock_objetivo < producto.stock_minimo) {
        throw new Error("El stock objetivo no puede ser menor al mínimo.");
      }

      let resultado;

      if (editando !== null) {
        resultado = await supabase
          .from("productos")
          .update(producto)
          .eq("id", editando)
          .eq("usuario_id", usuario.id)
          .select("id")
          .single();
      } else {
        resultado = await supabase
          .from("productos")
          .insert({
            ...producto,
            usuario_id: usuario.id,
          })
          .select("id")
          .single();
      }

      if (resultado.error) throw resultado.error;

      await cargarProductos();
      limpiarFormulario();
      setMensaje("Producto guardado correctamente.");
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  function editarProducto(producto) {
    setEditando(producto.id);
    setForm({
      codigo: producto.codigo,
      nombre: producto.nombre,
      precio: String(producto.precio),
      stock_actual: String(producto.stock_actual),
      stock_minimo: String(producto.stock_minimo),
      stock_objetivo: String(producto.stock_objetivo),
    });
    setError("");
    setMensaje("");
    setVista("productos");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function eliminarProducto(id) {
    if (!usuario || !window.confirm("¿Eliminar este producto?")) {
      return;
    }

    setError("");
    setMensaje("");

    try {
      const { data, error } = await supabase
        .from("productos")
        .delete()
        .eq("id", id)
        .eq("usuario_id", usuario.id)
        .select("id");

      if (error) throw error;
      if (!data?.length) {
        throw new Error("No se encontró el producto autorizado.");
      }

      if (editando === id) limpiarFormulario();
      await cargarProductos();
      setMensaje("Producto eliminado correctamente.");
    } catch (err) {
      setError(err.message);
    }
  }

  async function cerrarSesion() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  const total = productos.length;

  const bajos = productos.filter((p) => p.stock_actual < p.stock_minimo);

  const valorInventario = productos.reduce(
    (total, p) => total + Number(p.precio) * p.stock_actual,
    0,
  );

  const filtrados = productos.filter((p) =>
    `${p.nombre} ${p.codigo}`.toLowerCase().includes(busqueda.toLowerCase()),
  );

  const inputClass =
    "w-full border border-slate-300 rounded-lg px-3 py-2 mt-1 text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500";

  if (cargando) {
    return <p className="p-8">Cargando StockPilot AI...</p>;
  }

  if (!usuario) {
    return <p className="p-8">Verificando acceso...</p>;
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto p-5 flex flex-wrap gap-4 justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">StockPilot AI</h1>
            <p className="text-slate-400 text-sm">
              Gestión inteligente de inventarios B2B
            </p>
          </div>
          <button
            onClick={cerrarSesion}
            className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg"
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-5">
        <nav className="flex flex-wrap gap-3 mb-7">
          {[
            ["dashboard", "Dashboard"],
            ["productos", "Productos"],
            ["alertas", "Alertas"],
          ].map(([clave, titulo]) => (
            <button
              key={clave}
              onClick={() => {
                setVista(clave);
                setError("");
                setMensaje("");
              }}
              className={`px-5 py-2 rounded-lg font-medium ${
                vista === clave
                  ? "bg-blue-600 text-white"
                  : "bg-white hover:bg-slate-200"
              }`}
            >
              {titulo}
            </button>
          ))}

          {/* Nuevo módulo de movimientos */}
          <a
            href="/movimientos"
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg font-medium"
          >
            Movimientos de inventario
          </a>
        </nav>

        {error && (
          <div
            role="alert"
            className="bg-red-100 text-red-700 p-4 rounded-lg mb-5"
          >
            {error}
          </div>
        )}

        {mensaje && (
          <div
            role="status"
            className="bg-green-100 text-green-700 p-4 rounded-lg mb-5"
          >
            {mensaje}
          </div>
        )}

        {vista === "dashboard" && (
          <section>
            <h2 className="text-2xl font-bold mb-5">Panel de control</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[
                ["Productos registrados", total, "text-blue-600"],
                ["Productos con stock bajo", bajos.length, "text-red-600"],
                [
                  "Valor del inventario",
                  moneda(valorInventario),
                  "text-green-600",
                ],
              ].map(([titulo, valor, color]) => (
                <div
                  key={titulo}
                  className="bg-white p-6 rounded-xl shadow-sm border border-slate-200"
                >
                  <p className="text-slate-500 mb-3">{titulo}</p>
                  <p className={`text-3xl font-bold ${color}`}>{valor}</p>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl p-6 mt-6 border border-slate-200">
              <h3 className="text-xl font-semibold mb-3">Resumen operativo</h3>
              <p>Productos disponibles: {total - bajos.length}</p>
              <p>Productos que requieren reposición: {bajos.length}</p>

              <button
                onClick={() => setVista("productos")}
                className="mt-5 bg-blue-600 text-white px-5 py-2 rounded-lg"
              >
                Gestionar inventario
              </button>
            </div>
          </section>
        )}

        {vista === "productos" && (
          <section>
            <h2 className="text-2xl font-bold mb-5">Gestión de productos</h2>

            <form
              onSubmit={guardarProducto}
              className="bg-white rounded-xl p-6 border border-slate-200 mb-6"
            >
              <h3 className="font-bold text-lg mb-4">
                {editando !== null
                  ? "Editar producto"
                  : "Registrar nuevo producto"}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  ["codigo", "Código", "text"],
                  ["nombre", "Nombre", "text"],
                  ["precio", "Precio (S/)", "number"],
                  ["stock_actual", "Stock actual", "number"],
                  ["stock_minimo", "Stock mínimo", "number"],
                  ["stock_objetivo", "Stock objetivo", "number"],
                ].map(([campo, titulo, tipo]) => (
                  <label key={campo} className="text-sm font-medium">
                    {titulo}
                    <input
                      name={campo}
                      type={tipo}
                      required
                      min={tipo === "number" ? 0 : undefined}
                      step={
                        campo === "precio"
                          ? "0.01"
                          : tipo === "number"
                            ? "1"
                            : undefined
                      }
                      value={form[campo]}
                      onChange={cambiarCampo}
                      className={inputClass}
                    />
                  </label>
                ))}
              </div>

              <div className="flex gap-3 mt-5">
                <button
                  type="submit"
                  disabled={guardando}
                  className="bg-blue-600 text-white px-5 py-2 rounded-lg disabled:opacity-50"
                >
                  {guardando
                    ? "Guardando..."
                    : editando !== null
                      ? "Actualizar producto"
                      : "Registrar producto"}
                </button>

                {editando !== null && (
                  <button
                    type="button"
                    onClick={limpiarFormulario}
                    className="bg-slate-200 px-5 py-2 rounded-lg"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="p-5">
                <h3 className="font-bold text-lg mb-3">
                  Productos registrados
                </h3>
                <input
                  type="search"
                  placeholder="Buscar por nombre o código..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {[
                        "Código",
                        "Producto",
                        "Precio",
                        "Stock",
                        "Estado",
                        "Acciones",
                      ].map((h) => (
                        <th key={h} className="p-4">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {filtrados.map((p) => (
                      <tr key={p.id} className="border-t border-slate-200">
                        <td className="p-4">{p.codigo}</td>
                        <td className="p-4 font-medium">{p.nombre}</td>
                        <td className="p-4">{moneda(p.precio)}</td>
                        <td className="p-4">{p.stock_actual}</td>
                        <td className="p-4">
                          <span
                            className={
                              p.stock_actual < p.stock_minimo
                                ? "text-red-600 font-semibold"
                                : "text-green-600 font-semibold"
                            }
                          >
                            {p.stock_actual < p.stock_minimo
                              ? "Stock bajo"
                              : "Disponible"}
                          </span>
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          <button
                            onClick={() => editarProducto(p)}
                            className="text-blue-600 mr-4"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => eliminarProducto(p.id)}
                            className="text-red-600"
                          >
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {filtrados.length === 0 && (
                  <p className="p-5 text-slate-500">
                    No se encontraron productos.
                  </p>
                )}
              </div>
            </div>
          </section>
        )}

        {vista === "alertas" && (
          <section>
            <h2 className="text-2xl font-bold mb-5">
              Alertas de abastecimiento
            </h2>

            {bajos.length === 0 ? (
              <div className="bg-white rounded-xl p-6">
                No hay productos con stock bajo.
              </div>
            ) : (
              bajos.map((p) => (
                <div
                  key={p.id}
                  className="bg-white border-l-4 border-red-500 rounded-xl p-5 mb-4 shadow-sm"
                >
                  <h3 className="text-lg font-bold">{p.nombre}</h3>
                  <p className="text-sm text-slate-500">Código: {p.codigo}</p>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                    <p>
                      Stock actual: <strong>{p.stock_actual}</strong>
                    </p>
                    <p>
                      Stock mínimo: <strong>{p.stock_minimo}</strong>
                    </p>
                    <p>
                      Stock objetivo: <strong>{p.stock_objetivo}</strong>
                    </p>
                    <p className="text-blue-700">
                      Reponer:{" "}
                      <strong>
                        {Math.max(0, p.stock_objetivo - p.stock_actual)}
                      </strong>
                    </p>
                  </div>
                </div>
              ))
            )}
          </section>
        )}
      </main>
    </div>
  );
}
