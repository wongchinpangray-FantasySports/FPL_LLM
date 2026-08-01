import { NextResponse, type NextRequest } from "next/server";
import { getStripe, getStripeWebhookSecret } from "@/lib/stripe/server";
import {
  grantInsightsPremium,
  syncInsightsPlanFromSubscription,
} from "@/lib/stripe/insights-billing";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  const webhookSecret = getStripeWebhookSecret();
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const body = await request.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invalid signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId =
          session.client_reference_id ?? session.metadata?.user_id ?? null;
        const customerId =
          typeof session.customer === "string" ? session.customer : null;

        if (userId) {
          if (session.mode === "subscription" && session.subscription) {
            const subId =
              typeof session.subscription === "string"
                ? session.subscription
                : session.subscription.id;
            const subscription = await stripe.subscriptions.retrieve(subId);
            await syncInsightsPlanFromSubscription(subscription);
          } else {
            await grantInsightsPremium(userId, {
              stripeCustomerId: customerId,
            });
          }
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await syncInsightsPlanFromSubscription(event.data.object);
        break;
      }
      default:
        break;
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Webhook handler failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
