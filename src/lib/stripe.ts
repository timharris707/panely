import Stripe from "stripe";

let cachedStripe: Stripe | null = null;

export function getStripeServerClient() {
  if (cachedStripe) return cachedStripe;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  cachedStripe = new Stripe(secretKey);
  return cachedStripe;
}

