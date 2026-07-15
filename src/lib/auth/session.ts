import { cache } from "react";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export const getServerSession = cache(async () => auth.api.getSession({ headers: await headers() }));

export function getRequestSession(request: Request) {
  return auth.api.getSession({ headers: request.headers });
}
