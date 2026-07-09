import { Card } from "../components/ui/card";

export function HelpPage() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <h1 className="mb-3 text-xl font-bold">How To Navigate</h1>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-300">
          <li>Open Dashboard.</li>
          <li>Click a block hub room.</li>
          <li>Click a rack in the room layout.</li>
          <li>Click a switch inside the rack.</li>
          <li>Click a port to edit connection details.</li>
        </ol>
      </Card>
      <Card>
        <h2 className="mb-3 text-xl font-bold">QR Workflow</h2>
        <p className="text-sm text-slate-300">Open QR from the header to print stickers for hub rooms, racks, and devices. Scanning opens the exact page in the same web app from a mobile browser on the network.</p>
      </Card>
      <Card>
        <h2 className="mb-3 text-xl font-bold">Trace And Audit</h2>
        <p className="text-sm text-slate-300">Use Trace to search cable labels, MAC addresses, devices, switch ports, patch panels, and VLANs. Audit records create, update, delete, and port connection changes.</p>
      </Card>
      <Card>
        <h2 className="mb-3 text-xl font-bold">Future Architecture</h2>
        <p className="text-sm text-slate-300">The database still leaves space for SNMP, LLDP/CDP, live status, alerts, notifications, and discovery integrations.</p>
      </Card>
    </div>
  );
}
