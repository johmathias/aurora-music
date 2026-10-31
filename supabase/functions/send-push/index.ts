// ZERO OS — send-push (Supabase Edge Function)
// Runs every minute (cron). Finds alerts that are due, sends them as push notifications, marks them sent.
// Secrets needed (Edge Functions -> Secrets): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, CRON_SECRET
// (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically and never leave the server.)
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const STALE_MS = 3 * 60 * 60 * 1000; // alerts more than 3 hours late are dropped instead of sent

Deno.serve(async (req) => {
  if (req.headers.get("x-cron-secret") !== Deno.env.get("CRON_SECRET")) {
    return new Response("forbidden", { status: 403 });
  }
  const pub = Deno.env.get("VAPID_PUBLIC_KEY"), priv = Deno.env.get("VAPID_PRIVATE_KEY");
  if (!pub || !priv) return new Response("VAPID keys missing", { status: 500 });
  webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com", pub, priv);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const now = new Date();

  // Claim due alerts in ONE step so two overlapping runs can never send the same alert twice.
  const { data: due, error } = await sb.from("push_queue")
    .update({ sent_at: now.toISOString() })
    .is("sent_at", null).lte("fire_at", now.toISOString())
    .select("user_id,key,title,body,fire_at").limit(200);
  if (error) return new Response("db error: " + error.message, { status: 500 });
  if (!due || !due.length) return new Response(JSON.stringify({ sent: 0 }), { headers: { "Content-Type": "application/json" } });

  const fresh = due.filter((d) => now.getTime() - new Date(d.fire_at).getTime() <= STALE_MS);
  const userIds = [...new Set(fresh.map((d) => d.user_id))];
  const { data: subs } = userIds.length
    ? await sb.from("push_subscriptions").select("user_id,endpoint,p256dh,auth").in("user_id", userIds)
    : { data: [] };
  const byUser = new Map<string, any[]>();
  (subs || []).forEach((s) => { byUser.set(s.user_id, [...(byUser.get(s.user_id) || []), s]); });

  let sent = 0, failed = 0, removed = 0;
  for (const d of fresh) {
    const targets = byUser.get(d.user_id) || [];
    let delivered = false, transient = false;
    for (const s of targets) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ title: d.title, body: d.body, key: d.key }),
          { TTL: 3600, urgency: "high" },
        );
        delivered = true; sent++;
      } catch (e: any) {
        if (e?.statusCode === 404 || e?.statusCode === 410) { // phone unsubscribed: forget it
          await sb.from("push_subscriptions").delete().eq("user_id", s.user_id).eq("endpoint", s.endpoint); removed++;
        } else { transient = true; failed++; }
      }
    }
    // Temporary failure and nothing delivered: put it back so the next minute retries.
    if (!delivered && transient) await sb.from("push_queue").update({ sent_at: null }).eq("user_id", d.user_id).eq("key", d.key);
  }
  return new Response(JSON.stringify({ due: due.length, sent, failed, removedSubscriptions: removed }), { headers: { "Content-Type": "application/json" } });
});
