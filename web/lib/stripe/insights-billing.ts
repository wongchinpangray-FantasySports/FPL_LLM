import { getServerSupabase } from "@/lib/supabase";
import { getStripe, getInsightsStripePriceId } from "@/lib/stripe/server";
import type Stripe from "stripe";

export async function grantInsightsPremium(
  userId: string,
  opts: {
    stripeCustomerId?: string | null;
    expiresAt?: Date | null;
  } = {},
): Promise<void> {
  const supa = getServerSupabase();
  const patch: Record<string, unknown> = {
    insights_plan: "premium",
    insights_plan_expires_at: opts.expiresAt?.toISOString() ?? null,
  };
  if (opts.stripeCustomerId) {
    patch.stripe_customer_id = opts.stripeCustomerId;
  }
  const { error } = await supa.from("profiles").update(patch).eq("id", userId);
  if (error) throw new Error(error.message);
}

export async function revokeInsightsPremium(userId: string): Promise<void> {
  const supa = getServerSupabase();
  const { error } = await supa
    .from("profiles")
    .update({
      insights_plan: "free",
      insights_plan_expires_at: null,
    })
    .eq("id", userId);
  if (error) throw new Error(error.message);
}

export async function findUserIdByStripeCustomer(
  customerId: string,
): Promise<string | null> {
  const supa = getServerSupabase();
  const { data } = await supa
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

export async function createInsightsCheckoutSession(opts: {
  userId: string;
  email: string | null;
  successUrl: string;
  cancelUrl: string;
  locale?: string;
}): Promise<string> {
  const stripe = getStripe();
  const priceId = getInsightsStripePriceId();
  const supa = getServerSupabase();

  const { data: profile } = await supa
    .from("profiles")
    .select("stripe_customer_id,insights_plan")
    .eq("id", opts.userId)
    .maybeSingle();

  if (profile?.insights_plan === "premium") {
    throw new Error("Already subscribed to Insights Pro");
  }

  let customerId = (profile?.stripe_customer_id as string | null) ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: opts.email ?? undefined,
      metadata: { user_id: opts.userId },
    });
    customerId = customer.id;
    await supa
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", opts.userId);
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: opts.userId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    locale: opts.locale === "zh" ? "zh" : "en",
    subscription_data: {
      metadata: { user_id: opts.userId },
    },
    metadata: { user_id: opts.userId },
  });

  if (!session.url) throw new Error("Stripe checkout session missing URL");
  return session.url;
}

export async function createInsightsPortalSession(opts: {
  userId: string;
  returnUrl: string;
}): Promise<string> {
  const stripe = getStripe();
  const supa = getServerSupabase();
  const { data: profile } = await supa
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", opts.userId)
    .maybeSingle();

  const customerId = profile?.stripe_customer_id as string | null;
  if (!customerId) {
    throw new Error("No Stripe customer on file");
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: opts.returnUrl,
  });
  return session.url;
}

function subscriptionExpiresAt(subscription: Stripe.Subscription): Date | null {
  const end = (
    subscription as Stripe.Subscription & { current_period_end?: number | null }
  ).current_period_end;
  return typeof end === "number" ? new Date(end * 1000) : null;
}

export async function syncInsightsPlanFromSubscription(
  subscription: Stripe.Subscription,
): Promise<void> {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id ?? null;

  let userId: string | null = subscription.metadata?.user_id ?? null;
  if (!userId && customerId) {
    userId = await findUserIdByStripeCustomer(customerId);
  }
  if (!userId) return;

  const active =
    subscription.status === "active" || subscription.status === "trialing";

  if (active) {
    await grantInsightsPremium(userId, {
      stripeCustomerId: customerId,
      expiresAt: subscriptionExpiresAt(subscription),
    });
    return;
  }

  await revokeInsightsPremium(userId);
}
