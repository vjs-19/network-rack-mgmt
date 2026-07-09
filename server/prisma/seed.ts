import bcrypt from "bcryptjs";
import { PortStatus, PrismaClient, RackUnitType } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.switchPort.deleteMany();
  await prisma.rackUnit.deleteMany();
  await prisma.device.deleteMany();
  await prisma.rack.deleteMany();
  await prisma.hubRoom.deleteMany();
  await prisma.floor.deleteMany();
  await prisma.block.deleteMany();
  await prisma.building.deleteMany();
  await prisma.user.deleteMany();

  await prisma.user.create({
    data: {
      name: "Admin User",
      email: "admin@example.com",
      passwordHash: bcrypt.hashSync("admin123", 10),
      role: "admin",
    },
  });

  const building = await prisma.building.create({ data: { name: "Main Building" } });
  const block = await prisma.block.create({ data: { name: "Block 1", buildingId: building.id } });
  const floor = await prisma.floor.create({ data: { name: "First Floor", level: 1, blockId: block.id } });
  const hubRoom = await prisma.hubRoom.create({
    data: { name: "First Floor Hub Room", type: "Hub Room", floorId: floor.id, notes: "Phase 1 sample room." },
  });

  for (const [rackIndex, rackName] of ["Rack A", "Rack B", "Rack C"].entries()) {
    const rack = await prisma.rack.create({
      data: { name: rackName, hubRoomId: hubRoom.id, unitCount: 45, positionX: 80 + rackIndex * 190, positionY: 120 },
    });

    for (let unit = 1; unit <= 45; unit += 1) {
      await prisma.rackUnit.create({
        data: {
          rackId: rack.id,
          unitNumber: unit,
          label: `U${unit}`,
          type: unit >= 44 ? RackUnitType.POWER_SUPPLY : unit % 6 === 0 ? RackUnitType.CABLE_MANAGER : RackUnitType.BLANK,
        },
      });
    }

    for (const [switchIndex, startUnit] of [42, 38, 34].entries()) {
      const switchNumber = rackIndex * 3 + switchIndex + 1;
      const device = await prisma.device.create({
        data: {
          name: `SW-${rackName.replace(" ", "")}-${switchIndex + 1}`,
          deviceType: "Network Switch",
          brand: switchIndex % 2 === 0 ? "Cisco" : "Aruba",
          model: "48-Port PoE Sample",
          ipAddress: `10.10.${rackIndex + 1}.${10 + switchIndex}`,
          macAddress: `00:11:22:33:${String(rackIndex + 1).padStart(2, "0")}:${String(switchIndex + 1).padStart(2, "0")}`,
          firmwareVersion: "1.0.0",
          softwareVersion: "NX-Phase1",
          serialNumber: `SN-P1-${switchNumber.toString().padStart(4, "0")}`,
          installationDate: new Date("2026-01-15"),
          location: `${hubRoom.name} / ${rackName}`,
          notes: "Dummy switch for clickable Phase 1 prototype.",
          rackId: rack.id,
          startUnit,
          heightUnits: 1,
        },
      });

      await prisma.rackUnit.updateMany({
        where: { rackId: rack.id, unitNumber: startUnit },
        data: { type: RackUnitType.SWITCH, label: device.name, deviceId: device.id },
      });

      for (let port = 1; port <= 10; port += 1) {
        const connected = port <= 5;
        await prisma.switchPort.create({
          data: {
            deviceId: device.id,
            portNumber: port,
            portLabel: `Port ${port}`,
            status: connected ? PortStatus.CONNECTED : PortStatus.DISCONNECTED,
            connectedDeviceName: connected ? `Sample Device ${switchNumber}-${port}` : null,
            macAddress: connected ? `AA:BB:CC:${switchNumber.toString().padStart(2, "0")}:00:${port.toString().padStart(2, "0")}` : null,
            cableLabel: connected ? `PP-${rackName.slice(-1)}-${port.toString().padStart(2, "0")}` : null,
            patchPanel: connected ? `Patch Panel ${rackName.slice(-1)}` : null,
            vlan: connected ? "VLAN-10" : null,
            speed: connected ? "1G" : null,
            duplex: connected ? "Full" : null,
            description: connected ? "Sample connected endpoint" : null,
            notes: connected ? "Seeded sample connection" : null,
          },
        });
      }
    }
  }

  console.log("Seed completed. Login: admin@example.com / admin123");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
