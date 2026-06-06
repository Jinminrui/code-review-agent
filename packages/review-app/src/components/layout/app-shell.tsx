import type { PropsWithChildren } from "react";
import { NavLink } from "react-router-dom";

export function AppShell({ children }: PropsWithChildren) {
  const navItems = [
    { to: "/", label: "发起 Code Review", end: true },
    { to: "/sessions", label: "Review 历史" },
    { to: "/settings", label: "设置" }
  ];

  return (
    <div className="grid h-full grid-cols-[176px_1fr] bg-[rgb(var(--bg))] text-[rgb(var(--ink))]">
      <aside className="border-r border-[rgb(var(--border))] bg-[linear-gradient(180deg,rgba(236,241,247,0.92),rgba(227,233,241,0.94))] px-4 py-5">
        <div className="flex h-full flex-col justify-between">
          <div className="grid gap-8">
            <div className="text-[11px] font-medium uppercase tracking-[0.38em] text-[rgb(var(--muted-strong))]">
              Code Review
            </div>
            <nav className="grid gap-2">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `whitespace-nowrap rounded-[16px] border px-3 py-2 text-[11px] font-medium tracking-[0.01em] no-underline transition ${
                      isActive
                        ? "border-[rgba(89,124,185,0.28)] bg-[rgba(255,255,255,0.92)] text-[rgb(var(--accent-ink))] shadow-[0_10px_24px_rgba(35,47,66,0.08)]"
                        : "border-transparent text-[rgb(var(--muted-strong))] hover:-translate-y-0.5 hover:border-[rgba(174,188,206,0.72)] hover:bg-[rgba(255,255,255,0.68)] hover:text-[rgb(var(--ink))]"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <div className="grid gap-3 text-[11px] leading-5 text-[rgb(var(--muted))]">
              <span>本地仓库</span>
              <span>结构化结果</span>
              <span>差异验证</span>
            </div>
          </div>
          <div className="text-[11px] font-medium tracking-[0.14em] text-[rgb(var(--muted))]">
            Code Review 工作台
          </div>
        </div>
      </aside>
      <main className="min-w-0">{children}</main>
    </div>
  );
}
