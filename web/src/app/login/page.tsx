import type { Metadata } from "next";
import { CheckCircle } from "@phosphor-icons/react/ssr";
import { Logo } from "@/components/logo";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "登录",
};

const highlights = [
  "500+ 内置收录站点，持续维护",
  "AI 识别表单，自动填写并提交",
  "验证码与邮箱验证一键接管",
  "逐站点留证，外链持续监控",
];

export default function LoginPage() {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <aside className="hidden flex-col justify-between border-r border-line bg-surface p-10 lg:flex">
        <Logo />
        <div>
          <h2 className="font-mono text-3xl font-bold leading-tight tracking-tight">
            一次填写，
            <br />
            提交到 500+ 收录站
          </h2>
          <ul className="mt-8 space-y-4">
            {highlights.map((h) => (
              <li key={h} className="flex items-center gap-3 text-muted">
                <CheckCircle size={20} weight="fill" className="shrink-0 text-accent-text" aria-hidden />
                {h}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-muted">© AutoLink</p>
      </aside>

      <main id="main" className="flex flex-col items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-sm">
          <div className="mb-10 lg:hidden">
            <Logo />
          </div>
          <h1 className="font-mono text-2xl font-bold tracking-tight">登录 AutoLink</h1>
          <p className="mt-2 text-sm text-muted">登录后进入控制台管理你的提交任务。</p>
          <LoginForm />
        </div>
      </main>
    </div>
  );
}
