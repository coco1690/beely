import type { Database, Tabla } from "@beely/tipos";
import { create } from "zustand";
import { mensajeDe } from "../lib/funciones";
import { supabase } from "../lib/supabase";

// Fila de public.superadmin_negocios(): el negocio con sus métricas del periodo.
export type NegocioPlataforma =
  Database["public"]["Functions"]["superadmin_negocios"]["Returns"][number];

export type PlanBeely = Tabla<"planes">;

export type PuntoSerie = { dia: string; sellos: number; clientes: number };

// Forma del jsonb de public.superadmin_tablero().
export type Tablero = {
  dias: number;
  negocios: {
    total: number;
    activos: number;
    suspendidos: number;
    cancelados: number;
    nuevos: number;
    por_plan: Record<string, number>;
  };
  clientes: { total: number; nuevos: number };
  sellos: { periodo: number };
  cupones: { emitidos_periodo: number; canjeados_periodo: number };
  equipo: { miembros: number };
  serie: PuntoSerie[];
};

export const periodos = [7, 30, 90] as const;
export type Periodo = (typeof periodos)[number];

type EstadoPlataforma = {
  dias: Periodo;
  negocios: NegocioPlataforma[] | null;
  tablero: Tablero | null;
  planes: PlanBeely[] | null;
  error: string | null;
  elegirDias: (dias: Periodo) => Promise<void>;
  cargarNegocios: () => Promise<void>;
  cargarTablero: () => Promise<void>;
  cargarPlanes: () => Promise<void>;
  cambiarEstado: (id: string, estado: string) => Promise<string | null>;
};

let cargaPlanes: Promise<void> | null = null;

export const usePlataformaStore = create<EstadoPlataforma>()((set, get) => ({
  dias: 30,
  negocios: null,
  tablero: null,
  planes: null,
  error: null,

  elegirDias: async (dias) => {
    set({ dias });
    await Promise.all([get().cargarNegocios(), get().cargarTablero()]);
  },

  cargarNegocios: async () => {
    const { data, error } = await supabase.rpc("superadmin_negocios", {
      p_dias: get().dias,
    });
    if (error) set({ error: mensajeDe(error) });
    else set({ negocios: data, error: null });
  },

  cargarTablero: async () => {
    const { data, error } = await supabase.rpc("superadmin_tablero", {
      p_dias: get().dias,
    });
    if (error) set({ error: mensajeDe(error) });
    else set({ tablero: data as unknown as Tablero, error: null });
  },

  // Cambio optimista desde la lista: el interruptor responde al instante y, si
  // la RPC falla, la fila vuelve a su estado. Devuelve el error, o null.
  cambiarEstado: async (id, estado) => {
    const negocio = get().negocios?.find((n) => n.id === id);
    if (!negocio) return "negocio_no_encontrado";
    const poner = (valor: string) =>
      set((e) => ({
        negocios:
          e.negocios?.map((n) => (n.id === id ? { ...n, estado: valor } : n)) ??
          null,
      }));
    const anterior = negocio.estado;
    poner(estado);
    const { error } = await supabase.rpc("superadmin_actualizar_negocio", {
      p_negocio_id: id,
      p_plan: negocio.plan,
      p_estado: estado,
    });
    if (error) {
      poner(anterior);
      return mensajeDe(error);
    }
    void get().cargarTablero();
    return null;
  },

  // Varias pantallas (y cada insignia) la piden a la vez: una sola consulta en vuelo.
  cargarPlanes: () =>
    (cargaPlanes ??= (async () => {
      const { data, error } = await supabase
        .from("planes")
        .select("*")
        .order("orden")
        .order("nombre");
      if (error) set({ error: mensajeDe(error) });
      else set({ planes: data, error: null });
    })().finally(() => {
      cargaPlanes = null;
    })),
}));
