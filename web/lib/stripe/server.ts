import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  if (!stripeClient) {
    stripeClient = new Stripe(key, { typescript: true });
  }
  return stripeClient;
}

export function isStripeConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY?.trim() &&
      process.env.STRIPE_INSIGHTS_PRICE_ID?.trim(),
  );
}

export function getInsightsStripePriceId(): string {
  const priceId = process.env.STRIPE_INSIGHTS_PRICE_ID?.trim();
  if (!priceId) throw new Error("STRIPE_INSIGHTS_PRICE_ID is not configured");
  return priceId;
}

export function getStripeWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  return secret;
}
