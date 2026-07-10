import "dotenv/config";
import bcrypt from "bcryptjs";
import cors from "cors";
import express from "express";
import multer from "multer";
import QRCode from "qrcode";
import XLSX from "xlsx";
import { z } from "zod";

import { requireAdmin, requireAuth, requireEditor, signToken } from "./auth.js";
import { prisma } from "./prisma.js";

const app = express();
const port = Number(process.env.PORT ?? 4000);
const upload = multer({ dest: "uploads/" });

const importUpload = multer({ storage: multer.memoryStorage() });

function param(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value ?? "";
}

const templateColumns = {
  locations: [
    "buildingName",
    "blockName",
    "floorName",
    "floorLevel",
    "hubRoomName",
    "hubRoomType",
    "hubRoomNotes"
  ],
  racks: [
    "buildingName",
    "blockName",
    "floorName",
    "hubRoomName",
    "rackName",
    "unitCount",
    "positionX",
    "positionY",
    "notes"
  ],
  devices: [
    "hubRoomName",
    "rackName",
    "deviceName",
    "deviceType",
    "brand",
    "model",
    "ipAddress",
    "macAddress",
    "firmwareVersion",
    "softwareVersion",
    "serialNumber",
    "installationDate",
    "location",
    "startUnit",
    "heightUnits",
    "notes"
  ],
  ports: [
    "switchName",
    "portNumber",
    "portLabel",
    "portType",
    "status",
    "connectedDeviceName",
    "macAddress",
    "cableLabel",
    "patchPanel",
    "vlan",
    "speed",
    "duplex",
    "description",
    "notes"
  ]
} as const;

type ImportType = keyof typeof templateColumns;

function cell(row: Record<string, unknown>, key: string) {
  const value = row[key];
  return value === undefined || value === null ? "" : String(value).trim();
}

function numberCell(row: Record<string, unknown>, key: string, fallback = 0) {
  const value = Number(row[key]);
  return Number.isFinite(value) ? value : fallback;
}

function optionalQuery(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function auditWhereFromQuery(req: express.Request) {
  const action = optionalQuery(req.query.action);
  const entity = optionalQuery(req.query.entity);
  const user = optionalQuery(req.query.user);
  const from = optionalQuery(req.query.from);
  const to = optionalQuery(req.query.to);

  return {
    ...(action ? { action: { contains: action, mode: "insensitive" as const } } : {}),
    ...(entity ? { entity: { contains: entity, mode: "insensitive" as const } } : {}),
    ...(user ? { details: { contains: user, mode: "insensitive" as const } } : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        }
      : {}),
  };
}

function validateImportRows(type: ImportType, rows: Record<string, unknown>[]) {
  const required: Record<ImportType, string[]> = {
    locations: ["buildingName", "blockName", "floorLevel", "hubRoomName"],
    racks: ["buildingName", "blockName", "hubRoomName", "rackName", "unitCount"],
    devices: ["hubRoomName", "rackName", "deviceName", "deviceType", "startUnit"],
    ports: ["switchName", "portNumber", "status"],
  };
  const allowedStatuses = new Set(["CONNECTED", "DISCONNECTED", "DISABLED", "UNKNOWN"]);
  const errors: Array<{ row: number; field: string; message: string }> = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    for (const field of required[type]) {
      if (!cell(row, field)) {
        errors.push({ row: rowNumber, field, message: `${field} is required` });
      }
    }

    if (type === "locations" && !Number.isFinite(Number(row.floorLevel))) {
      errors.push({ row: rowNumber, field: "floorLevel", message: "floorLevel must be a number" });
    }
    if (type === "racks" && !Number.isFinite(Number(row.unitCount))) {
      errors.push({ row: rowNumber, field: "unitCount", message: "unitCount must be a number" });
    }
    if (type === "devices") {
      if (!Number.isFinite(Number(row.startUnit))) errors.push({ row: rowNumber, field: "startUnit", message: "startUnit must be a number" });
      if (cell(row, "heightUnits") && !Number.isFinite(Number(row.heightUnits))) errors.push({ row: rowNumber, field: "heightUnits", message: "heightUnits must be a number" });
    }
    if (type === "ports") {
      if (!Number.isFinite(Number(row.portNumber))) errors.push({ row: rowNumber, field: "portNumber", message: "portNumber must be a number" });
      const status = cell(row, "status") || "UNKNOWN";
      if (!allowedStatuses.has(status)) errors.push({ row: rowNumber, field: "status", message: "status must be CONNECTED, DISCONNECTED, DISABLED, or UNKNOWN" });
    }
  });

  return { valid: errors.length === 0, totalRows: rows.length, errors, previewRows: rows.slice(0, 10) };
}

function workbookResponse(res: express.Response, fileName: string, rows: Record<string, unknown>[]) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  res.send(buffer);
}

function readWorkbookRows(file: Express.Multer.File) {
  const workbook = XLSX.read(file.buffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], { defval: "" });
}

async function findOrCreateBuilding(name: string) {
  const existing = await prisma.building.findFirst({ where: { name } });
  return existing ?? prisma.building.create({ data: { name } });
}

async function findOrCreateBlock(name: string, buildingId: string) {
  const existing = await prisma.block.findFirst({ where: { name, buildingId } });
  return existing ?? prisma.block.create({ data: { name, buildingId } });
}

async function findOrCreateFloor(name: string, blockId: string, level: number) {
  const existingByLevel = await prisma.floor.findFirst({ where: { blockId, level } });
  if (existingByLevel) {
    return existingByLevel.name === name ? existingByLevel : prisma.floor.update({ where: { id: existingByLevel.id }, data: { name } });
  }

  const existingByName = await prisma.floor.findFirst({ where: { name, blockId } });
  return existingByName ?? prisma.floor.create({ data: { name, blockId, level } });
}

async function findOrCreateHubRoom(name: string, floorId: string, type = "Hub Room", notes?: string) {
  const existing = await prisma.hubRoom.findFirst({ where: { name, floorId } });
  if (existing) {
    return prisma.hubRoom.update({ where: { id: existing.id }, data: { type, notes } });
  }
  return prisma.hubRoom.create({ data: { name, floorId, type, notes } });
}

