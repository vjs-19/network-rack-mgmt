import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { ChangeEvent, useState } from "react";

import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { getToken } from "../lib/api";

const templateTypes = [
  {
    id: "locations",
    title: "Locations",
    description: "Building, block, floor, and hub room master data.",
    columns: ["buildingName", "blockName", "floorName", "floorLevel", "hubRoomName", "hubRoomType", "hubRoomNotes"]
  },
  {
    id: "racks",
    title: "Racks",
    description: "Rack names, room assignment, U size, and room position.",
    columns: ["buildingName", "blockName", "floorName", "hubRoomName", "rackName", "unitCount", "positionX", "positionY", "notes"]
  },
  {
    id: "devices",
    title: "Devices / Switches",
    description: "Switch/device details and rack U position.",
    columns: ["hubRoomName", "rackName", "deviceName", "deviceType", "brand", "model", "ipAddress", "macAddress", "serialNumber", "startUnit"]
  },
  {
    id: "ports",
    title: "Switch Ports",
    description: "Port connection details for each switch.",
    columns: ["switchName", "portNumber", "status", "connectedDeviceName", "macAddress", "cableLabel", "patchPanel", "vlan", "speed", "duplex"]
  }
];

function authHeaders() {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export function ImportExportPage() {
  const [message, setMessage] = useState("");

  async function download(path: string, fileName: string) {
    const response = await fetch(path, { headers: authHeaders() });
    if (!response.ok) {
      const error = await response.json().catch(() => null);
      setMessage(error?.message ?? "Download failed. Please login again.");
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function upload(type: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const body = new FormData();
    body.append("file", file);

    const response = await fetch(`/api/import-export/import/${type}`, {
      method: "POST",
      headers: authHeaders(),
      body
    });
    const result = await response.json();
    setMessage(`${templateTypes.find((item) => item.id === type)?.title}: imported ${result.imported} row(s). ${result.errors?.length ? `${result.errors.length} error(s).` : "No errors."}`);
  }

  return (
    <div className="space-y-5">
      <section className="dashboard-hero rounded-2xl p-5">
        <div className="relative z-10">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-200">
            <FileSpreadsheet size={14} /> Excel Bulk Data
          </div>
          <h1 className="text-3xl font-black">Import / Export Master Data</h1>
          <p className="muted-copy mt-2 max-w-3xl text-sm leading-6">
            Download the templates, fill the required columns in Excel, then upload the file back here. Import order should be Locations, Racks, Devices, then Ports.
          </p>
        </div>
      </section>

      {message && <div className="glass-soft rounded-xl p-3 text-sm">{message}</div>}

      <div className="grid gap-4 lg:grid-cols-2">
        {templateTypes.map((item) => (
          <Card key={item.id}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-black">{item.title}</h2>
                <p className="muted-copy text-sm">{item.description}</p>
              </div>
              <FileSpreadsheet className="text-cyan-300" />
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              {item.columns.map((column) => (
                <span key={column} className="rounded-full bg-white/10 px-2 py-1 text-xs">{column}</span>
              ))}
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <Button type="button" variant="secondary" onClick={() => download(`/api/import-export/templates/${item.id}`, `${item.id}-template.xlsx`)}>
                <Download size={16} /> Template
              </Button>
              <Button type="button" variant="secondary" onClick={() => download(`/api/import-export/export/${item.id}`, `${item.id}-export.xlsx`)}>
                <Download size={16} /> Export
              </Button>
              <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400">
                <Upload size={16} /> Import
                <input className="hidden" type="file" accept=".xlsx,.xls" onChange={(event) => upload(item.id, event)} />
              </label>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
