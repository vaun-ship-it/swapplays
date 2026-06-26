import { autoplayPlans, getPayPalAccessToken, getPayPalBaseUrl, type AutoplayPlanId } from "./plans";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  try {
    const { plan, userId, origin } = req.body || {};
    const selectedPlan = autoplayPlans[plan as AutoplayPlanId];
    if (!selectedPlan || !userId) {
      res.status(400).json({ error: "Missing Autoplay plan or user." });
      return;
    }

    const siteOrigin = typeof origin === "string" && /^https?:\/\//.test(origin)
      ? origin
      : "https://swapplays.vercel.app";
    const accessToken = await getPayPalAccessToken();
    const response = await fetch(`${getPayPalBaseUrl()}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            custom_id: `${userId}:${plan}`,
            description: selectedPlan.label,
            amount: {
              currency_code: "USD",
              value: selectedPlan.amount
            }
          }
        ],
        payment_source: {
          paypal: {
            experience_context: {
              brand_name: "Swap Plays",
              landing_page: "LOGIN",
              user_action: "PAY_NOW",
              return_url: `${siteOrigin}/?paypal=success`,
              cancel_url: `${siteOrigin}/?paypal=cancel`
            }
          }
        }
      })
    });
    const payload = await response.json();
    if (!response.ok) {
      res.status(response.status).json({ error: payload.message || "Could not create PayPal order." });
      return;
    }

    const approvalUrl = payload.links?.find((link: { rel: string }) => link.rel === "payer-action" || link.rel === "approve")?.href;
    if (!approvalUrl) {
      res.status(500).json({ error: "PayPal did not return an approval link." });
      return;
    }

    res.status(200).json({ orderId: payload.id, approvalUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create PayPal order.";
    res.status(500).json({ error: message });
  }
}
