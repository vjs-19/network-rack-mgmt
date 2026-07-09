import { Radar } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { apiFetch } from "../lib/api";

type DiscoveryRun = {
  id: string;
  type: string;
  status: string;
  summary: string;
  details: string | null;
  createdAt: string;
};

function formatDetails(details: string | null) {
  if (!details) return "-";
  try {
    return JSON.stringify(JSON.parse(details), null, 2);
  } catch {
    return details;
  }
}

export function DiscoveryPage() {
  const [runs, setRuns] = useState<DiscoveryRun[]>([]);
  const [target, setTarget] = useState("");

  async function loadRuns() {
    setRuns(await apiFetch<DiscoveryRun[]>("/api/discovery/runs"));
  }

  useEffect(() => {
    loadRuns();
  }, []);

  async function runDiscovery(event: FormEvent) {
    event.preventDefault();
    await apiFetch("/api/discovery/run", {
      method: "POST",
      body: JSON.stringify({ type: "SNMP_LLDP_DUMMY", target }),
    });
    setTarget("");
    loadRuns();
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-black">Discovery</h1>
        <p className="muted-copy text-sm">SNMP/LLDP placeholder workflow. Real polling can be connected after switch credentials and server network access are available.</p>
      </div>

      <Card>
        <h2 className="mb-3 text-xl font-bold">Run Dummy Discovery</h2>
        <form className="grid gap-3 md:grid-cols-[1fr_auto]" onSubmit={runDiscovery}>
          <input className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2" placeholder="Target switch IP/name, optional" value={target} onChange={(event) => setTarget(event.target.value)} />
          <Button type="submit"><Radar size={16} /> Run</Button>
        </form>
        <p className="muted-copy mt-3 text-xs">This creates sample MAC table, LLDP neighbor, and port status data without contacting real hardware.</p>
      </Card>

      <div className="grid gap-3">
        {runs.map((run) => (
          <Card key={run.id}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-cyan-300/10 px-2 py-1 text-xs font-bold uppercase text-cyan-200">{run.type}</span>
              <span className="rounded-full bg-white/10 px-2 py-1 text-xs font-bold uppercase">{run.status}</span>
              <span className="muted-copy text-xs">{new Date(run.createdAt).toLocaleString()}</span>
            </div>
            <h2 className="mt-2 text-lg font-black">{run.summary}</h2>
            <pre className="mt-3 max-h-80 overflow-auto rounded-lg bg-slate-950/70 p-3 text-xs text-slate-300">{formatDetails(run.details)}</pre>
          </Card>
        ))}
        {runs.length === 0 && <Card><p className="muted-copy text-sm">No discovery runs yet.</p></Card>}
      </div>
    </div>
  );
}
