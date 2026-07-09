import { Server } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";

export function LoginPage() {
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    localStorage.removeItem("rack-token");
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.message ?? "Login failed");
      return;
    }
    localStorage.setItem("rack-token", data.token);
    navigate("/");
  }

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <Card className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-xl bg-cyan-400 p-3 text-slate-950"><Server /></div>
          <div>
            <h1 className="text-2xl font-bold">Network Rack Manager</h1>
            <p className="text-sm text-slate-400">JWT protected prototype login</p>
          </div>
        </div>
        <form className="space-y-3" onSubmit={submit}>
          <Input value={email} onChange={(event) => setEmail(event.target.value)} />
          <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          {error && <div className="rounded-lg bg-rose-500/15 p-2 text-sm text-rose-200">{error}</div>}
          <Button className="w-full">Login</Button>
        </form>
      </Card>
    </div>
  );
}
