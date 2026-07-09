import { ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

import { Card } from "../components/ui/card";
import { apiFetch } from "../lib/api";

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

  useEffect(() => {
    apiFetch<AuditLog[]>("/api/audit-logs").then(setLogs);
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-black">Audit Logs</h1>
        <p className="muted-copy text-sm">Recent creates, updates, deletes, and port connection changes.</p>
      </div>

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
