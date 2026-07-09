import {
  Activity,
  ArrowRight,
  Building2,
  Check,
  Edit3,
  Layers3,
  MapPin,
  Network,
  RadioTower,
  Server,
  ShieldCheck,
  Sparkles,
  Trash2,
  type LucideIcon
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input, Textarea } from "../components/ui/input";
import { apiFetch } from "../lib/api";

type DashboardData = {
  counts: Record<string, number>;
  buildings: Array<{
    id: string;
    name: string;
    blocks: Array<{ floors: Array<{ hubRooms: Array<{ id: string }> }> }>;
  }>;
  blocks: Array<{
    id: string;
    name: string;
    floors: Array<{ id: string; name: string; level: number; hubRooms: Array<{ id: string; name: string; type: string; notes: string | null }> }>;
  }>;
};

const connectedPorts = 45;

function floorNameFromLevel(level: number) {
  if (level === 0) return "Ground Floor";
  if (level === 1) return "First Floor";
  if (level === 2) return "Second Floor";
  if (level === 3) return "Third Floor";
  return `Floor ${Number.isFinite(level) ? level : 0}`;
}

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [editRoom, setEditRoom] = useState({ name: "", type: "Hub Room", notes: "" });
  const [editingBuildingId, setEditingBuildingId] = useState<string | null>(null);
  const [editBuildingName, setEditBuildingName] = useState("");
  const [newLocation, setNewLocation] = useState({
    buildingName: "Main Building",
    blockName: "Block 1",
    floorName: "First Floor",
    floorLevel: 1,
    hubRoomName: "",
    hubRoomType: "Hub Room",
    hubRoomNotes: ""
  });
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");

  async function loadDashboard() {
    setLoadError("");
    try {
      const dashboard = await apiFetch<DashboardData>("/api/dashboard");
      setData(dashboard);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Dashboard loading failed");
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  async function createLocation(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    await apiFetch("/api/locations", {
      method: "POST",
      body: JSON.stringify({
        ...newLocation,
        floorName: floorNameFromLevel(newLocation.floorLevel)
      })
    });
    setNewLocation((current) => ({ ...current, hubRoomName: "", hubRoomNotes: "" }));
    setMessage("Hub room created successfully.");
    loadDashboard();
  }

  async function saveRoom(roomId: string) {
    await apiFetch(`/api/hub-rooms/${roomId}`, {
      method: "PUT",
      body: JSON.stringify(editRoom)
    });
    setEditingRoomId(null);
    setMessage("Hub room updated.");
    loadDashboard();
  }

  async function deleteRoom(roomId: string) {
    const confirmed = window.confirm("Delete this hub room and its racks/devices?");
    if (!confirmed) return;
    await apiFetch(`/api/hub-rooms/${roomId}`, { method: "DELETE" });
    setMessage("Hub room deleted.");
    loadDashboard();
  }

  async function saveBuilding(buildingId: string) {
    await apiFetch(`/api/buildings/${buildingId}`, {
      method: "PUT",
      body: JSON.stringify({ name: editBuildingName })
    });
    setEditingBuildingId(null);
    setMessage("Building updated.");
    loadDashboard();
  }

  async function deleteBuilding(buildingId: string, buildingName: string) {
    const confirmed = window.confirm(`Delete ${buildingName}? This removes all blocks, floors, hub rooms, racks, devices, and ports inside it.`);
    if (!confirmed) return;
    await apiFetch(`/api/buildings/${buildingId}`, { method: "DELETE" });
    setMessage(`${buildingName} deleted.`);
    loadDashboard();
  }

  const summary = useMemo(() => {
    if (!data) return null;
    const rooms = data.blocks.reduce((sum, block) => sum + block.floors.reduce((floorSum, floor) => floorSum + floor.hubRooms.length, 0), 0);
    const portUsePercent = Math.round((connectedPorts / Math.max(data.counts.ports, 1)) * 100);
    return { rooms, portUsePercent, emptyPorts: Math.max(data.counts.ports - connectedPorts, 0) };
  }, [data]);

  if (loadError) {
    return (
      <div className="grid min-h-[420px] place-items-center">
        <div className="glass-card max-w-md rounded-xl px-5 py-4 text-center">
          <h1 className="mb-2 text-xl font-bold">Dashboard could not open</h1>
          <p className="mb-4 text-sm text-slate-400">{loadError}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={loadDashboard}>Retry</Button>
            <Link to="/login" className="inline-flex items-center justify-center rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold">
              Login Again
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!data || !summary) {
    return (
      <div className="grid min-h-[420px] place-items-center">
        <div className="glass-card rounded-xl px-5 py-4">Loading network dashboard...</div>
      </div>
    );
  }

  const metrics: Array<[string, number, LucideIcon, string]> = [
    ["Buildings", data.counts.buildings, Building2, "Sites"],
    ["Blocks", data.counts.blocks, MapPin, "Campus zones"],
    ["Hub Rooms", data.counts.hubRooms, Layers3, "Rooms"],
    ["Racks", data.counts.racks, Server, "Cabinets"],
    ["Switch Ports", data.counts.ports, Network, "Interfaces"]
  ];

  return (
    <div className="space-y-6">
      <section className="dashboard-hero rounded-2xl">
        <div className="relative z-10 grid gap-5 p-5 lg:grid-cols-[1fr_380px] lg:p-6">
          <div>
            <div className="mb-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-200">
                <Sparkles size={14} /> Latest UI
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                <ShieldCheck size={14} /> Phase 1 Ready
              </span>
            </div>
            <h1 className="max-w-4xl text-3xl font-black tracking-tight md:text-5xl">
              Visual Network Rack Operations
            </h1>
            <p className="muted-copy mt-3 max-w-3xl text-sm leading-6 md:text-base">
              A modern command center for hub rooms, rack layouts, switch front panels, and live-editable port documentation.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                ["Navigate", "Block -> Floor -> Hub Room"],
                ["Inspect", "Rack -> Switch -> Ports"],
                ["Update", "Edit from desktop or mobile"]
              ].map(([label, value]) => (
                <div key={label} className="glass-soft rounded-xl p-4">
                  <div className="muted-copy text-xs uppercase tracking-wide">{label}</div>
                  <div className="mt-1 font-bold">{value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-strong rounded-2xl p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="muted-copy text-sm">Port Utilization</div>
                <div className="text-4xl font-black">{summary.portUsePercent}%</div>
              </div>
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-cyan-300/15 text-cyan-200">
                <Activity />
              </div>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-500/20">
              <div className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-blue-400 to-violet-400" style={{ width: `${summary.portUsePercent}%` }} />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-4">
                <div className="text-2xl font-black text-emerald-200">{connectedPorts}</div>
                <div className="muted-copy text-xs">Connected Ports</div>
              </div>
              <div className="rounded-xl border border-slate-300/20 bg-slate-400/10 p-4">
                <div className="text-2xl font-black">{summary.emptyPorts}</div>
                <div className="muted-copy text-xs">Available Ports</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {metrics.map(([label, value, Icon, caption]) => (
          <div key={label} className="metric-tile rounded-2xl p-4 transition hover:-translate-y-1 hover:border-cyan-300/40">
            <div className="relative z-10">
              <div className="mb-4 flex items-center justify-between">
                <Icon className="text-cyan-300" />
                <span className="rounded-full bg-white/10 px-2 py-1 text-xs">{caption}</span>
              </div>
              <div className="text-3xl font-black">{value}</div>
              <div className="muted-copy text-sm">{label}</div>
            </div>
          </div>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_390px]">
        <div>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black">Infrastructure Map</h2>
              <p className="muted-copy text-sm">{summary.rooms} hub room{summary.rooms === 1 ? "" : "s"} available in this prototype.</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {data.blocks.map((block) => (
              <Card key={block.id} className="transition hover:-translate-y-1 hover:border-cyan-300/50">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-black">{block.name}</h3>
                    <p className="muted-copy text-xs">{block.floors.filter((floor) => floor.hubRooms.length > 0).length} floor{block.floors.filter((floor) => floor.hubRooms.length > 0).length === 1 ? "" : "s"}</p>
                  </div>
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-cyan-300/12 text-cyan-300">
                    <Building2 />
                  </div>
                </div>

                <div className="space-y-4">
                  {block.floors.filter((floor) => floor.hubRooms.length > 0).map((floor) => (
                    <div key={floor.id}>
                      <div className="muted-copy mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide">
                        <RadioTower size={14} /> {floorNameFromLevel(floor.level)}
                      </div>
                      <div className="space-y-2">
                        {floor.hubRooms.map((room) => (
                          <div key={room.id} className="room-link rounded-xl p-3 transition">
                            {editingRoomId === room.id ? (
                              <div className="space-y-2">
                                <Input value={editRoom.name} onChange={(event) => setEditRoom((current) => ({ ...current, name: event.target.value }))} />
                                <Input value={editRoom.type} onChange={(event) => setEditRoom((current) => ({ ...current, type: event.target.value }))} />
                                <Textarea value={editRoom.notes} onChange={(event) => setEditRoom((current) => ({ ...current, notes: event.target.value }))} />
                                <div className="flex gap-2">
                                  <Button type="button" onClick={() => saveRoom(room.id)}><Check size={16} /> Save</Button>
                                  <Button type="button" variant="secondary" onClick={() => setEditingRoomId(null)}>Cancel</Button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between gap-3">
                                <Link to={`/hub-rooms/${room.id}`} className="group flex min-w-0 flex-1 items-center justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="truncate font-bold">{room.name}</div>
                                    <div className="muted-copy text-xs">{room.type} · Open graphical layout</div>
                                  </div>
                                  <ArrowRight className="muted-copy shrink-0 transition group-hover:translate-x-1 group-hover:text-cyan-300" size={18} />
                                </Link>
                                <div className="flex shrink-0 gap-1">
                                  <button
                                    className="rounded-lg p-2 text-cyan-300 hover:bg-cyan-300/10"
                                    onClick={() => {
                                      setEditingRoomId(room.id);
                                      setEditRoom({ name: room.name, type: room.type, notes: room.notes ?? "" });
                                    }}
                                    title="Edit hub room"
                                  >
                                    <Edit3 size={16} />
                                  </button>
                                  <button className="rounded-lg p-2 text-rose-300 hover:bg-rose-300/10" onClick={() => deleteRoom(room.id)} title="Delete hub room">
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </div>

        <aside className="space-y-4">
          <Card>
            <h2 className="mb-4 text-lg font-black">Building Management</h2>
            <div className="space-y-2">
              {data.buildings.map((building) => {
                const roomCount = building.blocks.reduce((sum, block) => sum + block.floors.reduce((floorSum, floor) => floorSum + floor.hubRooms.length, 0), 0);
                return (
                  <div key={building.id} className="rounded-xl bg-white/10 p-3">
                    {editingBuildingId === building.id ? (
                      <div className="space-y-2">
                        <Input value={editBuildingName} onChange={(event) => setEditBuildingName(event.target.value)} />
                        <div className="flex gap-2">
                          <Button type="button" onClick={() => saveBuilding(building.id)}><Check size={16} /> Save</Button>
                          <Button type="button" variant="secondary" onClick={() => setEditingBuildingId(null)}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-bold">{building.name}</div>
                          <div className="muted-copy text-xs">{building.blocks.length} block{building.blocks.length === 1 ? "" : "s"} / {roomCount} hub room{roomCount === 1 ? "" : "s"}</div>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <button
                            className="rounded-lg p-2 text-cyan-300 hover:bg-cyan-300/10"
                            title="Rename building"
                            onClick={() => {
                              setEditingBuildingId(building.id);
                              setEditBuildingName(building.name);
                            }}
                          >
                            <Edit3 size={16} />
                          </button>
                          <button
                            className="rounded-lg p-2 text-rose-300 hover:bg-rose-300/10"
                            title="Delete building"
                            onClick={() => deleteBuilding(building.id, building.name)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          <Card>
            <h2 className="mb-4 text-lg font-black">Create Hub Room</h2>
            {message && <div className="mb-3 rounded-lg bg-emerald-300/10 p-2 text-sm text-emerald-200">{message}</div>}
            <form className="space-y-2" onSubmit={createLocation}>
              <Input placeholder="Building Name" value={newLocation.buildingName} onChange={(event) => setNewLocation((current) => ({ ...current, buildingName: event.target.value }))} />
              <Input placeholder="Block Name" value={newLocation.blockName} onChange={(event) => setNewLocation((current) => ({ ...current, blockName: event.target.value }))} />
              <Input type="number" placeholder="Floor Level" value={newLocation.floorLevel} onChange={(event) => setNewLocation((current) => ({ ...current, floorLevel: Number(event.target.value) }))} />
              <Input required placeholder="Hub Room Name" value={newLocation.hubRoomName} onChange={(event) => setNewLocation((current) => ({ ...current, hubRoomName: event.target.value }))} />
              <Input placeholder="Hub Room Type" value={newLocation.hubRoomType} onChange={(event) => setNewLocation((current) => ({ ...current, hubRoomType: event.target.value }))} />
              <Textarea placeholder="Notes" value={newLocation.hubRoomNotes} onChange={(event) => setNewLocation((current) => ({ ...current, hubRoomNotes: event.target.value }))} />
              <Button className="w-full">Add Hub Room</Button>
            </form>
          </Card>

          <Card>
            <h2 className="mb-2 text-lg font-black">Mobile QR Access</h2>
            <p className="muted-copy text-sm leading-6">
              Hub room and rack QR links are designed to open directly in mobile browsers on the same network, so technicians can update rack and port data while standing in front of the hardware.
            </p>
          </Card>
        </aside>
      </section>
    </div>
  );
}