async function findOrCreateRack(name: string, hubRoomId: string, unitCount = 42, positionX = 0, positionY = 0, notes?: string) {
  const existing = await prisma.rack.findFirst({ where: { name, hubRoomId } });
  const rack = existing
    ? await prisma.rack.update({ where: { id: existing.id }, data: { unitCount, positionX, positionY, notes } })
    : await prisma.rack.create({ data: { name, hubRoomId, unitCount, positionX, positionY, notes } });

  const currentUnits = await prisma.rackUnit.count({ where: { rackId: rack.id } });
  if (currentUnits === 0) {
    for (let unit = 1; unit <= rack.unitCount; unit += 1) {
      await prisma.rackUnit.create({ data: { rackId: rack.id, unitNumber: unit, label: `U${unit}`, type: "BLANK" } });
    }
  }

  return rack;
}

function rackUnitTypeForDevice(deviceType: string) {
  const type = deviceType.toLowerCase();
  if (type.includes("switch")) return "SWITCH";
  if (type.includes("cable manager")) return "CABLE_MANAGER";
  if (type.includes("power supply")) return "POWER_SUPPLY";
  if (type.includes("patch panel")) return "PATCH_PANEL";
  return "OTHER";
}

async function ensureRackUnits(rackId: string, unitCount: number) {
  const existingUnits = await prisma.rackUnit.findMany({ where: { rackId }, select: { unitNumber: true } });
  const existingNumbers = new Set(existingUnits.map((unit) => unit.unitNumber));

  for (let unit = 1; unit <= unitCount; unit += 1) {
    if (!existingNumbers.has(unit)) {
      await prisma.rackUnit.create({ data: { rackId, unitNumber: unit, label: `U${unit}`, type: "BLANK" } });
    }
  }
}

async function syncDeviceToRackUnits(device: { id: string; rackId: string; name: string; deviceType: string; startUnit: number; heightUnits: number }) {
  const heightUnits = Math.max(Number(device.heightUnits) || 1, 1);
  const topUnit = Number(device.startUnit);
  const bottomUnit = Math.max(topUnit - heightUnits + 1, 1);

  await clearDeviceFromRackUnits(device.id);

  await prisma.rackUnit.updateMany({
    where: { rackId: device.rackId, unitNumber: { gte: bottomUnit, lte: topUnit } },
    data: {
      type: rackUnitTypeForDevice(device.deviceType),
      label: heightUnits > 1 ? `${device.name} (${heightUnits}U)` : device.name,
      heightUnits,
      deviceId: device.id
    }
  });
}

async function clearDeviceFromRackUnits(deviceId: string) {
  const units = await prisma.rackUnit.findMany({ where: { deviceId } });
  for (const unit of units) {
    await prisma.rackUnit.update({
      where: { id: unit.id },
      data: { type: "BLANK", label: `U${unit.unitNumber}`, heightUnits: 1, deviceId: null }
    });
  }
}

async function logAudit(req: express.Request, action: string, entity: string, entityId?: string, details?: unknown) {
  await prisma.auditLog.create({
    data: {
      action,
      entity,
      entityId,
      details: JSON.stringify({
        user: req.user?.email ?? "system",
        role: req.user?.role ?? "unknown",
        details: details ?? {},
      }),
    },
  });
}

async function getQrBaseUrl(req: express.Request) {
  const setting = await prisma.appSetting.findUnique({ where: { key: "qrBaseUrl" } });
  if (setting?.value.trim()) {
    return setting.value.trim().replace(/\/$/, "");
  }
  const forwardedHost = req.get("x-forwarded-host") ?? req.get("host") ?? "localhost:5173";
  const forwardedProto = req.get("x-forwarded-proto") ?? req.protocol;
  return `${forwardedProto}://${forwardedHost}`;
}

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/auth/login", async (req, res) => {
  const schema = z.object({ email: z.string().email(), password: z.string().min(1) });
  const parsed = schema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid login data" });
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !bcrypt.compareSync(parsed.data.password, user.passwordHash)) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  const token = signToken({ id: user.id, email: user.email, role: user.role });
  return res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

app.get("/api/dashboard", requireAuth, async (_req, res) => {
  const [buildings, blocks, floors, hubRooms, racks, devices, ports] = await Promise.all([
    prisma.building.count(),
    prisma.block.count(),
    prisma.floor.count(),
    prisma.hubRoom.count(),
    prisma.rack.count(),
    prisma.device.count(),
    prisma.switchPort.count(),
  ]);

  const blockCards = await prisma.block.findMany({
    include: { floors: { orderBy: { level: "asc" }, include: { hubRooms: true } } },
  });
  const buildingCards = await prisma.building.findMany({
    orderBy: { createdAt: "asc" },
    include: { blocks: { include: { floors: { orderBy: { level: "asc" }, include: { hubRooms: true } } } } },
  });

  res.json({ counts: { buildings, blocks, floors, hubRooms, racks, devices, ports }, blocks: blockCards, buildings: buildingCards });
});

app.get("/api/navigation", requireAuth, async (_req, res) => {
  const buildings = await prisma.building.findMany({
    include: { blocks: { include: { floors: { orderBy: { level: "asc" }, include: { hubRooms: true } } } } },
  });
  res.json(buildings);
});

