import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";

type AdminResult =
  | { adminClient: SupabaseClient; user: User }
  | { error: string };

const getAdminUser = async (token: string): Promise<AdminResult> => {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!serviceRoleKey || !supabaseUrl) {
    return { error: "Server is not configured" };
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const {
    data: { user },
    error: userError,
  } = await adminClient.auth.getUser(token);

  if (userError || !user) {
    return { error: "Unauthorized" };
  }

  const metadataRole = user.user_metadata?.role;
  const appRole = user.app_metadata?.role;
  const isAdmin = metadataRole === "admin" || appRole === "admin";

  if (!isAdmin) {
    return { error: "Forbidden" };
  }

  return { adminClient, user };
};

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const result = await getAdminUser(token);

    if ("error" in result) {
      const status = result.error === "Forbidden" ? 403 : 401;
      return NextResponse.json({ error: result.error }, { status });
    }

    const { adminClient } = result;
    const { data, error } = await adminClient.auth.admin.listUsers({
      perPage: 200,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const users = (data?.users ?? []).map((user) => ({
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      role: user.user_metadata?.role ?? user.app_metadata?.role ?? null,
    }));

    return NextResponse.json({ users }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("id");
    if (!userId) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const token = authHeader.replace("Bearer ", "");
    const result = await getAdminUser(token);

    if ("error" in result) {
      const status = result.error === "Forbidden" ? 403 : 401;
      return NextResponse.json({ error: result.error }, { status });
    }

    const { adminClient } = result;
    const { error } = await adminClient.auth.admin.deleteUser(userId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
