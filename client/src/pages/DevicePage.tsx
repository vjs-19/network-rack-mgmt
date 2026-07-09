import { Save, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input, Textarea } from "../components/ui/input";
import { apiFetch } from "../lib/api";
import type { Device, SwitchPort } from "../types";

function fieldValue(value: string | null) {
  return value && value.length > 0 ? value : "-";
}

function statusColor(status: string) {
  if (status === "CONNECTED") return "border-emerald-300 bg-emerald-400/25";
  if (status === "DISCONNECTED") return "border-slate-500 bg-slate-700/70";
  if (status === "DISABLED") return "border-rose-300 bg-rose-400/25";
  return "border-amber-300 bg-amber-400/20";
}

export function DevicePage() {
  const { id } = useParams();
  const [device, setDevice] = useState<Device | null>(null);
  const [selectedPort, setSelectedPort] = useState<SwitchPort | null>(null);
  const [editingDevice, setEditingDevice] = useState(false);
  const [message, setMessage] = useState("");

  async function loadDevice() {
    const nextDevice = await apiFetch<Device>(`/api/devices/${id}`);
    setDevice(nextDevice);
    setSelectedPort((current) => nextDevice.ports.find((port) => port.id === current?.id) ?? nextDevice.ports[0] ?? null);
  }

  useEffect(() => {
    loadDevice();
  }, [id]);

  async function saveDevice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await apiFetch<Device>(`/api/devices/${device?.id}`, {
      method: "PUT",
      body: JSON.stringify(Object.fromEntries(form.entries()))
    });
    setEditingDevice(false);
    setMessage("Device details updated.");
    loadDevice();
  }

  async function savePort(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPort) return;
    const form = new FormData(event.currentTarget);
    await apiFetch<SwitchPort>(`/api/ports/${selectedPort.id}`, {
      method: "PUT",
      body: JSON.stringify(Object.fromEntries(form.entries()))
    });
    setMessage(`Port ${selectedPort.portNumber} updated.`);
    loadDevice();
  }

  async function removeConnection() {
    if (!selectedPort) return;
    await apiFetch<SwitchPort>(`/api/ports/${selectedPort.id}/connection`, { method: "DELETE" });
    setMessage(`Port ${selectedPort.portNumber} connection removed.`);
    loadDevice();
  }

  if (!device) return <div>Loading switch...</div>;
  const isPowerSupply = device.deviceType.toLowerCase().includes("power");

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_390px]">
      <section className="space-y-4">
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">{device.name}</h1>
              <p className="text-sm text-slate-400">{device.brand ?? "-"} / {device.model ?? "-"}</p>
            </div>
            <Button variant="secondary" onClick={() => setEditingDevice((value) => !value)}>{editingDevice ? "Cancel" : "Edit"}</Button>
          </div>

          {editingDevice ? (
            <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={saveDevice}>
              {["name", "brand", "model", "ipAddress", "macAddress", "firmwareVersion", "softwareVersion", "serialNumber", "location"].map((field) => (
                <label key={field} className="text-sm">
                  {field}
                  <Input name={field} defaultValue={(device as unknown as Record<string, string | null>)[field] ?? ""} />
                </label>
              ))}
              <label className="text-sm md:col-span-2">
                notes
                <Textarea name="notes" defaultValue={device.notes ?? ""} />
              </label>
              <Button className="md:col-span-2"><Save size={16} /> Save Device</Button>
            </form>
          ) : (
            <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
              {[
                ["IP Address", device.ipAddress],
                ["MAC Address", device.macAddress],
                ["Firmware", device.firmwareVersion],
                ["Software", device.softwareVersion],
                ["Serial Number", device.serialNumber],
                ["Installation Date", device.installationDate?.slice(0, 10) ?? null],
                ["Location", device.location],
                ["Notes", device.notes]
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-slate-950/30 p-3">
                  <div className="text-xs text-slate-400">{label}</div>
                  <div>{fieldValue(value)}</div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-xl font-bold">{isPowerSupply ? "Power Supply Sockets" : "Switch Front Panel"}</h2>
          <div className="rounded-xl border border-slate-600 bg-slate-950 p-4">
            <div className="mb-4 grid grid-cols-5 gap-2 sm:grid-cols-10">
              {device.ports.map((port) => (
                <button
                  key={port.id}
                  onClick={() => setSelectedPort(port)}
                  className={`min-h-16 rounded-lg border p-2 text-left text-xs transition hover:-translate-y-1 ${statusColor(port.status)} ${selectedPort?.id === port.id ? "ring-2 ring-cyan-300" : ""}`}
                >
                  <div className="font-bold">{isPowerSupply ? `S${port.portNumber}` : `P${port.portNumber}`}</div>
                  <div className="truncate">{port.connectedDeviceName ?? "-"}</div>
                </button>
              ))}
            </div>
            {!isPowerSupply && (
              <div className="grid grid-cols-4 gap-2">
                {["SFP1", "SFP2", "SFP3", "SFP4"].map((label) => (
                  <div key={label} className="rounded-lg border border-violet-300/50 bg-violet-400/20 p-2 text-center text-xs">{label}</div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </section>

      <aside className="space-y-4">
        {message && <div className="glass-soft rounded-xl p-3 text-sm text-emerald-200">{message}</div>}
        {selectedPort && (
          <Card>
            <h2 className="mb-3 text-xl font-bold">{isPowerSupply ? "Socket" : "Port"} {selectedPort.portNumber}</h2>
            <div className="mb-4 grid grid-cols-2 gap-2 text-sm">
              {[
                ["Status", selectedPort.status],
                [isPowerSupply ? "Powered Device" : "Connected Device", selectedPort.connectedDeviceName],
                ["MAC", selectedPort.macAddress],
                ["Cable", selectedPort.cableLabel],
                ["Patch Panel", selectedPort.patchPanel],
                ["VLAN", selectedPort.vlan],
                ["Speed", selectedPort.speed],
                ["Duplex", selectedPort.duplex]
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-slate-950/30 p-2">
                  <div className="text-xs text-slate-400">{label}</div>
                  <div>{fieldValue(value)}</div>
                </div>
              ))}
            </div>
            <form className="space-y-2" onSubmit={savePort}>
              <select name="status" defaultValue={selectedPort.status} className="w-full rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2 text-sm">
                <option value="CONNECTED">Connected</option>
                <option value="DISCONNECTED">Disconnected</option>
                <option value="DISABLED">Disabled</option>
                <option value="UNKNOWN">Unknown</option>
              </select>
              <Input name="connectedDeviceName" placeholder="Device Name" defaultValue={selectedPort.connectedDeviceName ?? ""} />
              <Input name="macAddress" placeholder="MAC Address" defaultValue={selectedPort.macAddress ?? ""} />
              <Input name="cableLabel" placeholder="Cable Label" defaultValue={selectedPort.cableLabel ?? ""} />
              <Input name="patchPanel" placeholder="Patch Panel" defaultValue={selectedPort.patchPanel ?? ""} />
              <Input name="vlan" placeholder="VLAN" defaultValue={selectedPort.vlan ?? ""} />
              <Input name="speed" placeholder="Speed" defaultValue={selectedPort.speed ?? ""} />
              <Input name="duplex" placeholder="Duplex" defaultValue={selectedPort.duplex ?? ""} />
              <Textarea name="description" placeholder="Description" defaultValue={selectedPort.description ?? ""} />
              <Textarea name="notes" placeholder="Notes" defaultValue={selectedPort.notes ?? ""} />
              <div className="flex gap-2">
                <Button className="flex-1"><Save size={16} /> Save</Button>
                <Button type="button" variant="danger" onClick={removeConnection}><Trash2 size={16} /></Button>
              </div>
            </form>
          </Card>
        )}
      </aside>
    </div>
  );
}