app.get("/api/master-data", requireAuth, async (_req, res) => {
  const [buildings, blocks, floors, hubRooms, racks, devices, ports] = await Promise.all([
    prisma.building.findMany({ orderBy: { createdAt: "asc" }, include: { blocks: true } }),
    prisma.block.findMany({ orderBy: { name: "asc" }, include: { building: true, floors: true } }),
    prisma.floor.findMany({ orderBy: [{ level: "asc" }, { name: "asc" }], include: { block: { include: { building: true } }, hubRooms: true } }),
    prisma.hubRoom.findMany({ orderBy: { name: "asc" }, include: { floor: { include: { block: { include: { building: true } } } }, racks: true } }),
    prisma.rack.findMany({ orderBy: { name: "asc" }, include: { hubRoom: { include: { floor: { include: { block: { include: { building: true } } } } } }, devices: true } }),
    prisma.device.findMany({ orderBy: { name: "asc" }, include: { rack: { include: { hubRoom: true } }, ports: true } }),
    prisma.switchPort.findMany({ orderBy: [{ device: { name: "asc" } }, { portNumber: "asc" }], include: { device: { include: { rack: { include: { hubRoom: true } } } } } }),
  ]);

  res.json({ buildings, blocks, floors, hubRooms, racks, devices, ports });
});

app.get("/api/audit-logs", requireAuth, async (req, res) => {
  const logs = await prisma.auditLog.findMany({ where: auditWhereFromQuery(req), orderBy: { createdAt: "desc" }, take: 500 });
  res.json(logs);
});

app.get("/api/audit-logs/export", requireAuth, requireEditor, async (req, res) => {
  const logs = await prisma.auditLog.findMany({ where: auditWhereFromQuery(req), orderBy: { createdAt: "desc" }, take: 5000 });
  workbookResponse(
    res,
    "audit-logs-export.xlsx",
    logs.map((log) => {
      let user = "system";
      let role = "";
      let detail = log.details ?? "";
      try {
        const parsed = JSON.parse(log.details ?? "{}");
        user = parsed.user ?? user;
        role = parsed.role ?? role;
        detail = JSON.stringify(parsed.details ?? {});
      } catch {
        // keep raw detail
      }
      return {
        time: log.createdAt.toISOString(),
        action: log.action,
        entity: log.entity,
        entityId: log.entityId ?? "",
        user,
        role,
        detail,
      };
    })
  );
});

app.get("/api/settings", requireAuth, async (_req, res) => {
  const settings = await prisma.appSetting.findMany({ orderBy: { key: "asc" } });
  res.json({
    qrBaseUrl: settings.find((setting) => setting.key === "qrBaseUrl")?.value ?? "",
    qrPaperSize: settings.find((setting) => setting.key === "qrPaperSize")?.value ?? "A4",
    qrLabelWidthMm: Number(settings.find((setting) => setting.key === "qrLabelWidthMm")?.value ?? 90),
    qrLabelHeightMm: Number(settings.find((setting) => setting.key === "qrLabelHeightMm")?.value ?? 45),
    qrLabelColumns: Number(settings.find((setting) => setting.key === "qrLabelColumns")?.value ?? 2),
    qrLabelRows: Number(settings.find((setting) => setting.key === "qrLabelRows")?.value ?? 6),
    settings,
  });
});

app.put("/api/settings/qr-base-url", requireAuth, requireAdmin, async (req, res) => {
  const schema = z.object({ qrBaseUrl: z.string().trim().optional().default("") });
  const { qrBaseUrl } = schema.parse(req.body);
  const setting = await prisma.appSetting.upsert({
    where: { key: "qrBaseUrl" },
    update: { value: qrBaseUrl, notes: "Base URL encoded inside QR codes." },
    create: { key: "qrBaseUrl", value: qrBaseUrl, notes: "Base URL encoded inside QR codes." },
  });
  await logAudit(req, "UPDATE", "Setting", setting.id, { key: "qrBaseUrl", value: qrBaseUrl });
  res.json({ qrBaseUrl: setting.value });
});

app.put("/api/settings/qr-print", requireAuth, requireAdmin, async (req, res) => {
  const schema = z.object({
    qrPaperSize: z.string().default("A4"),
    qrLabelWidthMm: z.number().min(20).max(200).default(90),
    qrLabelHeightMm: z.number().min(20).max(200).default(45),
    qrLabelColumns: z.number().min(1).max(6).default(2),
    qrLabelRows: z.number().min(1).max(20).default(6),
  });
  const data = schema.parse(req.body);
  await Promise.all(
    Object.entries(data).map(([key, value]) =>
      prisma.appSetting.upsert({
        where: { key },
        update: { value: String(value), notes: "QR printable sticker sheet setting." },
        create: { key, value: String(value), notes: "QR printable sticker sheet setting." },
      })
    )
  );
  await logAudit(req, "UPDATE", "Setting", "qr-print", data);
  res.json(data);
});

app.put("/api/auth/change-password", requireAuth, async (req, res) => {
  const schema = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(6) });
  const data = schema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user || !bcrypt.compareSync(data.currentPassword, user.passwordHash)) {
    return res.status(400).json({ message: "Current password is incorrect" });
  }
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: bcrypt.hashSync(data.newPassword, 10) } });
  await logAudit(req, "UPDATE", "UserPassword", user.id, { email: user.email });
  res.json({ message: "Password changed" });
});

app.put("/api/users/:id/reset-password", requireAuth, requireAdmin, async (req, res) => {
  const schema = z.object({ password: z.string().min(6) });
  const data = schema.parse(req.body);
  const user = await prisma.user.update({ where: { id: param(req.params.id) }, data: { passwordHash: bcrypt.hashSync(data.password, 10) } });
  await logAudit(req, "UPDATE", "UserPassword", user.id, { email: user.email, resetByAdmin: true });
  res.json({ message: "Password reset" });
});

app.get("/api/users", requireAuth, requireAdmin, async (_req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });
  res.json(users);
});

app.post("/api/users", requireAuth, requireAdmin, async (req, res) => {
  const schema = z.object({
    name: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(6),
    role: z.string().min(1).default("viewer"),
  });
  const data = schema.parse(req.body);
  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      passwordHash: bcrypt.hashSync(data.password, 10),
      role: data.role,
    },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });
  await logAudit(req, "CREATE", "User", user.id, { email: user.email, role: user.role });
  res.status(201).json(user);
});

