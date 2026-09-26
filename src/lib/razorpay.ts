import { createHmac, timingSafeEqual } from "node:crypto";

const RAZORPAY_API = "https://api.razorpay.com/v1";

export function razorpayConfig() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) throw new Error("Razorpay server keys are not configured.");
  return { keyId, keySecret };
}

export async function razorpayRequest<T>(path: string, init: RequestInit = {}) {
  const { keyId, keySecret } = razorpayConfig();
  const authorization = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const response = await fetch(`${RAZORPAY_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Basic ${authorization}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: { description?: string } };
  if (!response.ok) throw new Error(data.error?.description || `Razorpay request failed (${response.status}).`);
  return data as T;
}

export function verifyRazorpaySignature(orderId: string, paymentId: string, signature: string) {
  const { keySecret } = razorpayConfig();
  return safeCompare(
    createHmac("sha256", keySecret).update(`${orderId}|${paymentId}`).digest("hex"),
    signature,
  );
}

export function verifyWebhookSignature(rawBody: string, signature: string) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  return safeCompare(createHmac("sha256", secret).update(rawBody).digest("hex"), signature);
}

function safeCompare(expected: string, actual: string) {
  const expectedBuffer = Buffer.from(expected, "utf8");
  const actualBuffer = Buffer.from(actual, "utf8");
  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
}
