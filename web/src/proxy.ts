import { NextResponse, type NextRequest } from "next/server";
import { decrypt, SESSION_COOKIE } from "@/lib/session";

// 乐观检查：只读 cookie，不查库。真正的鉴权在 DAL（getCurrentUser / requireAdmin）中完成。
export default async function proxy(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;
  const session = await decrypt(req.cookies.get(SESSION_COOKIE)?.value);
  const isPrivate = pathname.startsWith("/dashboard") || pathname.startsWith("/admin");

  if (isPrivate && !session) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  if (pathname === "/login" && session) {
    // 后端判定令牌失效（停用、改密、过期）时 DAL 会跳到 /login?expired=1：清掉 cookie 留在登录页
    if (searchParams.get("expired") === "1") {
      const res = NextResponse.redirect(new URL("/login", req.nextUrl));
      res.cookies.delete(SESSION_COOKIE);
      return res;
    }
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/login"],
};