app.put("/api/users/:id", requireAuth, requireAdmin, async (req, res) => {
  const schema = z.object({
    name: z.string().min(1),
    email: z.string().email(),
    role: z.string().min(1),
    password: z.string().min(6).optional().or(z.literal("")),
  });
  const data = schema.parse(req.body);
  const user = await prisma.user.update({
    where: { id: param(req.params.id) },
    data: {
      name: data.name,
      email: data.email,
      role: data.role,
      ...(data.password ? { passwordHash: bcrypt.hashSync(data.password, 10) } : {}),
    },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });
  await logAudit(req, "UPDATE", "User", user.id, { email: user.email, role: user.role });
  res.json(user);
});

app.delete("/api/users/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = param(req.params.id);
  if (req.user?.id === id) {
    return res.status(400).json({ message: "You cannot delete your own logged-in user." });
  }
  const user = await prisma.user.findUnique({ where: { id } });
  await prisma.user.delete({ where: { id } });
  await logAudit(req, "DELETE", "User", id, { email: user?.email });
  res.status(204).send();
});

app.get("/api/alerts", requireAuth, async (_req, res) => {
  const alerts = await prisma.alert.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  res.json(alerts);
});

app.post("/api/alerts", requireAuth, requireEditor, async (req, res) => {
  const schema = z.object({
    title: z.string().min(1),
    severity: z.string().default("info"),
    message: z.string().min(1),
    entity: z.string().optional(),
    entityId: z.string().optional(),
  });
  const alert = await prisma.alert.create({ data: schema.parse(req.body) });
  await logAudit(req, "CREATE", "Alert", alert.id, { title: alert.title, severity: alert.severity });
  res.status(201).json(alert);
});

app.put("/api/alerts/:id", requireAuth, requireEditor, async (req, res) => {
  const schema = z.object({ status: z.string().min(1) });
  const alert = await prisma.alert.update({ where: { id: param(req.params.id) }, data: schema.parse(req.body) });
  await logAudit(req, "UPDATE", "Alert", alert.id, { status: alert.status });
  res.json(alert);
});

app.delete("/api/alerts/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = param(req.params.id);
  const alert = await prisma.alert.findUnique({ where: { id } });
  await prisma.alert.delete({ where: { id } });
  await logAudit(req, "DELETE", "Alert", id, { title: alert?.title });
  res.status(204).send();
});

app.get("/api/discovery/runs", requireAuth, async (_req, res) => {
  const runs = await prisma.discoveryRun.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  res.json(runs);
});

app.post("/api/discovery/run", requireAuth, requireEditor, async (req, res) => {
  const schema = z.object({ type: z.string().default("SNMP_LLDP_DUMMY"), target: z.string().optional() });
  const data = schema.parse(req.body);
  const details = {
    target: data.target ?? "sample-switch",
    portStatus: [
      { port: "Gi1/0/1", status: "up", mac: "AA:BB:CC:00:00:01", lldpNeighbor: "Reception-PC" },
      { port: "Gi1/0/2", status: "down", mac: null, lldpNeighbor: null },
      { port: "SFP1", status: "up", mac: "AA:BB:CC:00:00:FE", lldpNeighbor: "Core-Switch" },
    ],
    note: "Placeholder only. Add real SNMP/LLDP polling here after switch credentials and network access are provided.",
  };
  const run = await prisma.discoveryRun.create({
    data: {
      type: data.type,
      status: "completed",
      summary: "Dummy SNMP/LLDP discovery completed with sample port data.",
      details: JSON.stringify(details),
    },
  });
  await prisma.alert.create({
    data: {
      title: "Discovery placeholder executed",
      severity: "info",
      message: "Dummy discovery run completed. Real SNMP/LLDP polling is not connected yet.",
      entity: "DiscoveryRun",
      entityId: run.id,
    },
  });
  await logAudit(req, "CREATE", "DiscoveryRun", run.id, details);
  res.status(201).json(run);
});

app.get("/api/qr-items", requireAuth, async (req, res) => {
  const [hubRooms, racks, devices] = await Promise.all([
    prisma.hubRoom.findMany({ orderBy: { name: "asc" }, include: { floor: { include: { block: { include: { building: true } } } } } }),
    prisma.rack.findMany({ orderBy: { name: "asc" }, include: { hubRoom: true } }),
    prisma.device.findMany({ orderBy: { name: "asc" }, include: { rack: { include: { hubRoom: true } } } }),
  ]);

  res.json([
    ...hubRooms.map((room) => ({
      id: room.id,
      type: "hub-room",
      label: room.name,
      location: `${room.floor.block.building.name} / ${room.floor.block.name} / ${room.floor.name}`,
      href: `/hub-rooms/${room.id}`,
      qrUrl: `/api/qr/hub-room/${room.id}`,
    })),
    ...racks.map((rack) => ({
      id: rack.id,
      type: "rack",
      label: rack.name,
      location: rack.hubRoom.name,
      href: `/racks/${rack.id}`,
      qrUrl: `/api/qr/rack/${rack.id}`,
    })),
    ...devices.map((device) => ({
      id: device.id,
      type: "device",
      label: device.name,
      location: `${device.rack.hubRoom.name} / ${device.rack.name}`,
      href: `/devices/${device.id}`,
      qrUrl: `/api/qr/device/${device.id}`,
    })),
  ]);
});

