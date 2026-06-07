import { NextResponse, type NextRequest } from "next/server";
import { IyzicoProvider, consumePendingCheckout } from "@/lib/payments/IyzicoProvider";

export const dynamic = "force-dynamic";

function appOrigin(request: NextRequest) {
  return process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
}

export async function POST(request: NextRequest) {
  const origin = appOrigin(request);

  let token: string | null = null;
  try {
    const form = await request.formData();
    const raw = form.get("token");
    if (typeof raw === "string") token = raw;
  } catch {
    // ignore
  }

  if (!token) {
    return NextResponse.redirect(
      `${origin}/abonelik/basarisiz?reason=${encodeURIComponent("Token alınamadı.")}`,
      { status: 303 },
    );
  }

  const pending = consumePendingCheckout(token);

  try {
    const provider = new IyzicoProvider();
    const result = await provider.retrieveCheckoutFormResult(token);

    if (result.status === "success" && result.paymentStatus === "SUCCESS") {
      const plan = pending?.plan ?? "PRO";
      const params = new URLSearchParams({
        plan,
        payment: result.paymentId ?? "",
      });
      return NextResponse.redirect(`${origin}/abonelik/basarili?${params.toString()}`, {
        status: 303,
      });
    }

    const reason = result.errorMessage ?? result.paymentStatus ?? "Ödeme onaylanmadı.";
    return NextResponse.redirect(
      `${origin}/abonelik/basarisiz?reason=${encodeURIComponent(reason)}`,
      { status: 303 },
    );
  } catch (err) {
    const reason = err instanceof Error ? err.message : "Sunucu hatası.";
    return NextResponse.redirect(
      `${origin}/abonelik/basarisiz?reason=${encodeURIComponent(reason)}`,
      { status: 303 },
    );
  }
}

// Bazı iyzico akışlarında callback GET olarak gelebilir.
export async function GET(request: NextRequest) {
  const origin = appOrigin(request);
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(
      `${origin}/abonelik/basarisiz?reason=${encodeURIComponent("Token alınamadı.")}`,
      { status: 303 },
    );
  }

  const pending = consumePendingCheckout(token);
  try {
    const provider = new IyzicoProvider();
    const result = await provider.retrieveCheckoutFormResult(token);
    if (result.status === "success" && result.paymentStatus === "SUCCESS") {
      const plan = pending?.plan ?? "PRO";
      const params = new URLSearchParams({
        plan,
        payment: result.paymentId ?? "",
      });
      return NextResponse.redirect(`${origin}/abonelik/basarili?${params.toString()}`, {
        status: 303,
      });
    }
    const reason = result.errorMessage ?? result.paymentStatus ?? "Ödeme onaylanmadı.";
    return NextResponse.redirect(
      `${origin}/abonelik/basarisiz?reason=${encodeURIComponent(reason)}`,
      { status: 303 },
    );
  } catch (err) {
    const reason = err instanceof Error ? err.message : "Sunucu hatası.";
    return NextResponse.redirect(
      `${origin}/abonelik/basarisiz?reason=${encodeURIComponent(reason)}`,
      { status: 303 },
    );
  }
}
