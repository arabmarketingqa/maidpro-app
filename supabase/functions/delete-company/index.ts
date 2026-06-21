// Supabase Edge Function: delete-company
//
// Permanently deletes a company and EVERYTHING it owns. Destructive.
// Runs server-side with the service_role key (auto-injected by Supabase),
// so NO secret ever reaches the browser.
//
// POST body: { company_id }
//
// Order (FKs are ON DELETE RESTRICT, so children must go before the company):
//   1. authenticate caller + authorize super_admin only
//   2. confirm the company exists
//   3. delete all tenant data for company_id (8 tables), aborting on first error
//   4. delete its company_admin auth users + profiles rows
//   5. delete the company row
//
// NOTE: not a single atomic transaction (auth-user deletes can't sit inside a
// DB transaction). On any error we abort BEFORE deleting the company row, so a
// half-deleted company row never happens; the error is returned for a retry.
//
// Deploy via Dashboard → Edge Functions (function name: delete-company).

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

// Children-first: tenant tables before profiles before the company row.
const TENANT_TABLES = [
  "bookings",
  "regular_schedules",
  "availability",
  "customers",
  "staff",
  "nationalities",
  "services",
  "settings",
];

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

  // Service-role client: full access, used for all deletes + auth admin.
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

    // ── 3. Validate + confirm the company exists ────────────────────────
    let body: { company_id?: unknown };
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid request body." }, 400);
    }
    const companyId = body.company_id;
    if (companyId === undefined || companyId === null || companyId === "") {
      return json({ error: "company_id is required." }, 400);
    }

    const { data: company, error: coErr } = await admin
      .from("companies")
      .select("id, name")
      .eq("id", companyId)
      .maybeSingle();
    if (coErr) return json({ error: "Could not look up company." }, 500);
    if (!company) return json({ error: "Company not found." }, 404);

    // ── 4. Delete all tenant data (abort on first error) ────────────────
    for (const table of TENANT_TABLES) {
      const { error: delErr } = await admin.from(table).delete().eq("company_id", companyId);
      if (delErr) {
        return json({
          error: `Failed deleting ${table}: ${delErr.message}. ` +
                 `Company was NOT deleted — no further changes made after this point.`,
        }, 500);
      }
    }

    // ── 5. Delete company_admin auth users, then their profiles rows ────
    const { data: admins, error: adminsErr } = await admin
      .from("profiles")
      .select("id")
      .eq("company_id", companyId);
    if (adminsErr) {
      return json({ error: `Failed reading company admins: ${adminsErr.message}` }, 500);
    }
    for (const a of admins || []) {
      const { error: duErr } = await admin.auth.admin.deleteUser(String(a.id));
      // Ignore "user not found" so a missing auth user doesn't block cleanup.
      if (duErr && !String(duErr.message || "").toLowerCase().includes("not found")) {
        return json({ error: `Failed deleting admin user: ${duErr.message}` }, 500);
      }
    }
    const { error: profDelErr } = await admin.from("profiles").delete().eq("company_id", companyId);
    if (profDelErr) {
      return json({ error: `Failed deleting profiles: ${profDelErr.message}` }, 500);
    }

    // ── 6. Delete the company row last ──────────────────────────────────
    const { error: companyDelErr } = await admin.from("companies").delete().eq("id", companyId);
    if (companyDelErr) {
      return json({ error: `Failed deleting company: ${companyDelErr.message}` }, 500);
    }

    return json({ ok: true, deleted_company: company.name, admins_removed: (admins || []).length });
  } catch (e) {
    return json({ error: (e as Error).message || "Unexpected error." }, 500);
  }
});
