import { Save, Trash2, UserPlus } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { apiFetch } from "../lib/api";

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
};

export function AdminPage() {
  const [qrBaseUrl, setQrBaseUrl] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "viewer" });

  async function loadData() {
    const [settings, userRows] = await Promise.all([
      apiFetch<{ qrBaseUrl: string }>("/api/settings"),
      apiFetch<User[]>("/api/users"),
    ]);
    setQrBaseUrl(settings.qrBaseUrl);
    setUsers(userRows);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function saveQrBaseUrl(event: FormEvent) {
    event.preventDefault();
    await apiFetch("/api/settings/qr-base-url", {
      method: "PUT",
      body: JSON.stringify({ qrBaseUrl }),
    });
    setMessage("QR base URL saved.");
  }

  async function createUser(event: FormEvent) {
    event.preventDefault();
    await apiFetch("/api/users", {
      method: "POST",
      body: JSON.stringify(form),
    });
    setForm({ name: "", email: "", password: "", role: "viewer" });
    setMessage("User created.");
    loadData();
  }

  async function updateUser(user: User) {
    await apiFetch(`/api/users/${user.id}`, {
      method: "PUT",
      body: JSON.stringify({ ...user, password: "" }),
    });
    setMessage(`${user.email} updated.`);
    loadData();
  }

  async function deleteUser(user: User) {
    if (!window.confirm(`Delete user ${user.email}?`)) return;
    await apiFetch(`/api/users/${user.id}`, { method: "DELETE" });
    setMessage(`${user.email} deleted.`);
    loadData();
  }

  function updateLocalUser(id: string, patch: Partial<User>) {
    setUsers((rows) => rows.map((user) => (user.id === id ? { ...user, ...patch } : user)));
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-black">Admin Settings</h1>
        <p className="muted-copy text-sm">Control fixed QR URLs and application users.</p>
      </div>

      {message && <div className="glass-soft rounded-xl p-3 text-sm text-emerald-200">{message}</div>}

      <Card>
        <h2 className="mb-3 text-xl font-bold">QR Base URL</h2>
        <form className="grid gap-3 md:grid-cols-[1fr_auto]" onSubmit={saveQrBaseUrl}>
          <div>
            <label className="muted-copy text-sm">Permanent server URL encoded inside QR stickers</label>
            <input
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2"
              placeholder="http://10.10.1.25:5173"
              value={qrBaseUrl}
              onChange={(event) => setQrBaseUrl(event.target.value)}
            />
            <p className="muted-copy mt-2 text-xs">Leave blank to auto-detect from the current browser host. For office stickers, use the Linux server IP or DNS name.</p>
          </div>
          <Button type="submit" className="self-end">
            <Save size={16} /> Save URL
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="mb-3 text-xl font-bold">Create User</h2>
        <form className="grid gap-3 md:grid-cols-5" onSubmit={createUser}>
          <input className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2" placeholder="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
          <input className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2" placeholder="Email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
          <input className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2" placeholder="Password" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required />
          <select className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
            <option value="admin">admin</option>
            <option value="editor">editor</option>
            <option value="viewer">viewer</option>
          </select>
          <Button type="submit">
            <UserPlus size={16} /> Add
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="mb-3 text-xl font-bold">Users</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs uppercase text-slate-400">
              <tr>
                <th className="p-2">Name</th>
                <th className="p-2">Email</th>
                <th className="p-2">Role</th>
                <th className="p-2">Created</th>
                <th className="p-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t border-white/10">
                  <td className="p-2"><input className="w-full rounded bg-slate-950/50 px-2 py-1" value={user.name} onChange={(event) => updateLocalUser(user.id, { name: event.target.value })} /></td>
                  <td className="p-2"><input className="w-full rounded bg-slate-950/50 px-2 py-1" value={user.email} onChange={(event) => updateLocalUser(user.id, { email: event.target.value })} /></td>
                  <td className="p-2">
                    <select className="w-full rounded bg-slate-950/50 px-2 py-1" value={user.role} onChange={(event) => updateLocalUser(user.id, { role: event.target.value })}>
                      <option value="admin">admin</option>
                      <option value="editor">editor</option>
                      <option value="viewer">viewer</option>
                    </select>
                  </td>
                  <td className="p-2 text-slate-400">{new Date(user.createdAt).toLocaleDateString()}</td>
                  <td className="p-2 text-right">
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="secondary" onClick={() => updateUser(user)}>
                        <Save size={16} />
                      </Button>
                      <Button type="button" variant="danger" onClick={() => deleteUser(user)}>
                        <Trash2 size={16} />
                      </Button>
                    </div>
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
