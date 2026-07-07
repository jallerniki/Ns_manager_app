import { NextRequest, NextResponse } from "next/server";
import { wpFetch, wpFetchJson, getToken, errorResponse } from "@/lib/wp-server";
import type { WpProduct } from "@/lib/wp-types";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = getToken(req);
    const { id } = await params;
    const product = await wpFetchJson<WpProduct>(
      `/wc/v3/products/${id}?context=edit`,
      token
    );
    return NextResponse.json(product);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = getToken(req);
    const { id } = await params;
    const body = await req.json();
    const updated = await wpFetchJson<WpProduct>(`/wc/v3/products/${id}`, token, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    return NextResponse.json(updated);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = getToken(req);
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const force = searchParams.get("force") === "true";
    const result = await wpFetchJson(`/wc/v3/products/${id}?force=${force}`, token, {
      method: "DELETE",
    });
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
