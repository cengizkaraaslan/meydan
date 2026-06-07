import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { IyzicoProvider, rememberPendingCheckout } from "@/lib/payments/IyzicoProvider";

const Body = z.object({
  plan: z.enum(["PRO", "BUSINESS"]),
});

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Önce giriş yap." }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON." }, { status: 400 });
  }

  const parsed = Body.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Geçersiz plan." },
      { status: 400 },
    );
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    new URL(request.url).origin;
  const callbackUrl = `${appUrl}/api/payments/iyzico/callback`;

  try {
    const provider = new IyzicoProvider();
    const result = await provider.createCheckoutFormToken({
      plan: parsed.data.plan,
      user: {
        email: session.user.email,
        name: session.user.name,
        id: session.user.id,
      },
      callbackUrl,
    });

    rememberPendingCheckout(result.token, {
      plan: parsed.data.plan,
      userEmail: session.user.email,
    });

    return NextResponse.json({
      paymentPageUrl: result.paymentPageUrl,
      token: result.token,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "iyzico hatası." },
      { status: 500 },
    );
  }
}