app.get("/api/cable-trace", requireAuth, async (req, res) => {
  const rawQuery = Array.isArray(req.query.query) ? req.query.query[0] : req.query.query;
  const query = typeof rawQuery === "string" ? rawQuery.trim() : "";
  if (!query) return res.json([]);

  const contains = { contains: query, mode: "insensitive" as const };
  const [devices, ports] = await Promise.all([
    prisma.device.findMany({
      where: {
        OR: [
          { name: contains },
          { deviceType: contains },
          { brand: contains },
          { model: contains },
          { ipAddress: contains },
          { macAddress: contains },
          { serialNumber: contains },
          { location: contains },
          { notes: contains },
        ],
      },
      include: { rack: { include: { hubRoom: { include: { floor: { include: { block: { include: { building: true } } } } } } } }, ports: true },
      take: 25,
    }),
    prisma.switchPort.findMany({
      where: {
        OR: [
          { portLabel: contains },
          { portType: contains },
          { connectedDeviceName: contains },
          { macAddress: contains },
          { cableLabel: contains },
          { patchPanel: contains },
          { vlan: contains },
          { speed: contains },
          { duplex: contains },
          { description: contains },
          { notes: contains },
          { device: { name: contains } },
        ],
      },
      include: {
        device: {
          include: {
            rack: {
              include: {
                hubRoom: {
                  include: {
                    floor: { include: { block: { include: { building: true } } } },
                  },
                },
              },
            },
          },
        },
      },
      take: 50,
    }),
  ]);

  const deviceResults = devices.map((device) => ({
    id: `device-${device.id}`,
    type: "Device",
    title: device.name,
    subtitle: [device.ipAddress, device.macAddress, device.deviceType].filter(Boolean).join(" / "),
    href: `/devices/${device.id}`,
    path: [
      device.name,
      device.rack.name,
      device.rack.hubRoom.name,
      device.rack.hubRoom.floor.name,
      device.rack.hubRoom.floor.block.name,
      device.rack.hubRoom.floor.block.building.name,
    ],
    details: {
      cableLabel: null,
      portLabel: null,
      patchPanel: null,
      vlan: null,
    },
  }));

  const portResults = ports.map((port) => ({
    id: `port-${port.id}`,
    type: port.portType === "POWER_SOCKET" ? "Power Socket" : "Switch Port",
    title: `${port.device.name} ${port.portLabel}`,
    subtitle: [port.connectedDeviceName, port.macAddress, port.cableLabel].filter(Boolean).join(" / ") || "No connection details",
    href: `/devices/${port.device.id}`,
    path: [
      port.connectedDeviceName || "-",
      port.cableLabel || "-",
      `${port.device.name} ${port.portLabel}`,
      port.device.rack.name,
      port.device.rack.hubRoom.name,
      port.device.rack.hubRoom.floor.block.name,
    ],
    details: {
      cableLabel: port.cableLabel,
      portLabel: port.portLabel,
      patchPanel: port.patchPanel,
      vlan: port.vlan,
    },
  }));

  res.json([...deviceResults, ...portResults]);
});

app.put("/api/buildings/:id", requireAuth, requireEditor, async (req, res) => {
  const schema = z.object({ name: z.string().min(1) });
  const building = await prisma.building.update({ where: { id: param(req.params.id) }, data: schema.parse(req.body) });
  await logAudit(req, "UPDATE", "Building", building.id, { name: building.name });
  res.json(building);
});

app.delete("/api/buildings/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = param(req.params.id);
  const building = await prisma.building.findUnique({ where: { id } });
  await prisma.building.delete({ where: { id: param(req.params.id) } });
  await logAudit(req, "DELETE", "Building", id, { name: building?.name });
  res.status(204).send();
});

app.post("/api/locations", requireAuth, requireEditor, async (req, res) => {
  const schema = z.object({
    buildingName: z.string().min(1),
    blockName: z.string().min(1),
    floorName: z.string().min(1),
    floorLevel: z.number().default(0),
    hubRoomName: z.string().min(1),
    hubRoomType: z.string().default("Hub Room"),
    hubRoomNotes: z.string().optional()
  });
  const data = schema.parse(req.body);
  const building = await findOrCreateBuilding(data.buildingName);
  const block = await findOrCreateBlock(data.blockName, building.id);
  const floor = await findOrCreateFloor(data.floorName, block.id, data.floorLevel);
  const hubRoom = await findOrCreateHubRoom(data.hubRoomName, floor.id, data.hubRoomType, data.hubRoomNotes);
  await logAudit(req, "CREATE", "HubRoom", hubRoom.id, data);
  res.status(201).json({ building, block, floor, hubRoom });
});

app.get("/api/blocks/:id", requireAuth, async (req, res) => {
  const block = await prisma.block.findUnique({
    where: { id: param(req.params.id) },
    include: { building: true, floors: { orderBy: { level: "asc" }, include: { hubRooms: true } } },
  });
  if (!block) return res.status(404).json({ message: "Block not found" });
  res.json(block);
});

app.get("/api/hub-rooms/:id", requireAuth, async (req, res) => {
  const hubRoom = await prisma.hubRoom.findUnique({
    where: { id: param(req.params.id) },
    include: {
      floor: { include: { block: { include: { building: true } } } },
      racks: { orderBy: [{ positionY: "asc" }, { positionX: "asc" }], include: { devices: true } },
    },
  });
  if (!hubRoom) return res.status(404).json({ message: "Hub room not found" });
  res.json(hubRoom);
});

app.post("/api/hub-rooms", requireAuth, requireEditor, async (req, res) => {
  const schema = z.object({ name: z.string(), floorId: z.string(), type: z.string().optional(), notes: z.string().optional() });
  const hubRoom = await prisma.hubRoom.create({ data: schema.parse(req.body) });
  await logAudit(req, "CREATE", "HubRoom", hubRoom.id, { name: hubRoom.name });
  res.status(201).json(hubRoom);
});

app.put("/api/hub-rooms/:id", requireAuth, requireEditor, async (req, res) => {
  const hubRoom = await prisma.hubRoom.update({ where: { id: param(req.params.id) }, data: req.body });
  await logAudit(req, "UPDATE", "HubRoom", hubRoom.id, req.body);
  res.json(hubRoom);
});

app.delete("/api/hub-rooms/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = param(req.params.id);
  const hubRoom = await prisma.hubRoom.findUnique({ where: { id } });
  await prisma.hubRoom.delete({ where: { id } });
  await logAudit(req, "DELETE", "HubRoom", id, { name: hubRoom?.name });
  res.status(204).send();
});

