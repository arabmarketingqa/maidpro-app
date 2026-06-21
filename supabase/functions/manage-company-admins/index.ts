// Supabase Edge Function: manage-company-admins
//
// Lists or removes the company_admin users for a given company.
// Runs server-side with the service_role key (auto-injected by Supabase),
// so NO secret ever reaches the browser.
//
// POST body: { action: "list" | "remove" | "reset_password",
//             company_id, user_id?, new_password? }
//
//   action "list":   returns every company_admin for company_id, with email
//                    and signup time (read from the GoTrue Admin API).
//   action "remove": deletes one company_admin's auth user + profiles row.
//   action "reset_password": sets a new password for one company_admin.
//                    SAFETY GUARD (remove + reset_password) — the target is only
//                    touched if its profile is role='company_admin' AND its
//                    company_id matches the company_id passed in. So these
//                    actions can never affect a super_admin, a user from another
//                    company, or a random uid.
//
// In all cases the caller is authenticated and must be a super_admin.
// Deploy via Dashboard → Edge Functions (function name: manage-company-admins).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // These three are auto-injected into every Supabase Edge Function.
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Service-role client: full access, used for auth admin + profile reads/writes.
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    // ── 1. Authenticate the caller ──────────────────────────────────────
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Missing authorization token." }, 401);

    const caller = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: userData, error: userErr } = await caller.auth.getUser();
    if (userErr || !userData?.user) {
      return json({ error: "Invalid or expired session." }, 401);
    }
    const callerId = userData.user.id;

    // ── 2. Authorize: caller must be a super_admin ──────────────────────
    const { data: callerProfile, error: profErr } = await admin
      .from("profiles")
      .select("role")
      .eq("id", callerId)
      .maybeSingle();
    if (profErr) return json({ error: "Could not verify caller role." }, 500);
    if (!callerProfile || callerProfile.role !== "super_admin") {
      return json({ error: "Forbidden: super admin only." }, 403);
    }

    // ── 3. Parse + validate input ───────────────────────────────────────
    let body: { action?: string; company_id?: unknown; user_id?: unknown };
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid request body." }, 400);
    }
    const action = String(body.action || "");
    const companyId = body.company_id;
    if (companyId === undefined || companyId === null || companyId === "") {
      return json({ error: "company_id is required." }, 400);
    }

    // ── action: list ────────────────────────────────────────────────────
    if (action === "list") {
      const { data: rows, error: listErr } = await admin
        .from("profiles")
        .select("id")
        .eq("company_id", companyId)
        .eq("role", "company_admin");
      if (listErr) return json({ error: listErr.message }, 500);

      const admins = [];
      for (const r of rows || []) {
        const { data: u } = await admin.auth.admin.getUserById(r.id);
        admins.push({
          user_id: r.id,
          email: u?.user?.email || "(unknown)",
          created_at: u?.user?.created_at || null,
        });
      }
      // Newest first
      admins.sort((a, b) =>
        String(b.created_at || "").localeCompare(String(a.created_at || "")));
      return json({ ok: true, admins });
    }

    // ── action: remove ──────────────────────────────────────────────────
    if (action === "remove") {
      const userId = body.user_id;
      if (userId === undefined || userId === null || userId === "") {
        return json({ error: "user_id is required." }, 400);
      }

      // SAFETY GUARD: the target must be a company_admin of THIS company.
      const { data: target, error: tErr } = await admin
        .from("profiles")
        .select("role, company_id")
        .eq("id", userId)
        .maybeSingle();
      if (tErr) return json({ error: tErr.message }, 500);
      if (!target) return json({ error: "That admin no longer exists." }, 404);
      if (target.role !== "company_admin" || String(target.company_id) !== String(companyId)) {
        return json({ error: "Refused: that user is not a company admin of this company." }, 403);
      }

      // Delete the auth user first (revokes login), then the profile row.
      const { error: delErr } = await admin.auth.admin.deleteUser(String(userId));
      if (delErr) return json({ error: "Failed to remove user: " + delErr.message }, 500);
      await admin.from("profiles").delete().eq("id", userId); // orphan-safe cleanup

      return json({ ok: true });
    }

    // ── action: reset_password ──────────────────────────────────────────
    if (action === "reset_password") {
      const userId = body.user_id;
      const newPassword = String(body.new_password || "");
      if (userId === undefined || userId === null || userId === "") {
        return json({ error: "user_id is required." }, 400);
      }
      if (newPassword.length < 6) {
        return json({ error: "Password must be at least 6 characters." }, 400);
      }

      // SAFETY GUARD: the target must be a company_admin of THIS company.
      const { data: target, error: tErr } = await admin
        .from("profiles")
        .select("role, company_id")
        .eq("id", userId)
        .maybeSingle();
      if (tErr) return json({ error: tErr.message }, 500);
      if (!target) return json({ error: "That admin no longer exists." }, 404);
      if (target.role !== "company_admin" || String(target.company_id) !== String(companyId)) {
        return json({ error: "Refused: that user is not a company admin of this company." }, 403);
      }

      const { error: updErr } = await admin.auth.admin
        .updateUserById(String(userId), { password: newPassword });
      if (updErr) return json({ error: "Failed to reset password: " + updErr.message }, 500);

      return json({ ok: true });
    }

    return json({ error: "Unknown action." }, 400);
  } catch (e) {
    return json({ error: (e as Error).message || "Unexpected error." }, 500);
  }
});
