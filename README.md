# Network Rack Management System

A Phase 1 prototype for digitally managing hub rooms, racks, network switches, and switch ports.

## Stack

- React + Vite + TypeScript
- Tailwind CSS with shadcn-style reusable UI components
- Node.js + Express.js
- PostgreSQL + Prisma
- JWT login
- REST APIs

## Phase 1 Dummy Data

The seed creates:

- 1 building
- 1 block
- 1 floor
- 1 hub room
- 3 racks
- 3 switches per rack
- 10 ports per switch
- first 5 ports connected to sample devices
- last 5 ports empty

## Local Setup

```powershell
npm install
copy server\.env.example server\.env
npm run prisma:generate
npm run seed
npm run dev
```

Open:

```text
http://localhost:5173
```

Login:

```text
admin@example.com
admin123
```

## Docker Setup

```powershell
docker compose up --build
```

Then seed the database:

```powershell
docker compose exec server npx prisma db push
docker compose exec server npm run seed
```

Open:

```text
http://localhost:5173
```

## Main Workflow

Dashboard -> Blocks -> Floors -> Hub Room -> Rack Layout -> Rack -> Network Switch -> Switch Ports

## Excel Import / Export

Open **Import** in the top navigation.

Recommended import order:

1. Locations
2. Racks
3. Devices / Switches
4. Switch Ports

### Locations Columns

```text
buildingName
blockName
floorName
floorLevel
hubRoomName
hubRoomType
hubRoomNotes
```

### Racks Columns

```text
buildingName
blockName
floorName
hubRoomName
rackName
unitCount
positionX
positionY
notes
```

### Devices / Switches Columns

```text
hubRoomName
rackName
deviceName
deviceType
brand
model
ipAddress
macAddress
firmwareVersion
softwareVersion
serialNumber
installationDate
location
startUnit
heightUnits
notes
```

### Switch Ports Columns

```text
switchName
portNumber
portLabel
portType
status
connectedDeviceName
macAddress
cableLabel
patchPanel
vlan
speed
duplex
description
notes
```

Allowed `status` values:

```text
CONNECTED
DISCONNECTED
DISABLED
UNKNOWN
```

QR URLs are supported for hub rooms and racks:

- `/hub-rooms/:id`
- `/racks/:id`

Scanning those URLs from a mobile browser opens the correct page.
