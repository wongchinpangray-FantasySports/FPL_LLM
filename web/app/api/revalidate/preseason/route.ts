import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

/** Bust ISR cache for pre-season pages after CI updates bundled JSON. */
export async function POST(req: Request) {
  const secret = process.env.REVALIDATE_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Chinese-only public site (`as-needed` → unprefixed `/fpl/preseason`).
  revalidatePath("/fpl/preseason");
  revalidatePath("/zh/fpl/preseason");

  return NextResponse.json({ revalidated: true, at: new Date().toISOString() });
}
