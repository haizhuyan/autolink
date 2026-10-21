"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { authenticate, type AuthResult } from "@/lib/auth";
import { LoginFormSchema, type LoginState } from "@/lib/definitions";
import { createSession, deleteSession } from "@/lib/session";

export async function login(_state: LoginState, formData: FormData): Promise<LoginState> {
  const rawEmail = String(formData.get("email") ?? "");
  const parsed = LoginFormSchema.safeParse({
    email: rawEmail,
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors, email: rawEmail };
  }

  let result: AuthResult;
  try {
    result = await authenticate(parsed.data.email, parsed.data.password);
  } catch (err) {
    console.error("login failed", err);
    return { message: "登录服务暂时不可用，请稍后再试", email: rawEmail };
  }
  if ("error" in result) {
    return {
      message: result.error === "locked" ? "登录失败次数过多，请 15 分钟后再试" : "邮箱或密码不正确",
      email: rawEmail,
    };
  }

  await createSession(result.user);
  redirect("/dashboard");
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
