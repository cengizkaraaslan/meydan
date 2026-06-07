import type { SubscriptionPlan } from "../types";

export interface CheckoutSessionInput {
  userId: string;
  email: string;
  plan: SubscriptionPlan;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSession {
  url: string;
  providerSessionId: string;
}

export interface WebhookVerifyInput {
  rawBody: string;
  signature: string;
}

export type WebhookEvent =
  | { type: "subscription.activated"; userId: string; plan: SubscriptionPlan; periodEnd: Date }
  | { type: "subscription.canceled"; userId: string }
  | { type: "payment.failed"; userId: string }
  | { type: "unknown" };

export abstract class PaymentProvider {
  public abstract readonly name: string;

  abstract createCheckoutSession(input: CheckoutSessionInput): Promise<CheckoutSession>;
  abstract cancelSubscription(providerSubId: string): Promise<void>;
  abstract verifyWebhook(input: WebhookVerifyInput): Promise<WebhookEvent>;
}
