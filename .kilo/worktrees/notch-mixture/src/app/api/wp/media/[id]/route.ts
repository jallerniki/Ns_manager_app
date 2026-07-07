import { NextRequest, NextResponse } from "next/server";
import { wpFetch, getToken, errorResponse } from "@/lib/wp-server";

export const runtime = "nodejs";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = getToken(req);
    const { id } = await params;
    const force = new URL(req.url).searchParams.get("force") !== "false";
    const res = await wpFetch(`/wp/v2/media/${id}?force=${force}`, token, {
      method: "DELETE",
    });
    const text = await res.text();
    if (!res.ok) {
      let msg = `Ошибка ${res.status}`;
      try {
        const j = JSON.parse(text);
        if (j?.message) msg = String(j.message).replace(/<[^>]+>/g, "").trim();
      } catch { /* ignore */ }
      return NextResponse.json({ error: msg }, { status: res.status });
    }
    const data = text ? JSON.parse(text) : { deleted: true };
    return NextResponse.json(data);
  } catch (err) {
    return errorResponse(err);
  }
}
