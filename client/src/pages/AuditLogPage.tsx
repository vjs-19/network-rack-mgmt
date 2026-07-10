import { Download, Search, ShieldCheck } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { apiFetch, getToken } from "../lib/api";

type AuditLog = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  details: string | null;
  createdAt: string;
};

function formatDetails(details: string | null) {
  if (!details) return "-";
  try {
    const parsed = JSON.parse(details);
    return `${parsed.user ?? "system"} / ${JSON.stringify(parsed.details ?? {})}`;
  } catch {
    return details;
  }
}

export function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filters, setFilters] = useState({ from: "", to: "", action: "", entity: "", user: "" });

  function queryString() {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    return params.toString();
  }

  async function loadLogs(event?: FormEvent) {
    event?.preventDefault();
    const query = queryString();
    setLogs(await apiFetch<AuditLog[]>(`/api/audit-logs${query ? `?${query}` : ""}`));
  }

  async function exportLogs() {
    const token = getToken();
    const query = queryString();
    const response = await fetch(`/api/audit-logs/export${query ? `?${query}` : ""}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "audit-logs-export.xlsx";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    loadLogs();
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-black">Audit Logs</h1>
        <p className="muted-copy text-sm">Filter activity by date, user, action, and entity, then export the report.</p>
      </div>

      <Card>
        <form className="grid gap-3 md:grid-cols-6" onSubmit={loadLogs}>
          <input className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2" type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} />
          <input className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2" type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} />
          <input className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2" placeholder="Action" value={filters.action} onChange={(event) => setFilters({ ...filters, action: event.target.value })} />
          <input className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2" placeholder="Entity" value={filters.entity} onChange={(event) => setFilters({ ...filters, entity: event.target.value })} />
          <input className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2" placeholder="User email" value={filters.user} onChange={(event) => setFilters({ ...filters, user: event.target.value })} />
          <div className="flex gap-2">
            <Button type="submit"><Search size={16} /> Filter</Button>
            <Button type="button" variant="secondary" onClick={exportLogs}><Download size={16} /></Button>
          </div>
        </form>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="text-xs uppercase text-slate-400">
              <tr>
                <th className="p-2">Time</th>
                <th className="p-2">Action</th>
                <th className="p-2">Entity</th>
                <th className="p-2">Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-t border-white/10">
                  <td className="p-2 text-slate-300">{new Date(log.createdAt).toLocaleString()}</td>
                  <td className="p-2">
                    <span className="inline-flex items-center gap-2 rounded-full bg-cyan-300/10 px-2 py-1 text-xs font-bold text-cyan-200">
                      <ShieldCheck size={14} /> {log.action}
                    </span>
                  </td>
                  <td className="p-2 font-semibold">{log.entity}</td>
                  <td className="p-2 text-slate-400">{formatDetails(log.details)}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-slate-400">No audit logs yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
