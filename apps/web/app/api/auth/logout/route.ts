import { NextResponse } from "next/server";
import { withApi } from "@/lib/server/api";
import { destroySession, SESSION_COOKIE } from "@/lib/server/session";

export const POST = withApi(
  async ({ req }) => {
    const cookie = req.headers.get("cookie") ?? "";
    const token = cookie.split(/;\s*/).find((c) => c.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
    await destroySession(token ? decodeURIComponent(token) : null);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", expires: new Date(0) });
    return res;
  },
  { auth: false },
);
