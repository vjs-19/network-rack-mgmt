import { Building2, Database, Layers3, Network, Server, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { apiFetch } from "../lib/api";

type MasterData = {
  buildings: Array<{ id: string; name: string; blocks: unknown[] }>;
  blocks: Array<{ id: string; name: string; building: { name: string }; floors: unknown[] }>;
  floors: Array<{ id: string; name: string; level: number; block: { name: string; building: { name: string } }; hubRooms: unknown[] }>;
  hubRooms: Array<{ id: string; name: string; type: string; floor: { name: string; block: { name: string; building: { name: string } } }; racks: unknown[] }>;
  racks: Array<{ id: string; name: string; unitCount: number; hubRoom: { name: string; floor: { block: { name: string; building: { name: string } } } }; devices: unknown[] }>;
  devices: Array<{ id: string; name: string; deviceType: string; ipAddress: string | null; macAddress: string | null; rack: { name: string; hubRoom: { name: string } }; ports: unknown[] }>;
  ports: Array<{ id: string; portLabel: string; portType: string; status: string; connectedDeviceName: string | null; cableLabel: string | null; device: { id: string; name: string; rack: { name: string; hubRoom: { name: string } } } }>;
};

type TabKey = keyof MasterData;

const tabMeta: Array<[TabKey, string, typeof Building2]> = [
  ["buildings", "Buildings", Building2],
  ["blocks", "Blocks", Layers3],
  ["floors", "Floors", Layers3],
  ["hubRooms", "Hub Rooms", Network],
  ["racks", "Racks", Server],
  ["devices", "Devices", Database],
  ["ports", "Ports", Network],
];

export function MasterDataPage() {
  const [data, setData] = useState<MasterData | null>(null);
  const [active, setActive] = useState<TabKey>("buildings");
  const [message, setMessage] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [devicePatch, setDevicePatch] = useState({ deviceType: "", location: "", notes: "" });
  const [portPatch, setPortPatch] = useState({ status: "", vlan: "", patchPanel: "", notes: "" });

  async function loadData() {
    setData(await apiFetch<MasterData>("/api/master-data"));
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    setSelectedIds([]);
  }, [active]);

  const rows = useMemo(() => (data ? data[active] : []), [active, data]);

  async function deleteRecord(kind: "buildings" | "hubRooms" | "racks" | "devices", id: string, name: string) {
    const endpoint = {
      buildings: "buildings",
      hubRooms: "hub-rooms",
      racks: "racks",
      devices: "devices",
    }[kind];
    const confirmed = window.confirm(`Delete ${name}? This may remove child records under it.`);
    if (!confirmed) return;
    await apiFetch(`/api/${endpoint}/${id}`, { method: "DELETE" });
    setMessage(`${name} deleted.`);
    loadData();
  }

  function toggleSelection(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  async function applyBulkEdit() {
    const endpoint = active === "devices" ? "/api/bulk/devices" : active === "ports" ? "/api/bulk/ports" : "";
    if (!endpoint || selectedIds.length === 0) return;

    const sourcePatch = active === "devices" ? devicePatch : portPatch;
    const patch = Object.fromEntries(Object.entries(sourcePatch).filter(([, value]) => value !== ""));
    if (Object.keys(patch).length === 0) {
      setMessage("Enter at least one bulk edit value.");
      return;
    }

    await apiFetch(endpoint, {
      method: "PUT",
      body: JSON.stringify({ ids: selectedIds, patch }),
    });
    setMessage(`Updated ${selectedIds.length} ${active}.`);
    setSelectedIds([]);
    loadData();
  }

  if (!data) return <div>Loading master data...</div>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-black">Master Data</h1>
        <p className="muted-copy text-sm">One place to inspect and clean up infrastructure records.</p>
      </div>

      {message && <div className="glass-soft rounded-xl p-3 text-sm text-emerald-200">{message}</div>}

      <div className="flex flex-wrap gap-2">
        {tabMeta.map(([key, label, Icon]) => (
          <Button key={key} variant={active === key ? "primary" : "secondary"} onClick={() => setActive(key)}>
            <Icon size={16} /> {label} ({data[key].length})
          </Button>
        ))}
      </div>

      {(active === "devices" || active === "ports") && (
        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold">Bulk Edit {active === "devices" ? "Devices" : "Ports"}</h2>
            <span className="muted-copy text-sm">{selectedIds.length} selected</span>
          </div>
          {active === "devices" ? (
            <div className="grid gap-2 md:grid-cols-4">
              <input className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2" placeholder="Device type" value={devicePatch.deviceType} onChange={(event) => setDevicePatch({ ...devicePatch, deviceType: event.target.value })} />
              <input className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2" placeholder="Location" value={devicePatch.location} onChange={(event) => setDevicePatch({ ...devicePatch, location: event.target.value })} />
              <input className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2" placeholder="Notes" value={devicePatch.notes} onChange={(event) => setDevicePatch({ ...devicePatch, notes: event.target.value })} />
              <Button type="button" onClick={applyBulkEdit}>Apply To Selected</Button>
            </div>
          ) : (
            <div className="grid gap-2 md:grid-cols-5">
              <select className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2" value={portPatch.status} onChange={(event) => setPortPatch({ ...portPatch, status: event.target.value })}>
                <option value="">Status</option>
                <option value="CONNECTED">CONNECTED</option>
                <option value="DISCONNECTED">DISCONNECTED</option>
                <option value="DISABLED">DISABLED</option>
                <option value="UNKNOWN">UNKNOWN</option>
              </select>
              <input className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2" placeholder="VLAN" value={portPatch.vlan} onChange={(event) => setPortPatch({ ...portPatch, vlan: event.target.value })} />
              <input className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2" placeholder="Patch panel" value={portPatch.patchPanel} onChange={(event) => setPortPatch({ ...portPatch, patchPanel: event.target.value })} />
              <input className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2" placeholder="Notes" value={portPatch.notes} onChange={(event) => setPortPatch({ ...portPatch, notes: event.target.value })} />
              <Button type="button" onClick={applyBulkEdit}>Apply To Selected</Button>
            </div>
          )}
        </Card>
      )}

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs uppercase text-slate-400">
              <tr>
                {(active === "devices" || active === "ports") && <th className="p-2">Select</th>}
                <th className="p-2">Name</th>
                <th className="p-2">Location / Parent</th>
                <th className="p-2">Details</th>
                <th className="p-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row: any) => (
                <tr key={row.id} className="border-t border-white/10">
                  {(active === "devices" || active === "ports") && (
                    <td className="p-2">
                      <input type="checkbox" checked={selectedIds.includes(row.id)} onChange={() => toggleSelection(row.id)} />
                    </td>
                  )}
                  <td className="p-2 font-semibold">{row.name ?? row.portLabel}</td>
                  <td className="p-2 text-slate-300">
                    {active === "buildings" && `${row.blocks.length} blocks`}
                    {active === "blocks" && row.building.name}
                    {active === "floors" && `${row.block.building.name} / ${row.block.name}`}
                    {active === "hubRooms" && `${row.floor.block.building.name} / ${row.floor.block.name} / ${row.floor.name}`}
                    {active === "racks" && `${row.hubRoom.floor.block.building.name} / ${row.hubRoom.name}`}
                    {active === "devices" && `${row.rack.hubRoom.name} / ${row.rack.name}`}
                    {active === "ports" && `${row.device.rack.hubRoom.name} / ${row.device.rack.name} / ${row.device.name}`}
                  </td>
                  <td className="p-2 text-slate-400">
                    {active === "buildings" && "Building"}
                    {active === "blocks" && `${row.floors.length} floors`}
                    {active === "floors" && `Level ${row.level} / ${row.hubRooms.length} hub rooms`}
                    {active === "hubRooms" && `${row.type} / ${row.racks.length} racks`}
                    {active === "racks" && `${row.unitCount}U / ${row.devices.length} devices`}
                    {active === "devices" && `${row.deviceType} / ${row.ports.length} ports / ${row.ipAddress ?? "-"}`}
                    {active === "ports" && `${row.portType} / ${row.status} / ${row.connectedDeviceName ?? "-"} / ${row.cableLabel ?? "-"}`}
                  </td>
                  <td className="p-2 text-right">
                    {active === "hubRooms" && <Link className="mr-2 text-cyan-300" to={`/hub-rooms/${row.id}`}>Open</Link>}
                    {active === "racks" && <Link className="mr-2 text-cyan-300" to={`/racks/${row.id}`}>Open</Link>}
                    {active === "devices" && <Link className="mr-2 text-cyan-300" to={`/devices/${row.id}`}>Open</Link>}
                    {(["buildings", "hubRooms", "racks", "devices"] as string[]).includes(active) && (
                      <Button type="button" variant="danger" onClick={() => deleteRecord(active as any, row.id, row.name)}>
                        <Trash2 size={16} />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