app.get("/api/racks/:id", requireAuth, async (req, res) => {
  const rackRecord = await prisma.rack.findUnique({
    where: { id: param(req.params.id) },
    include: { devices: true },
  });
  if (!rackRecord) return res.status(404).json({ message: "Rack not found" });

  await ensureRackUnits(rackRecord.id, rackRecord.unitCount);
  for (const device of rackRecord.devices) {
    await syncDeviceToRackUnits(device);
  }

  const rack = await prisma.rack.findUnique({
    where: { id: param(req.params.id) },
    include: {
      hubRoom: { include: { floor: { include: { block: true } } } },
      rackUnits: { orderBy: { unitNumber: "desc" }, include: { device: true } },
      devices: { orderBy: { startUnit: "desc" }, include: { ports: { orderBy: { portNumber: "asc" } } } },
    },
  });
  res.json(rack);
});

app.post("/api/racks", requireAuth, requireEditor, async (req, res) => {
  const schema = z.object({
    name: z.string(),
    hubRoomId: z.string(),
    unitCount: z.number().default(42),
    positionX: z.number().default(0),
    positionY: z.number().default(0),
    notes: z.string().optional(),
  });
  const rack = await prisma.rack.create({ data: schema.parse(req.body) });
  await ensureRackUnits(rack.id, rack.unitCount);
  await logAudit(req, "CREATE", "Rack", rack.id, { name: rack.name, unitCount: rack.unitCount });
  res.status(201).json(rack);
});

app.put("/api/racks/:id", requireAuth, requireEditor, async (req, res) => {
  const rack = await prisma.rack.update({ where: { id: param(req.params.id) }, data: req.body });
  await logAudit(req, "UPDATE", "Rack", rack.id, req.body);
  res.json(rack);
});

app.put("/api/hub-rooms/:id/rack-positions", requireAuth, requireEditor, async (req, res) => {
  const schema = z.object({
    racks: z.array(z.object({ id: z.string(), positionX: z.number(), positionY: z.number() })),
  });
  const data = schema.parse(req.body);
  const hubRoomId = param(req.params.id);
  const updated = [];
  for (const rack of data.racks) {
    await prisma.rack.updateMany({
      where: { id: rack.id, hubRoomId },
      data: { positionX: rack.positionX, positionY: rack.positionY },
    });
    const saved = await prisma.rack.findUnique({ where: { id: rack.id } });
    if (saved) updated.push(saved);
  }
  await logAudit(req, "UPDATE", "RackPositions", hubRoomId, data);
  res.json(updated);
});

app.delete("/api/racks/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = param(req.params.id);
  const rack = await prisma.rack.findUnique({ where: { id } });
  await prisma.rack.delete({ where: { id } });
  await logAudit(req, "DELETE", "Rack", id, { name: rack?.name });
  res.status(204).send();
});

app.get("/api/devices/:id", requireAuth, async (req, res) => {
  const device = await prisma.device.findUnique({
    where: { id: param(req.params.id) },
    include: { rack: true, ports: { orderBy: { portNumber: "asc" } } },
  });
  if (!device) return res.status(404).json({ message: "Device not found" });
  res.json(device);
});

app.post("/api/devices", requireAuth, requireEditor, async (req, res) => {
  const { portCount, copperPortCount, sfpPortCount, socketCount, ...deviceInput } = req.body;
  const device = await prisma.device.create({ data: deviceInput });

  if (device.deviceType.toLowerCase().includes("switch")) {
    const copperCount = Number(copperPortCount) >= 0 ? Number(copperPortCount) : Number(portCount) > 0 ? Number(portCount) : 10;
    const sfpCount = Number(sfpPortCount) >= 0 ? Number(sfpPortCount) : 0;

    for (let portNumber = 1; portNumber <= copperCount; portNumber += 1) {
      await prisma.switchPort.create({
        data: {
          deviceId: device.id,
          portNumber,
          portLabel: `Port ${portNumber}`,
          portType: "RJ45",
          status: "DISCONNECTED"
        }
      });
    }

    for (let sfpNumber = 1; sfpNumber <= sfpCount; sfpNumber += 1) {
      await prisma.switchPort.create({
        data: {
          deviceId: device.id,
          portNumber: copperCount + sfpNumber,
          portLabel: `SFP ${sfpNumber}`,
          portType: "SFP",
          status: "DISCONNECTED"
        }
      });
    }
  }

  if (device.deviceType.toLowerCase().includes("power supply")) {
    const count = Number(socketCount) > 0 ? Number(socketCount) : 8;
    for (let socketNumber = 1; socketNumber <= count; socketNumber += 1) {
      await prisma.switchPort.create({
        data: {
          deviceId: device.id,
          portNumber: socketNumber,
          portLabel: `Socket ${socketNumber}`,
          portType: "POWER_SOCKET",
          status: "DISCONNECTED"
        }
      });
    }
  }

  await syncDeviceToRackUnits(device);
  await logAudit(req, "CREATE", "Device", device.id, { name: device.name, deviceType: device.deviceType });

  res.status(201).json(device);
});

app.put("/api/devices/:id", requireAuth, requireEditor, async (req, res) => {
  const device = await prisma.device.update({ where: { id: param(req.params.id) }, data: req.body });
  await syncDeviceToRackUnits(device);
  await logAudit(req, "UPDATE", "Device", device.id, req.body);
  res.json(device);
});

app.delete("/api/devices/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = param(req.params.id);
  const device = await prisma.device.findUnique({ where: { id } });
  await clearDeviceFromRackUnits(id);
  await prisma.device.delete({ where: { id } });
  await logAudit(req, "DELETE", "Device", id, { name: device?.name });
  res.status(204).send();
});

app.put("/api/ports/:id", requireAuth, requireEditor, async (req, res) => {
  const portRow = await prisma.switchPort.update({ where: { id: param(req.params.id) }, data: req.body });
  await logAudit(req, "UPDATE", "Port", portRow.id, { portLabel: portRow.portLabel, ...req.body });
  res.json(portRow);
});

app.delete("/api/ports/:id/connection", requireAuth, requireEditor, async (req, res) => {
  const portRow = await prisma.switchPort.update({
    where: { id: param(req.params.id) },
    data: {
      status: "DISCONNECTED",
      connectedDeviceName: null,
      macAddress: null,
      cableLabel: null,
      description: null,
      notes: null,
    },
  });
  await logAudit(req, "CLEAR_CONNECTION", "Port", portRow.id, { portLabel: portRow.portLabel });
  res.json(portRow);
});

