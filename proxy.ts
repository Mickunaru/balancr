import { NextResponse } from "next/server";

import { auth } from "@/auth";

// Optimistic auth check only (JWT cookie) — real authorization happens in
// each server component / route handler via auth().
export default auth((request) => {
  const isAuthenticated = !!request.auth;
  const { pathname } = request.nextUrl;

  const isAuthPage = pathname === "/signin" || pathname === "/signup";

  if (!isAuthenticated && !isAuthPage) {
    const signInUrl = new URL("/signin", request.nextUrl);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  if (isAuthenticated && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", request.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/dashboard/:path*", "/signin", "/signup"],
};
