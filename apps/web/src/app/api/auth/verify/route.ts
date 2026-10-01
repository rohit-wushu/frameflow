import { db } from "@frameflow/db";
import type { NextRequest } from "next/server";
import { consumeToken } from "@/lib/email-tokens";
import { site } from "@/lib/site";

// The link in the confirmation email. Works signed in or out (often opened on another device).
export async function GET(req: NextRequest) {
  const userId = await consumeToken(req.nextUrl.searchParams.get("token") ?? "", "verify");
  if (userId) await db().user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
  return Response.redirect(`${site.url}/email-confirmed?ok=${userId ? 1 : 0}`, 303);
}
