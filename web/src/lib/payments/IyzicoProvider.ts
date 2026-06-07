import "server-only";
import { PLAN_LIMITS, type SubscriptionPlan } from "@/lib/types";

// iyzipay paketinin TypeScript tipi yok; CommonJS olarak import et.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Iyzipay = require("iyzipay") as IyzipayCtor;

type IyzipayCtor = new (config: { apiKey: string; secretKey: string; uri: string }) => IyzipayClient;

interface IyzipayClient {
  checkoutFormInitialize: {
    create: (
      request: Record<string, unknown>,
      cb: (err: unknown, result: CheckoutFormInitializeResult) => void,
    ) => void;
  };
  checkoutForm: {
    retrieve: (
      request: Record<string, unknown>,
      cb: (err: unknown, result: CheckoutFormRetrieveResult) => void,
    ) => void;
  };
}

interface CheckoutFormInitializeResult {
  status?: "success" | "failure";
  errorCode?: string;
  errorMessage?: string;
  token?: string;
  checkoutFormContent?: string;
  paymentPageUrl?: string;
  conversationId?: string;
  signature?: string;
}

interface CheckoutFormRetrieveResult {
  status?: "success" | "failure";
  paymentStatus?: string;
  paymentId?: string;
  conversationId?: string;
  paidPrice?: string | number;
  price?: string | number;
  errorCode?: string;
  errorMessage?: string;
  token?: string;
}

export interface CreateCheckoutInput {
  plan: SubscriptionPlan;
  user: { email: string; name?: string | null; id?: string };
  callbackUrl: string;
}

export interface CreateCheckoutResult {
  token: string;
  checkoutFormContent: string;
  paymentPageUrl: string;
  conversationId: string;
}

export interface RetrieveCheckoutResult {
  status: "success" | "failure";
  paymentStatus?: string;
  paymentId?: string;
  conversationId?: string;
  paidPrice?: string;
  errorCode?: string;
  errorMessage?: string;
}

const LOCALE_TR = "tr";
const CURRENCY_TRY = "TRY";
const PAYMENT_GROUP_SUBSCRIPTION = "SUBSCRIPTION";
const BASKET_ITEM_VIRTUAL = "VIRTUAL";

export class IyzicoProvider {
  private readonly client: IyzipayClient;

  constructor() {
    const apiKey = process.env.IYZICO_API_KEY;
    const secretKey = process.env.IYZICO_SECRET_KEY;
    const uri = process.env.IYZICO_BASE_URL;

    if (!apiKey || !secretKey || !uri) {
      throw new Error(
        "iyzico yapılandırılmamış. IYZICO_API_KEY, IYZICO_SECRET_KEY ve IYZICO_BASE_URL gerekli.",
      );
    }

    this.client = new Iyzipay({ apiKey, secretKey, uri });
  }

  async createCheckoutFormToken(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    const plan = PLAN_LIMITS[input.plan];
    if (!plan || plan.monthlyPriceTL <= 0) {
      throw new Error(`Geçersiz plan: ${input.plan}`);
    }

    const conversationId = `${input.user.email}-${input.plan}-${Date.now()}`;
    const priceStr = plan.monthlyPriceTL.toFixed(2);
    const fullName = (input.user.name ?? "MeydanFest Kullanıcı").trim();
    const [firstName, ...rest] = fullName.split(/\s+/);
    const surname = rest.join(" ") || "Kullanıcı";

    const request = {
      locale: LOCALE_TR,
      conversationId,
      price: priceStr,
      paidPrice: priceStr,
      currency: CURRENCY_TRY,
      basketId: `meydanfest-${input.plan}`,
      paymentGroup: PAYMENT_GROUP_SUBSCRIPTION,
      callbackUrl: input.callbackUrl,
      enabledInstallments: [1, 2, 3, 6, 9],
      buyer: {
        id: input.user.id ?? input.user.email,
        name: firstName || "MeydanFest",
        surname,
        gsmNumber: "+905350000000",
        email: input.user.email,
        identityNumber: "11111111111",
        registrationAddress: "MeydanFest, Online",
        ip: "85.34.78.112",
        city: "Istanbul",
        country: "Turkey",
        zipCode: "34000",
      },
      shippingAddress: {
        contactName: fullName || "MeydanFest Kullanıcı",
        city: "Istanbul",
        country: "Turkey",
        address: "Dijital teslimat",
        zipCode: "34000",
      },
      billingAddress: {
        contactName: fullName || "MeydanFest Kullanıcı",
        city: "Istanbul",
        country: "Turkey",
        address: "Dijital teslimat",
        zipCode: "34000",
      },
      basketItems: [
        {
          id: `plan-${input.plan}`,
          name: `MeydanFest ${input.plan} Aboneliği`,
          category1: "Abonelik",
          category2: "Dijital",
          itemType: BASKET_ITEM_VIRTUAL,
          price: priceStr,
        },
      ],
    };

    const result = await new Promise<CheckoutFormInitializeResult>((resolve, reject) => {
      this.client.checkoutFormInitialize.create(request, (err, res) => {
        if (err) {
          reject(err instanceof Error ? err : new Error(String(err)));
          return;
        }
        resolve(res);
      });
    });

    if (result.status !== "success" || !result.token || !result.paymentPageUrl) {
      throw new Error(
        result.errorMessage ?? "iyzico checkout form oluşturulamadı.",
      );
    }

    return {
      token: result.token,
      checkoutFormContent: result.checkoutFormContent ?? "",
      paymentPageUrl: result.paymentPageUrl,
      conversationId: result.conversationId ?? conversationId,
    };
  }

  async retrieveCheckoutFormResult(token: string): Promise<RetrieveCheckoutResult> {
    const request = {
      locale: LOCALE_TR,
      conversationId: `retrieve-${Date.now()}`,
      token,
    };

    const result = await new Promise<CheckoutFormRetrieveResult>((resolve, reject) => {
      this.client.checkoutForm.retrieve(request, (err, res) => {
        if (err) {
          reject(err instanceof Error ? err : new Error(String(err)));
          return;
        }
        resolve(res);
      });
    });

    return {
      status: result.status === "success" ? "success" : "failure",
      paymentStatus: result.paymentStatus,
      paymentId: result.paymentId,
      conversationId: result.conversationId,
      paidPrice: result.paidPrice != null ? String(result.paidPrice) : undefined,
      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
    };
  }
}

// Modül kapsamında tutulan token → {plan, userEmail} eşlemesi (sandbox/mock için).
export interface PendingCheckout {
  plan: SubscriptionPlan;
  userEmail: string;
  createdAt: number;
}

const pendingCheckouts = new Map<string, PendingCheckout>();

export function rememberPendingCheckout(token: string, info: Omit<PendingCheckout, "createdAt">) {
  pendingCheckouts.set(token, { ...info, createdAt: Date.now() });
}

export function consumePendingCheckout(token: string): PendingCheckout | undefined {
  const found = pendingCheckouts.get(token);
  if (found) pendingCheckouts.delete(token);
  return found;
}
