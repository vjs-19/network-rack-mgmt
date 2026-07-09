import { Printer, QrCode, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { apiFetch } from "../lib/api";

type QrItem = {
  id: string;
  type: string;
  label: string;
  location: string;
  href: string;
  qrUrl: string;
};

export function QrCodesPage() {
  const [items, setItems] = useState<QrItem[]>([]);
  const [filter, setFilter] = useState("all");
  const [qrBaseUrl, setQrBaseUrl] = useState("");

  useEffect(() => {
    apiFetch<QrItem[]>("/api/qr-items").then(setItems);
    apiFetch<{ qrBaseUrl: string }>("/api/settings").then((settings) => setQrBaseUrl(settings.qrBaseUrl));
  }, []);

  const filtered = filter === "all" ? items : items.filter((item) => item.type === filter);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-black">QR Codes</h1>
        <p className="muted-copy text-sm">Print or save QR stickers for hub rooms, racks, and devices. Scanning opens the exact page in the mobile browser.</p>
        <p className="muted-copy mt-1 text-xs">Encoded base URL: {qrBaseUrl || "Auto-detected from the current browser host"}</p>
      </div>

      <div className="print:hidden flex flex-wrap gap-2">
        {["all", "hub-room", "rack", "device"].map((type) => (
          <Button key={type} variant={filter === type ? "primary" : "secondary"} onClick={() => setFilter(type)}>
            <QrCode size={16} /> {type}
          </Button>
        ))}
        <Button variant="secondary" onClick={() => window.print()}>
          <Printer size={16} /> Print Sheet
        </Button>
        <Link className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold" to="/admin">
          <Settings size={16} /> QR Settings
        </Link>
      </div>

      <div className="qr-print-grid grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((item) => (
          <Card key={`${item.type}-${item.id}`} className="qr-sticker">
            <div className="flex items-start gap-4">
              <img src={item.qrUrl} alt={`${item.label} QR`} className="h-28 w-28 rounded-lg bg-white p-2" />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold uppercase text-cyan-300">{item.type}</div>
                <h2 className="truncate text-lg font-black">{item.label}</h2>
                <p className="muted-copy mb-3 text-sm">{item.location}</p>
                <Link className="rounded-lg border border-cyan-300/30 px-3 py-2 text-sm font-semibold text-cyan-200" to={item.href}>Open</Link>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
