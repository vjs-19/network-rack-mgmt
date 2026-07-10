import { Plus, QrCode, Trash2, Upload } from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input, Textarea } from "../components/ui/input";
import { apiFetch, getToken } from "../lib/api";
import type { HubRoom } from "../types";

export function HubRoomPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [room, setRoom] = useState<HubRoom | null>(null);
  const [message, setMessage] = useState("");
  const [calibration, setCalibration] = useState<Record<string, { positionX: number; positionY: number }>>({});
  const [rackForm, setRackForm] = useState({
    name: "",
    unitCount: 45,
    positionX: 80,
    positionY: 120,
    notes: ""
  });

  async function loadRoom() {
    const nextRoom = await apiFetch<HubRoom>(`/api/hub-rooms/${id}`);
    setRoom(nextRoom);
    setCalibration(Object.fromEntries(nextRoom.racks.map((rack) => [rack.id, { positionX: rack.positionX, positionY: rack.positionY }])));
    setRackForm((current) => ({
      ...current,
      name: current.name || `Rack ${String.fromCharCode(65 + nextRoom.racks.length)}`,
      positionX: 80 + nextRoom.racks.length * 170
    }));
  }

  useEffect(() => {
    loadRoom();
  }, [id]);

  async function createRack(event: FormEvent) {
    event.preventDefault();
    if (!room) return;
    await apiFetch("/api/racks", {
      method: "POST",
      body: JSON.stringify({
        name: rackForm.name,
        hubRoomId: room.id,
        unitCount: Number(rackForm.unitCount),
        positionX: Number(rackForm.positionX),
        positionY: Number(rackForm.positionY),
        notes: rackForm.notes
      })
    });
    setMessage(`${rackForm.name} created in ${room.name}.`);
    setRackForm((current) => ({ ...current, name: "", notes: "" }));
    loadRoom();
  }

  async function deleteRack(rackId: string, rackName: string) {
    const confirmed = window.confirm(`Delete ${rackName}? This removes devices and ports inside that rack.`);
    if (!confirmed) return;

    await apiFetch(`/api/racks/${rackId}`, { method: "DELETE" });
    setMessage(`${rackName} deleted.`);
    loadRoom();
  }

  async function deleteHubRoom() {
    if (!room) return;
    const confirmed = window.confirm(`Delete ${room.name}? This removes all racks, devices, and ports inside this hub room.`);
    if (!confirmed) return;

    await apiFetch(`/api/hub-rooms/${room.id}`, { method: "DELETE" });
    navigate("/");
  }

  async function uploadRoomLayout(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !room) return;
    const body = new FormData();
    body.append("file", file);
    body.append("purpose", "hub-room-layout");
    const token = getToken();
    const uploadResponse = await fetch("/api/uploads", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body,
    });
    const uploaded = await uploadResponse.json();
    await apiFetch(`/api/hub-rooms/${room.id}`, {
      method: "PUT",
      body: JSON.stringify({ layoutImage: uploaded.path }),
    });
    setMessage("Room layout uploaded.");
    loadRoom();
  }

  async function saveRackPositions() {
    if (!room) return;
    await apiFetch(`/api/hub-rooms/${room.id}/rack-positions`, {
      method: "PUT",
      body: JSON.stringify({
        racks: Object.entries(calibration).map(([id, position]) => ({ id, ...position })),
      }),
    });
    setMessage("Rack positions saved.");
    loadRoom();
  }

  if (!room) return <div>Loading hub room...</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{room.name}</h1>
          <p className="text-sm text-slate-400">{room.floor.block.name} / {room.floor.name}</p>
        </div>
        <div className="flex gap-2">
          <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold transition hover:bg-white/15">
            <Upload size={16} /> Upload Room Layout
            <input className="hidden" type="file" accept="image/*" onChange={uploadRoomLayout} />
          </label>
          <Button variant="secondary"><QrCode size={16} /> Hub QR</Button>
          <Button variant="danger" onClick={deleteHubRoom}><Trash2 size={16} /> Delete Hub Room</Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <Card>
          <div
            className="relative min-h-[520px] overflow-hidden rounded-xl border border-white/10 bg-slate-950/40 p-6"
            style={room.layoutImage ? { backgroundImage: `linear-gradient(rgba(2,6,23,.45), rgba(2,6,23,.45)), url(${room.layoutImage})`, backgroundSize: "contain", backgroundRepeat: "no-repeat", backgroundPosition: "center" } : undefined}
          >
            <div className="absolute inset-4 rounded-xl border border-dashed border-cyan-300/30" />
            <div className="relative min-h-[450px]">
              {room.racks.map((rack) => (
                <div
                  key={rack.id}
                  className="group absolute rounded-xl border border-cyan-300/30 bg-cyan-300/10 p-4 text-center transition hover:-translate-y-2 hover:bg-cyan-300/20"
                  style={{ left: `${rack.positionX}px`, top: `${rack.positionY}px` }}
                >
                  <Link to={`/racks/${rack.id}`} className="block">
                    <div className="mx-auto mb-3 h-52 w-28 rounded-lg border-4 border-slate-500 bg-slate-900 shadow-2xl group-hover:border-cyan-300">
                      <div className="h-6 rounded-t bg-slate-700 text-xs leading-6 text-slate-200">{rack.unitCount}U</div>
                      <div className="mx-auto mt-3 h-32 w-20 rounded border border-slate-600 bg-gradient-to-b from-slate-800 to-slate-950" />
                    </div>
                    <div className="font-bold">{rack.name}</div>
                    <div className="text-xs text-slate-400">{rack.devices.length} devices</div>
                  </Link>
                  <Button type="button" variant="danger" className="mt-3 w-full" onClick={() => deleteRack(rack.id, rack.name)}>
                    <Trash2 size={16} /> Delete Rack
                  </Button>
                </div>
              ))}
            </div>
            {room.racks.length === 0 && (
              <div className="relative grid min-h-[440px] place-items-center text-center">
                <div>
                  <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-cyan-300/10 text-cyan-300">
                    <Plus />
                  </div>
                  <h2 className="text-xl font-black">No racks placed yet</h2>
                  <p className="muted-copy mt-1 text-sm">Use the Add Rack form to create the room layout.</p>
                </div>
              </div>
            )}
          </div>
        </Card>

        <aside className="space-y-4">
          <Card>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-black"><Plus size={18} className="text-cyan-300" /> Add Rack</h2>
            {message && <div className="mb-3 rounded-lg bg-emerald-300/10 p-2 text-sm text-emerald-200">{message}</div>}
            <form className="space-y-2" onSubmit={createRack}>
              <Input required placeholder="Rack Name" value={rackForm.name} onChange={(event) => setRackForm((current) => ({ ...current, name: event.target.value }))} />
              <Input type="number" placeholder="Rack U Count" value={rackForm.unitCount} onChange={(event) => setRackForm((current) => ({ ...current, unitCount: Number(event.target.value) }))} />
              <div className="grid grid-cols-2 gap-2">
                <Input type="number" placeholder="Position X" value={rackForm.positionX} onChange={(event) => setRackForm((current) => ({ ...current, positionX: Number(event.target.value) }))} />
                <Input type="number" placeholder="Position Y" value={rackForm.positionY} onChange={(event) => setRackForm((current) => ({ ...current, positionY: Number(event.target.value) }))} />
              </div>
              <Textarea placeholder="Notes" value={rackForm.notes} onChange={(event) => setRackForm((current) => ({ ...current, notes: event.target.value }))} />
              <Button className="w-full">Create Rack Layout Item</Button>
            </form>
          </Card>
          <Card>
            <h2 className="mb-2 font-black">Rack Layout Calibration</h2>
            <p className="muted-copy mb-3 text-sm">Enter each rack X/Y position to match your uploaded room drawing.</p>
            <div className="space-y-2">
              {room.racks.map((rack) => (
                <div key={rack.id} className="grid grid-cols-[1fr_90px_90px] items-center gap-2 rounded-lg bg-white/10 p-2">
                  <div className="truncate text-sm font-semibold">{rack.name}</div>
                  <Input type="number" value={calibration[rack.id]?.positionX ?? rack.positionX} onChange={(event) => setCalibration((current) => ({ ...current, [rack.id]: { positionX: Number(event.target.value), positionY: current[rack.id]?.positionY ?? rack.positionY } }))} />
                  <Input type="number" value={calibration[rack.id]?.positionY ?? rack.positionY} onChange={(event) => setCalibration((current) => ({ ...current, [rack.id]: { positionX: current[rack.id]?.positionX ?? rack.positionX, positionY: Number(event.target.value) } }))} />
                </div>
              ))}
            </div>
            <Button className="mt-3 w-full" type="button" onClick={saveRackPositions}>Save Rack Positions</Button>
          </Card>
          <Card>
            <h2 className="mb-2 font-black">Room Layout Setup</h2>
            <p className="muted-copy text-sm leading-6">Create each physical rack here first. After racks appear in the room layout, open a rack to add or manage devices at U positions.</p>
          </Card>
          <Card>
            <h2 className="mb-2 font-black">Delete Racks</h2>
            <div className="space-y-2">
              {room.racks.map((rack) => (
                <div key={rack.id} className="flex items-center justify-between gap-2 rounded-lg bg-white/10 p-3">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{rack.name}</div>
                    <div className="text-xs text-slate-400">{rack.devices.length} devices</div>
                  </div>
                  <Button type="button" variant="danger" onClick={() => deleteRack(rack.id, rack.name)} title="Delete this rack only">
                    <Trash2 size={16} />
                  </Button>
                </div>
              ))}
              {room.racks.length === 0 && <p className="muted-copy text-sm">No racks to delete.</p>}
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
