import { Search } from "lucide-react";
import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { apiFetch } from "../lib/api";

type TraceResult = {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  href: string;
  path: string[];
  details: {
    cableLabel: string | null;
    portLabel: string | null;
    patchPanel: string | null;
    vlan: string | null;
  };
};

export function CableTracePage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TraceResult[]>([]);
  const [searched, setSearched] = useState(false);

  async function search(event: FormEvent) {
    event.preventDefault();
    const nextResults = await apiFetch<TraceResult[]>(`/api/cable-trace?query=${encodeURIComponent(query)}`);
    setResults(nextResults);
    setSearched(true);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-black">Cable Trace Search</h1>
        <p className="muted-copy text-sm">Search by IP, MAC, switch, port, cable label, patch panel, VLAN, or connected device.</p>
      </div>

      <Card>
        <form className="flex flex-col gap-2 sm:flex-row" onSubmit={search}>
          <Input required placeholder="Example: 10.10.1.10, AA:BB, PP-A-01, VLAN-10, SW-RackA" value={query} onChange={(event) => setQuery(event.target.value)} />
          <Button><Search size={16} /> Trace</Button>
        </form>
      </Card>

      <div className="space-y-3">
        {results.map((result) => (
          <Card key={result.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs font-bold uppercase text-cyan-300">{result.type}</div>
                <h2 className="text-lg font-black">{result.title}</h2>
                <p className="muted-copy text-sm">{result.subtitle}</p>
              </div>
              <Link className="rounded-lg border border-cyan-300/30 px-3 py-2 text-sm font-semibold text-cyan-200" to={result.href}>Open</Link>
            </div>
            <div className="mt-4 rounded-xl bg-slate-950/40 p-3 text-sm">
              {result.path.map((part, index) => (
                <span key={`${part}-${index}`}>
                  <span className={part === "-" ? "text-slate-500" : ""}>{part}</span>
                  {index < result.path.length - 1 && <span className="px-2 text-cyan-300">-&gt;</span>}
                </span>
              ))}
            </div>
            <div className="mt-3 grid gap-2 text-xs text-slate-400 sm:grid-cols-4">
              <div>Cable: {result.details.cableLabel ?? "-"}</div>
              <div>Port: {result.details.portLabel ?? "-"}</div>
              <div>Patch: {result.details.patchPanel ?? "-"}</div>
              <div>VLAN: {result.details.vlan ?? "-"}</div>
            </div>
          </Card>
        ))}
        {searched && results.length === 0 && <Card><p className="muted-copy text-sm">No trace found for this search.</p></Card>}
      </div>
    </div>
  );
}
