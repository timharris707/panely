import { NextRequest, NextResponse } from "next/server";
import { getLocalAuthClient } from "@/lib/local-auth/server";
import { CREDIT_PACKS, CreditPackId } from "@/lib/billing";
import { getStripeServerClient } from "@/lib/stripe";

function isValidPackId(value: string): value is CreditPackId {
  return Object.prototype.hasOwnProperty.call(CREDIT_PACKS, value);
}

export async function POST(request: NextRequest) {
  try {
    const authClient = await getLocalAuthClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const packId = String(body?.packId ?? "");
    if (!isValidPackId(packId)) {
      return NextResponse.json({ error: "Invalid packId" }, { status: 400 });
    }

    const pack = CREDIT_PACKS[packId];
    const stripe = getStripeServerClient();
    const origin = request.nextUrl.origin;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: `${origin}/billing?success=1`,
      cancel_url: `${origin}/billing?canceled=1`,
      customer_email: user.email ?? undefined,
      metadata: {
        userId: user.id,
        packId: pack.id,
        credits: String(pack.credits),
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: pack.amountCents,
            product_data: {
              name: `${pack.name} (${pack.credits} credits)`,
              description: "Panely advisory session credits",
            },
          },
        },
      ],
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