app.post("/api/uploads", requireAuth, requireEditor, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No file uploaded" });
  const file = await prisma.uploadedFile.create({
    data: {
      fileName: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      path: `/uploads/${req.file.filename}`,
      purpose: req.body.purpose ?? "general",
    },
  });
  res.status(201).json(file);
});

app.get("/api/import-export/templates/:type", requireAuth, async (req, res) => {
  const type = param(req.params.type) as ImportType;
  if (!(type in templateColumns)) return res.status(404).json({ message: "Unknown template type" });

  const sampleRows: Record<ImportType, Record<string, unknown>[]> = {
    locations: [
      {
        buildingName: "Main Building",
        blockName: "Block 1",
        floorName: "First Floor",
        floorLevel: 1,
        hubRoomName: "First Floor Hub Room",
        hubRoomType: "Hub Room",
        hubRoomNotes: "Main network room"
      }
    ],
    racks: [
      {
        buildingName: "Main Building",
        blockName: "Block 1",
        floorName: "First Floor",
        hubRoomName: "First Floor Hub Room",
        rackName: "Rack A",
        unitCount: 45,
        positionX: 80,
        positionY: 120,
        notes: "Network rack near entrance"
      }
    ],
    devices: [
      {
        hubRoomName: "First Floor Hub Room",
        rackName: "Rack A",
        deviceName: "SW-RackA-1",
        deviceType: "Network Switch",
        brand: "Cisco",
        model: "48-Port PoE",
        ipAddress: "10.10.1.10",
        macAddress: "00:11:22:33:44:55",
        firmwareVersion: "1.0.0",
        softwareVersion: "NX-Rack",
        serialNumber: "SN001",
        installationDate: "2026-01-15",
        location: "First Floor Hub Room / Rack A",
        startUnit: 42,
        heightUnits: 1,
        notes: "Access switch"
      }
    ],
    ports: [
      {
        switchName: "SW-RackA-1",
        portNumber: 1,
        portLabel: "Port 1",
        portType: "RJ45",
        status: "CONNECTED",
        connectedDeviceName: "Reception PC",
        macAddress: "00:11:22:33:44:55",
        cableLabel: "PP-A-12",
        patchPanel: "Patch Panel A",
        vlan: "VLAN-10",
        speed: "1G",
        duplex: "Full",
        description: "Reception desk network point",
        notes: "Sample connected port"
      }
    ]
  };

  workbookResponse(res, `${type}-template.xlsx`, sampleRows[type]);
});

app.get("/api/import-export/export/:type", requireAuth, async (req, res) => {
  const type = param(req.params.type) as ImportType;
  if (!(type in templateColumns)) return res.status(404).json({ message: "Unknown export type" });

  if (type === "locations") {
    const rooms = await prisma.hubRoom.findMany({ include: { floor: { include: { block: { include: { building: true } } } } } });
    return workbookResponse(
      res,
      "locations-export.xlsx",
      rooms.map((room) => ({
        buildingName: room.floor.block.building.name,
        blockName: room.floor.block.name,
        floorName: room.floor.name,
        floorLevel: room.floor.level,
        hubRoomName: room.name,
        hubRoomType: room.type,
        hubRoomNotes: room.notes ?? ""
      }))
    );
  }

  if (type === "racks") {
    const racks = await prisma.rack.findMany({ include: { hubRoom: { include: { floor: { include: { block: { include: { building: true } } } } } } } });
    return workbookResponse(
      res,
      "racks-export.xlsx",
      racks.map((rack) => ({
        buildingName: rack.hubRoom.floor.block.building.name,
        blockName: rack.hubRoom.floor.block.name,
        floorName: rack.hubRoom.floor.name,
        hubRoomName: rack.hubRoom.name,
        rackName: rack.name,
        unitCount: rack.unitCount,
        positionX: rack.positionX,
        positionY: rack.positionY,
        notes: rack.notes ?? ""
      }))
    );
  }

  if (type === "devices") {
    const devices = await prisma.device.findMany({ include: { rack: { include: { hubRoom: true } } } });
    return workbookResponse(
      res,
      "devices-export.xlsx",
      devices.map((device) => ({
        hubRoomName: device.rack.hubRoom.name,
        rackName: device.rack.name,
        deviceName: device.name,
        deviceType: device.deviceType,
        brand: device.brand ?? "",
        model: device.model ?? "",
        ipAddress: device.ipAddress ?? "",
        macAddress: device.macAddress ?? "",
        firmwareVersion: device.firmwareVersion ?? "",
        softwareVersion: device.softwareVersion ?? "",
        serialNumber: device.serialNumber ?? "",
        installationDate: device.installationDate?.toISOString().slice(0, 10) ?? "",
        location: device.location ?? "",
        startUnit: device.startUnit,
        heightUnits: device.heightUnits,
        notes: device.notes ?? ""
      }))
    );
  }

  const ports = await prisma.switchPort.findMany({ include: { device: true }, orderBy: [{ deviceId: "asc" }, { portNumber: "asc" }] });
  return workbookResponse(
    res,
    "ports-export.xlsx",
    ports.map((portRow) => ({
      switchName: portRow.device.name,
      portNumber: portRow.portNumber,
      portLabel: portRow.portLabel,
      portType: portRow.portType,
      status: portRow.status,
      connectedDeviceName: portRow.connectedDeviceName ?? "",
      macAddress: portRow.macAddress ?? "",
      cableLabel: portRow.cableLabel ?? "",
      patchPanel: portRow.patchPanel ?? "",
      vlan: portRow.vlan ?? "",
      speed: portRow.speed ?? "",
      duplex: portRow.duplex ?? "",
      description: portRow.description ?? "",
      notes: portRow.notes ?? ""
    }))
  );
});

