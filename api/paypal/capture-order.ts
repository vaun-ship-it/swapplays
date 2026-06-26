import { autoplayPlans, getPayPalAccessToken, getPayPalBaseUrl, type AutoplayPlanId } from "./plans";

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

async function updateAutoplayProfile(userId: string, plan: AutoplayPlanId, autoplayExpiresAt: string) {
  const supabaseUrl = process.env.SUPABASE_URL || "https://xzxktizlgsmhsoadpkab.supabase.co";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("Missing Supabase service role key.");
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`, {
    method: "PATCH",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    },
    body: JSON.stringify({
      autoplay_active: true,
      autoplay_plan: plan,
      autoplay_expires_at: autoplayExpiresAt,
      updated_at: new Date().toISOString()
    })
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(details || "Could not update Autoplay profile.");
  }
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  try {
    const { orderId } = req.body || {};
    if (!orderId) {
      res.status(400).json({ error: "Missing PayPal order ID." });
      return;
    }

    const accessToken = await getPayPalAccessToken();
    const response = await fetch(`${getPayPalBaseUrl()}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      }
    });
    const payload = await response.json();
    if (!response.ok) {
      res.status(response.status).json({ error: payload.message || "Could not capture PayPal order." });
      return;
    }

    const purchaseUnit = payload.purchase_units?.[0];
    const capture = purchaseUnit?.payments?.captures?.[0];
    if (payload.status !== "COMPLETED" || capture?.status !== "COMPLETED") {
      res.status(400).json({ error: "PayPal payment was not completed." });
      return;
    }

    const [userId, planValue] = String(purchaseUnit?.custom_id || "").split(":");
    const selectedPlan = autoplayPlans[planValue as AutoplayPlanId];
    if (!userId || !selectedPlan) {
      res.status(400).json({ error: "PayPal order is missing Autoplay details." });
      return;
    }

    const paidAmount = capture.amount?.value;
    if (paidAmount !== selectedPlan.amount) {
      res.status(400).json({ error: "PayPal payment amount does not match the selected plan." });
      return;
    }

    const autoplayExpiresAt = addDays(selectedPlan.days);
    await updateAutoplayProfile(userId, planValue as AutoplayPlanId, autoplayExpiresAt);

    res.status(200).json({
      ok: true,
      plan: planValue,
      autoplayExpiresAt
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not confirm PayPal payment.";
    res.status(500).json({ error: message });
  }
}
