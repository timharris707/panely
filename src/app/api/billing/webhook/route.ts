import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { addCredits, attachStripeCustomer } from "@/lib/billing";
import { getStripeServerClient } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json(
      { error: "Missing webhook signature or secret" },
      { status: 400 }
    );
  }

  try {
    const payload = await request.text();
    const stripe = getStripeServerClient();
    const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const creditsRaw = session.metadata?.credits;

      if (userId && creditsRaw) {
        const credits = Number.parseInt(creditsRaw, 10);
        if (Number.isFinite(credits) && credits > 0) {
          addCredits(userId, credits);
        }
      }

      if (userId && session.customer && typeof session.customer === "string") {
        attachStripeCustomer(userId, session.customer);
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}