app.post("/api/import-export/preview/:type", requireAuth, requireEditor, importUpload.single("file"), async (req, res) => {
  const type = param(req.params.type) as ImportType;
  if (!(type in templateColumns)) return res.status(404).json({ message: "Unknown import type" });
  if (!req.file) return res.status(400).json({ message: "No Excel file uploaded" });

  const rows = readWorkbookRows(req.file);
  const validation = validateImportRows(type, rows);
  res.json(validation);
});

app.post("/api/import-export/import/:type", requireAuth, requireEditor, importUpload.single("file"), async (req, res) => {
  const type = param(req.params.type) as ImportType;
  if (!(type in templateColumns)) return res.status(404).json({ message: "Unknown import type" });
  if (!req.file) return res.status(400).json({ message: "No Excel file uploaded" });

  const rows = readWorkbookRows(req.file);
  const validation = validateImportRows(type, rows);
  if (!validation.valid) {
    return res.status(400).json({ imported: 0, errors: validation.errors.map((error) => `Row ${error.row}: ${error.message}`), validation });
  }
  let imported = 0;
  const errors: string[] = [];

  for (const [index, row] of rows.entries()) {
    try {
      if (type === "locations") {
        const building = await findOrCreateBuilding(cell(row, "buildingName"));
        const block = await findOrCreateBlock(cell(row, "blockName"), building.id);
        const floor = await findOrCreateFloor(cell(row, "floorName"), block.id, numberCell(row, "floorLevel", 0));
        await findOrCreateHubRoom(cell(row, "hubRoomName"), floor.id, cell(row, "hubRoomType") || "Hub Room", cell(row, "hubRoomNotes"));
      }

      if (type === "racks") {
        const building = await findOrCreateBuilding(cell(row, "buildingName"));
        const block = await findOrCreateBlock(cell(row, "blockName"), building.id);
        const floor = await findOrCreateFloor(cell(row, "floorName"), block.id, numberCell(row, "floorLevel", 0));
        const hubRoom = await findOrCreateHubRoom(cell(row, "hubRoomName"), floor.id);
        await findOrCreateRack(cell(row, "rackName"), hubRoom.id, numberCell(row, "unitCount", 42), numberCell(row, "positionX", 0), numberCell(row, "positionY", 0), cell(row, "notes"));
      }

      if (type === "devices") {
        const hubRoom = await prisma.hubRoom.findFirst({ where: { name: cell(row, "hubRoomName") } });
        if (!hubRoom) throw new Error(`Hub room not found: ${cell(row, "hubRoomName")}`);
        const rack = await prisma.rack.findFirst({ where: { name: cell(row, "rackName"), hubRoomId: hubRoom.id } });
        if (!rack) throw new Error(`Rack not found: ${cell(row, "rackName")}`);
        const existing = await prisma.device.findFirst({ where: { name: cell(row, "deviceName"), rackId: rack.id } });
        const deviceData = {
          name: cell(row, "deviceName"),
          deviceType: cell(row, "deviceType") || "Network Switch",
          brand: cell(row, "brand") || null,
          model: cell(row, "model") || null,
          ipAddress: cell(row, "ipAddress") || null,
          macAddress: cell(row, "macAddress") || null,
          firmwareVersion: cell(row, "firmwareVersion") || null,
          softwareVersion: cell(row, "softwareVersion") || null,
          serialNumber: cell(row, "serialNumber") || null,
          installationDate: cell(row, "installationDate") ? new Date(cell(row, "installationDate")) : null,
          location: cell(row, "location") || null,
          startUnit: numberCell(row, "startUnit", 1),
          heightUnits: numberCell(row, "heightUnits", 1),
          notes: cell(row, "notes") || null,
          rackId: rack.id
        };
        const device = existing ? await prisma.device.update({ where: { id: existing.id }, data: deviceData }) : await prisma.device.create({ data: deviceData });
        await prisma.rackUnit.updateMany({ where: { rackId: rack.id, unitNumber: device.startUnit }, data: { type: "SWITCH", label: device.name, deviceId: device.id } });
      }

      if (type === "ports") {
        const device = await prisma.device.findFirst({ where: { name: cell(row, "switchName") } });
        if (!device) throw new Error(`Switch not found: ${cell(row, "switchName")}`);
        const portNumber = numberCell(row, "portNumber", 0);
        const existing = await prisma.switchPort.findFirst({ where: { deviceId: device.id, portNumber } });
        const status = cell(row, "status") || "UNKNOWN";
        const portData = {
          deviceId: device.id,
          portNumber,
          portLabel: cell(row, "portLabel") || `Port ${portNumber}`,
          portType: cell(row, "portType") || "RJ45",
          status: ["CONNECTED", "DISCONNECTED", "DISABLED", "UNKNOWN"].includes(status) ? status as "CONNECTED" | "DISCONNECTED" | "DISABLED" | "UNKNOWN" : "UNKNOWN",
          connectedDeviceName: cell(row, "connectedDeviceName") || null,
          macAddress: cell(row, "macAddress") || null,
          cableLabel: cell(row, "cableLabel") || null,
          patchPanel: cell(row, "patchPanel") || null,
          vlan: cell(row, "vlan") || null,
          speed: cell(row, "speed") || null,
          duplex: cell(row, "duplex") || null,
          description: cell(row, "description") || null,
          notes: cell(row, "notes") || null
        };
        existing ? await prisma.switchPort.update({ where: { id: existing.id }, data: portData }) : await prisma.switchPort.create({ data: portData });
      }

      imported += 1;
    } catch (error) {
      errors.push(`Row ${index + 2}: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  res.json({ imported, errors });
});

app.get("/api/qr/:type/:id", async (req, res) => {
  const frontendUrl = await getQrBaseUrl(req);
  const type = param(req.params.type);
  const id = param(req.params.id);
  const path = type === "hub-room" ? `/hub-rooms/${id}` : type === "device" ? `/devices/${id}` : `/racks/${id}`;
  const png = await QRCode.toBuffer(`${frontendUrl}${path}`);
  res.setHeader("Content-Type", "image/png");
  res.send(png);
});

app.listen(port, () => {
  console.log(`Rack management API running on http://localhost:${port}`);
});
