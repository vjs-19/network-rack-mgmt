import { Edit3, Plus, Trash2, Upload } from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input, Textarea } from "../components/ui/input";
import { apiFetch, getToken } from "../lib/api";
import type { Rack } from "../types";

function unitColor(type: string) {
  if (type === "SWITCH") return "bg-cyan-400/25 border-cyan-300/60";
  if (type === "POWER_SUPPLY") return "bg-amber-400/20 border-amber-300/50";
  if (type === "CABLE_MANAGER") return "bg-fuchsia-400/20 border-fuchsia-300/50";
  return "bg-slate-900/80 border-white/10";
}

export function RackPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [rack, setRack] = useState<Rack | null>(null);
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [showRackEdit, setShowRackEdit] = useState(false);
  const [message, setMessage] = useState("");
  const [rackForm, setRackForm] = useState({
    name: "",
    unitCount: 45,
    positionX: 0,
    positionY: 0,
    notes: ""
  });
  const [deviceForm, setDeviceForm] = useState({
    name: "",
    deviceType: "Network Switch",
    brand: "",
    model: "",
    ipAddress: "",
    macAddress: "",
    serialNumber: "",
    startUnit: 42,
    heightUnits: 1,
    portCount: 10,
    copperPortCount: 48,
    sfpPortCount: 4,
    socketCount: 8,
    notes: ""
  });

  function openModuleForm(deviceType: string, heightUnits: number) {
    if (!rack) return;
    const moduleCount = rack.devices.filter((device) => device.deviceType === deviceType).length + 1;
    const shortName = deviceType.includes("Cable") ? "CM" : "PDU";
    setDeviceForm((current) => ({
      ...current,
      name: `${shortName}-${rack.name.replace(/\s+/g, "")}-${moduleCount}`,
      deviceType,
      brand: "",
      model: `${heightUnits}U`,
      ipAddress: "",
      macAddress: "",
      serialNumber: "",
      heightUnits,
      portCount: deviceType.includes("Switch") ? current.portCount : 0,
      copperPortCount: deviceType.includes("Switch") ? current.copperPortCount : 0,
      sfpPortCount: deviceType.includes("Switch") ? current.sfpPortCount : 0,
      socketCount: deviceType.includes("Power") ? 8 : 0,
      notes: ""
    }));
    setShowAddDevice(true);
  }

  async function loadRack() {
    const nextRack = await apiFetch<Rack>(`/api/racks/${id}`);
    setRack(nextRack);
    setRackForm({
      name: nextRack.name,
      unitCount: nextRack.unitCount,
      positionX: nextRack.positionX,
      positionY: nextRack.positionY,
      notes: nextRack.notes ?? ""
    });
    setDeviceForm((current) => ({
      ...current,
      name: current.name || `SW-${nextRack.name.replace(/\s+/g, "")}-${nextRack.devices.length + 1}`
    }));
  }

  useEffect(() => {
    loadRack();
  }, [id]);

  async function createDevice(event: FormEvent) {
    event.preventDefault();
    if (!rack) return;
    await apiFetch("/api/devices", {
      method: "POST",
      body: JSON.stringify({
        ...deviceForm,
        rackId: rack.id,
        location: rack.name,
        startUnit: Number(deviceForm.startUnit),
        heightUnits: Number(deviceForm.heightUnits),
        portCount: Number(deviceForm.portCount),
        copperPortCount: Number(deviceForm.copperPortCount),
        sfpPortCount: Number(deviceForm.sfpPortCount),
        socketCount: Number(deviceForm.socketCount)
      })
    });
    setMessage(`${deviceForm.name} added to rack view.`);
    setDeviceForm((current) => ({ ...current, name: "", notes: "" }));
    setShowAddDevice(false);
    loadRack();
  }

  async function saveRack(event: FormEvent) {
    event.preventDefault();
    if (!rack) return;

    await apiFetch<Rack>(`/api/racks/${rack.id}`, {
      method: "PUT",
      body: JSON.stringify({
        name: rackForm.name,
        unitCount: Number(rackForm.unitCount),
        positionX: Number(rackForm.positionX),
        positionY: Number(rackForm.positionY),
        notes: rackForm.notes
      })
    });

    setMessage("Rack details updated.");
    setShowRackEdit(false);
    loadRack();
  }

  async function uploadRackDrawing(event: ChangeEvent<HTMLInputElement>) {
    if (!rack) return;
    const file = event.target.files?.[0];
    if (!file) return;

    const body = new FormData();
    body.append("file", file);
    body.append("purpose", "rack-layout");

    const token = getToken();
    const uploadResponse = await fetch("/api/uploads", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body
    });

    if (!uploadResponse.ok) {
      setMessage("Rack drawing upload failed.");
      return;
    }

    const uploaded = (await uploadResponse.json()) as { path: string };
    await apiFetch<Rack>(`/api/racks/${rack.id}`, {
      method: "PUT",
      body: JSON.stringify({ layoutImage: uploaded.path })
    });

    event.target.value = "";
    setMessage("Rack drawing uploaded.");
    loadRack();
  }

  async function deleteRack() {
    if (!rack) return;
    const confirmed = window.confirm(`Delete ${rack.name}? This also removes devices and ports inside it.`);
    if (!confirmed) return;

    await apiFetch(`/api/racks/${rack.id}`, { method: "DELETE" });
    navigate("/");
  }

  async function deleteDevice(deviceId: string, deviceName: string) {
    const confirmed = window.confirm(`Delete ${deviceName} from this rack?`);
    if (!confirmed) return;

    await apiFetch(`/api/devices/${deviceId}`, { method: "DELETE" });
    setMessage(`${deviceName} deleted from rack.`);
    loadRack();
  }

  if (!rack) return <div>Loading rack...</div>;

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold">{rack.name}</h1>
            <p className="text-sm text-slate-400">{rack.unitCount}U rack view</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setShowAddDevice((value) => !value)}><Plus size={16} /> Add Device</Button>
            <Button variant="secondary" onClick={() => openModuleForm("Cable Manager", 1)}>Cable Manager 1U</Button>
            <Button variant="secondary" onClick={() => openModuleForm("Cable Manager", 2)}>Cable Manager 2U</Button>
            <Button variant="secondary" onClick={() => openModuleForm("Power Supply", 1)}>Power Supply 1U</Button>
            <Button variant="secondary" onClick={() => openModuleForm("Power Supply", 2)}>Power Supply 2U</Button>
            <Button variant="secondary" onClick={() => setShowRackEdit((value) => !value)}><Edit3 size={16} /> Rename Rack</Button>
            <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/15">
              <Upload size={16} /> Upload Rack Drawing
              <input type="file" accept="image/*" className="hidden" onChange={uploadRackDrawing} />
            </label>
            <Button variant="danger" onClick={deleteRack}><Trash2 size={16} /> Delete</Button>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Card className="overflow-hidden">
            <div className="rounded-xl border-8 border-slate-700 bg-slate-950 p-3">
              {rack.rackUnits.map((unit) => (
                <Link
                  key={unit.id}
                  to={unit.device ? `/devices/${unit.device.id}` : "#"}
                  className={`rack-unit mb-1 grid min-h-9 grid-cols-[56px_1fr] items-center rounded border px-2 text-sm ${unitColor(unit.type)}`}
                >
                  <span className="font-mono text-slate-400">U{unit.unitNumber}</span>
                  <span className="font-semibold">{unit.label}</span>
                </Link>
              ))}
            </div>
          </Card>
          <Card className="overflow-hidden">
            <div className="mb-3">
              <h2 className="font-semibold">Uploaded Rack Reference</h2>
              <p className="muted-copy text-sm">Actual 45U rack drawing/photo for visual matching.</p>
            </div>
            <div className="rack-photo-frame">
              <img src={rack.layoutImage ?? "/assets/rack-reference.jpg"} alt="45U rack reference" className="rack-photo" />
            </div>
          </Card>
          </div>
      </section>
      <aside className="space-y-3">
        {showRackEdit && (
          <Card>
            <h2 className="mb-3 font-semibold">Edit Rack Details</h2>
            <form className="space-y-2" onSubmit={saveRack}>
              <Input required placeholder="Rack Name" value={rackForm.name} onChange={(event) => setRackForm((current) => ({ ...current, name: event.target.value }))} />
              <Input type="number" min={1} max={60} placeholder="Rack U Count" value={rackForm.unitCount} onChange={(event) => setRackForm((current) => ({ ...current, unitCount: Number(event.target.value) }))} />
              <div className="grid grid-cols-2 gap-2">
                <Input type="number" placeholder="Position X" value={rackForm.positionX} onChange={(event) => setRackForm((current) => ({ ...current, positionX: Number(event.target.value) }))} />
                <Input type="number" placeholder="Position Y" value={rackForm.positionY} onChange={(event) => setRackForm((current) => ({ ...current, positionY: Number(event.target.value) }))} />
              </div>
              <Textarea placeholder="Notes" value={rackForm.notes} onChange={(event) => setRackForm((current) => ({ ...current, notes: event.target.value }))} />
              <Button className="w-full">Save Rack Details</Button>
            </form>
          </Card>
        )}
        {showAddDevice && (
          <Card>
            <h2 className="mb-3 font-semibold">Add Device / Switch</h2>
            <form className="space-y-2" onSubmit={createDevice}>
              <Input required placeholder="Device Name" value={deviceForm.name} onChange={(event) => setDeviceForm((current) => ({ ...current, name: event.target.value }))} />
              <Input placeholder="Device Type" value={deviceForm.deviceType} onChange={(event) => setDeviceForm((current) => ({ ...current, deviceType: event.target.value }))} />
              <Input placeholder="Brand" value={deviceForm.brand} onChange={(event) => setDeviceForm((current) => ({ ...current, brand: event.target.value }))} />
              <Input placeholder="Model" value={deviceForm.model} onChange={(event) => setDeviceForm((current) => ({ ...current, model: event.target.value }))} />
              <Input placeholder="IP Address" value={deviceForm.ipAddress} onChange={(event) => setDeviceForm((current) => ({ ...current, ipAddress: event.target.value }))} />
              <Input placeholder="MAC Address" value={deviceForm.macAddress} onChange={(event) => setDeviceForm((current) => ({ ...current, macAddress: event.target.value }))} />
              <Input placeholder="Serial Number" value={deviceForm.serialNumber} onChange={(event) => setDeviceForm((current) => ({ ...current, serialNumber: event.target.value }))} />
              <p className="text-xs text-slate-400">Selected U is the top U. Example: 2U at U45 uses U45 and U44.</p>
              <div className="grid grid-cols-3 gap-2">
                <Input type="number" title="Start U" value={deviceForm.startUnit} onChange={(event) => setDeviceForm((current) => ({ ...current, startUnit: Number(event.target.value) }))} />
                <Input type="number" title="Height U" value={deviceForm.heightUnits} onChange={(event) => setDeviceForm((current) => ({ ...current, heightUnits: Number(event.target.value) }))} />
                <Input type="number" title="Total Ports" value={deviceForm.portCount} onChange={(event) => setDeviceForm((current) => ({ ...current, portCount: Number(event.target.value) }))} />
              </div>
              {deviceForm.deviceType.toLowerCase().includes("switch") && (
                <div className="grid grid-cols-2 gap-2">
                  <Input type="number" min={0} placeholder="Copper RJ45 Ports" value={deviceForm.copperPortCount} onChange={(event) => setDeviceForm((current) => ({ ...current, copperPortCount: Number(event.target.value), portCount: Number(event.target.value) + current.sfpPortCount }))} />
                  <Input type="number" min={0} placeholder="Fiber SFP Ports" value={deviceForm.sfpPortCount} onChange={(event) => setDeviceForm((current) => ({ ...current, sfpPortCount: Number(event.target.value), portCount: current.copperPortCount + Number(event.target.value) }))} />
                </div>
              )}
              {deviceForm.deviceType.toLowerCase().includes("power") && (
                <Input type="number" placeholder="Power Sockets" value={deviceForm.socketCount} onChange={(event) => setDeviceForm((current) => ({ ...current, socketCount: Number(event.target.value) }))} />
              )}
              <Textarea placeholder="Notes" value={deviceForm.notes} onChange={(event) => setDeviceForm((current) => ({ ...current, notes: event.target.value }))} />
              <Button className="w-full">Save Device</Button>
            </form>
          </Card>
        )}
        {message && <div className="glass-soft rounded-xl p-3 text-sm text-emerald-200">{message}</div>}
        <Card>
          <h2 className="mb-2 font-semibold">Rack Management</h2>
          <p className="text-sm text-slate-400">Add, delete, rename, move position, and upload rack drawings. Phase 1 displays the controls and connects rack data.</p>
        </Card>
        <Card>
          <h2 className="mb-2 font-semibold">Devices</h2>
          <div className="space-y-2">
            {rack.devices.map((device) => (
              <div key={device.id} className="flex items-center gap-2 rounded-lg bg-white/10 p-3 hover:bg-white/15">
                <Link to={`/devices/${device.id}`} className="min-w-0 flex-1">
                  <div className="truncate">{device.name}</div>
                  <div className="text-xs text-slate-400">Top U{device.startUnit} - {device.heightUnits}U - {device.model ?? "-"}</div>
                </Link>
                <Button type="button" variant="danger" onClick={() => deleteDevice(device.id, device.name)} title="Delete this device only">
                  <Trash2 size={16} />
                </Button>
              </div>
            ))}
          </div>
        </Card>
      </aside>
    </div>
  );
}
