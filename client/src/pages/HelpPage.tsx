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
        <p className="text-sm text-slate-300">Hub room QR codes should open the hub room layout. Rack QR codes should open the exact rack page. Use the same web app from mobile browsers connected to the same network.</p>
      </Card>
      <Card>
        <h2 className="mb-3 text-xl font-bold">Future Architecture</h2>
        <p className="text-sm text-slate-300">The database already leaves space for SNMP, LLDP/CDP, live status, alerts, notifications, uploads, and audit logs. These are intentionally not implemented in Phase 1.</p>
      </Card>
    </div>
  );
}
