// Supabase Edge Function: create-company-admin
//
// Creates a loginable company_admin user for a given company.
// Runs server-side with the service_role key (auto-injected by Supabase),
// so NO secret ever reaches the browser.
//
// Flow:
//   1. Authenticate the caller from their JWT.
//   2. Authorize: reject unless the caller's profile role === 'super_admin'.
//   3. Validate input (email, password >= 6, company_id exists).
//   4. Create an auto-confirmed auth user (GoTrue Admin API).
//   5. Insert a profiles row linking the user to the company as company_admin.
//   6. Roll back the auth user if the profile insert fails (no orphans).
//
// Deploy via Dashboard → Edge Functions (function name: create-company-admin).

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

  // Service-role client: full access, used for auth admin + profile writes.
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    // ── 1. Authenticate the caller ──────────────────────────────────────
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Missing authorization token." }, 401);

    // Resolve the caller from their JWT (anon client + the caller's token).
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

    // ── 3. Validate input ───────────────────────────────────────────────
    let body: { email?: string; password?: string; company_id?: unknown };
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid request body." }, 400);
    }
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const companyId = body.company_id;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: "A valid email is required." }, 400);
    }
    if (password.length < 6) {
      return json({ error: "Password must be at least 6 characters." }, 400);
    }
    if (companyId === undefined || companyId === null || companyId === "") {
      return json({ error: "company_id is required." }, 400);
    }

    // Confirm the company exists.
    const { data: company, error: coErr } = await admin
      .from("companies")
      .select("id")
      .eq("id", companyId)
      .maybeSingle();
    if (coErr) return json({ error: "Could not look up company." }, 500);
    if (!company) return json({ error: "Company not found." }, 404);

    // ── 4. Create the auth user (auto-confirmed) ────────────────────────
    const { data: created, error: createErr } = await admin.auth.admin
      .createUser({ email, password, email_confirm: true });
    if (createErr || !created?.user) {
      const msg = (createErr?.message || "").toLowerCase();
      if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
        return json({ error: "A user with this email already exists." }, 409);
      }
      return json({ error: createErr?.message || "Failed to create user." }, 400);
    }
    const newUserId = created.user.id;

    // ── 5. Link the profile (rollback the auth user on failure) ─────────
    const { error: insErr } = await admin
      .from("profiles")
      .insert({ id: newUserId, role: "company_admin", company_id: companyId });
    if (insErr) {
      await admin.auth.admin.deleteUser(newUserId); // avoid orphan auth user
      return json({ error: "Failed to link profile: " + insErr.message }, 500);
    }

    // ── 6. Success ──────────────────────────────────────────────────────
    return json({ ok: true, user_id: newUserId, email });
  } catch (e) {
    return json({ error: (e as Error).message || "Unexpected error." }, 500);
  }
});
