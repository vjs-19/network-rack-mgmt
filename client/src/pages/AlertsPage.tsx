import { Bell, CheckCircle2, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { apiFetch } from "../lib/api";

type Alert = {
  id: string;
  title: string;
  severity: string;
  status: string;
  message: string;
  entity: string | null;
  createdAt: string;
};

export function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [form, setForm] = useState({ title: "", severity: "info", message: "" });

  async function loadAlerts() {
    setAlerts(await apiFetch<Alert[]>("/api/alerts"));
  }

  useEffect(() => {
    loadAlerts();
  }, []);

  async function createAlert(event: FormEvent) {
    event.preventDefault();
    await apiFetch("/api/alerts", { method: "POST", body: JSON.stringify(form) });
    setForm({ title: "", severity: "info", message: "" });
    loadAlerts();
  }

  async function setStatus(alert: Alert, status: string) {
    await apiFetch(`/api/alerts/${alert.id}`, { method: "PUT", body: JSON.stringify({ status }) });
    loadAlerts();
  }

  async function deleteAlert(alert: Alert) {
    await apiFetch(`/api/alerts/${alert.id}`, { method: "DELETE" });
    loadAlerts();
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-black">Alerts</h1>
        <p className="muted-copy text-sm">Track manual alerts now; later this can receive SNMP, ping, and live port status alerts.</p>
      </div>

      <Card>
        <h2 className="mb-3 text-xl font-bold">Create Alert</h2>
        <form className="grid gap-3 md:grid-cols-[1fr_160px_1fr_auto]" onSubmit={createAlert}>
          <input className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2" placeholder="Title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
          <select className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2" value={form.severity} onChange={(event) => setForm({ ...form, severity: event.target.value })}>
            <option value="info">info</option>
            <option value="warning">warning</option>
            <option value="critical">critical</option>
          </select>
          <input className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2" placeholder="Message" value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} required />
          <Button type="submit"><Bell size={16} /> Add</Button>
        </form>
      </Card>

      <div className="grid gap-3">
        {alerts.map((alert) => (
          <Card key={alert.id}>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-cyan-300/10 px-2 py-1 text-xs font-bold uppercase text-cyan-200">{alert.severity}</span>
                  <span className="rounded-full bg-white/10 px-2 py-1 text-xs font-bold uppercase">{alert.status}</span>
                </div>
                <h2 className="mt-2 text-lg font-black">{alert.title}</h2>
                <p className="muted-copy text-sm">{alert.message}</p>
                <p className="muted-copy mt-1 text-xs">{new Date(alert.createdAt).toLocaleString()} {alert.entity ? ` / ${alert.entity}` : ""}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setStatus(alert, alert.status === "open" ? "resolved" : "open")}>
                  <CheckCircle2 size={16} /> {alert.status === "open" ? "Resolve" : "Reopen"}
                </Button>
                <Button variant="danger" onClick={() => deleteAlert(alert)}>
                  <Trash2 size={16} />
                </Button>
              </div>
            </div>
          </Card>
        ))}
        {alerts.length === 0 && <Card><p className="muted-copy text-sm">No alerts yet.</p></Card>}
      </div>
    </div>
  );
}
