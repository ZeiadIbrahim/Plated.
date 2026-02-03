import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await request.json().catch(() => null);

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!serviceRoleKey || !supabaseUrl) {
      return NextResponse.json(
        { error: "Server is not configured" },
        { status: 500 }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await adminClient.auth.getUser(token);

    if (userError || !user) {
      const message = userError?.message ?? "";
      if (message.includes("User from sub claim in JWT does not exist")) {
        return NextResponse.json({ success: true });
      }
      return NextResponse.json(
        { error: "Session expired. Please sign in again." },
        { status: 401 }
      );
    }

    const { error: recipesError } = await adminClient
      .from("recipes")
      .delete()
      .eq("user_id", user.id);

    if (recipesError) {
      return NextResponse.json(
        { error: "Failed to delete recipes.", detail: recipesError.message },
        { status: 500 }
      );
    }


    const { data: avatarFiles, error: listError } = await adminClient.storage
      .from("avatars")
      .list(user.id, { limit: 100 });

    if (!listError && avatarFiles?.length) {
      const paths = avatarFiles.map((file) => `${user.id}/${file.name}`);
      const { error: removeError } = await adminClient.storage
        .from("avatars")
        .remove(paths);
      if (removeError) {
        return NextResponse.json(
          { error: "Failed to delete avatar files.", detail: removeError.message },
          { status: 500 }
        );
      }
    }

    const { error } = await adminClient.auth.admin.deleteUser(user.id);
    if (error) {
      const message = error.message.toLowerCase();
      if (message.includes("user not found") || message.includes("not found")) {
        return NextResponse.json({ success: true });
      }
      return NextResponse.json(
        { error: "Failed to delete user.", detail: error.message },
        { status: 500 }
      );
    }

    if (payload && (payload.reason || payload.details)) {
      console.info("Account deletion feedback", {
        userId: user.id,
        reason: payload.reason ?? null,
        details: payload.details ?? null,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
