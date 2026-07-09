import { Database, FileSpreadsheet, HelpCircle, LayoutDashboard, LogOut, Moon, QrCode, Search, ShieldCheck, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";

import { Button } from "./ui/button";

export function AppLayout() {
  const [dark, setDark] = useState(() => localStorage.getItem("rack-theme") !== "light");
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    document.documentElement.classList.toggle("light", !dark);
    localStorage.setItem("rack-theme", dark ? "dark" : "light");
  }, [dark]);

  const crumbs = location.pathname.split("/").filter(Boolean);

  return (
    <div className="min-h-screen">
      <header className="app-header sticky top-0 z-40">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-3 font-bold">
            <div className="brand-logo-shell">
              <img src="/assets/dp-logo.webp" alt="Data Patterns" className="brand-logo" />
            </div>
            <div className="leading-tight">
              <div>Network Rack Manager</div>
              <div className="muted-copy text-xs font-medium">Data Patterns</div>
            </div>
          </Link>
          <nav className="flex items-center gap-2">
            <Link className="nav-link-soft hidden items-center gap-2 rounded-lg px-3 py-2 text-sm sm:flex" to="/">
              <LayoutDashboard size={16} /> Dashboard
            </Link>
            <Link className="nav-link-soft hidden items-center gap-2 rounded-lg px-3 py-2 text-sm sm:flex" to="/master-data">
              <Database size={16} /> Master
            </Link>
            <Link className="nav-link-soft hidden items-center gap-2 rounded-lg px-3 py-2 text-sm sm:flex" to="/trace">
              <Search size={16} /> Trace
            </Link>
            <Link className="nav-link-soft hidden items-center gap-2 rounded-lg px-3 py-2 text-sm sm:flex" to="/qr-codes">
              <QrCode size={16} /> QR
            </Link>
            <Link className="nav-link-soft hidden items-center gap-2 rounded-lg px-3 py-2 text-sm sm:flex" to="/audit-logs">
              <ShieldCheck size={16} /> Audit
            </Link>
            <Link className="nav-link-soft hidden items-center gap-2 rounded-lg px-3 py-2 text-sm sm:flex" to="/import-export">
              <FileSpreadsheet size={16} /> Import
            </Link>
            <Link className="nav-link-soft hidden items-center gap-2 rounded-lg px-3 py-2 text-sm sm:flex" to="/help">
              <HelpCircle size={16} /> Help
            </Link>
            <Button variant="secondary" onClick={() => setDark((value) => !value)}>{dark ? <Sun size={16} /> : <Moon size={16} />}</Button>
            <Button
              variant="ghost"
              onClick={() => {
                localStorage.removeItem("rack-token");
                navigate("/login");
              }}
            >
              <LogOut size={16} />
            </Button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-5">
        <div className="muted-copy mb-4 text-sm">
          <Link to="/" className="hover:text-cyan-300">Dashboard</Link>
          {crumbs.map((crumb, index) => (
            <span key={`${crumb}-${index}`}> / {crumb.replace("-", " ")}</span>
          ))}
        </div>
        <Outlet />
      </main>
    </div>
  );
}
