
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function GET() {
  try {
    const { data, error } = await getSupabase()
      .from("productos")
      .select("*")
      .order("fecha_creacion", { ascending: false });

    if (error) {
      console.error(error);
      return NextResponse.json(
        { error: "Error consultando productos" },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Error de conexión" },
      { status: 500 }
    );
  }
}
