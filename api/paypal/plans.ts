export type AutoplayPlanId = "week" | "month" | "plus";

export const autoplayPlans: Record<AutoplayPlanId, { amount: string; label: string; days: number }> = {
  week: { amount: "9.99", label: "Autoplay - one week", days: 7 },
  month: { amount: "36.99", label: "Autoplay - one month", days: 30 },
  plus: { amount: "399.99", label: "Autoplay Plus - yearly", days: 365 }
};

export function getPayPalBaseUrl() {
  return process.env.PAYPAL_ENV === "sandbox"
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";
}

export async function getPayPalAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Missing PayPal credentials.");
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch(`${getPayPalBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error_description || "Could not authenticate with PayPal.");
  }
  return payload.access_token as string;
}
