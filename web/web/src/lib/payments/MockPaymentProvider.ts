import { PaymentProvider, type CheckoutSession, type CheckoutSessionInput, type WebhookEvent, type WebhookVerifyInput } from "./PaymentProvider";

export class MockPaymentProvider extends PaymentProvider {
  public readonly name = "mock";

  async createCheckoutSession(input: CheckoutSessionInput): Promise<CheckoutSession> {
    const sessionId = `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const url = `/abonelik/mock?session=${sessionId}&plan=${input.plan}&success=${encodeURIComponent(input.successUrl)}`;
    return { url, providerSessionId: sessionId };
  }

  async cancelSubscription(providerSubId: string): Promise<void> {
    // no-op
    void providerSubId;
  }

  async verifyWebhook(input: WebhookVerifyInput): Promise<WebhookEvent> {
    try {
      const parsed = JSON.parse(input.rawBody) as WebhookEvent;
      return parsed;
    } catch {
      return { type: "unknown" };
    }
  }
}

export const paymentProvider = new MockPaymentProvider();
