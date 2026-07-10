# Network Rack Management System

A responsive web application for managing office hub rooms, rack layouts, network switches, power supplies, cable managers, switch ports, QR stickers, cable trace data, and audit history.

The app is built for desktop and mobile browsers so IT staff can update rack and port information directly from a phone after scanning a QR sticker.

## Current Stack

- Frontend: React, Vite, TypeScript, Tailwind CSS
- UI: reusable shadcn-style components, Lucide icons, light/dark mode
- Backend: Node.js, Express.js
- Database: PostgreSQL
- ORM: Prisma
- Authentication: JWT login
- Runtime: Docker Compose

## Main Features

- Dashboard with building, block, floor, and hub room navigation
- Editable infrastructure map
- Hub room graphical layout
- Rack view with 42U/45U style unit placement
- Add, rename, delete racks
- Add switches, cable managers, and power supply modules
- 1U and 2U device placement with automatic rack unit occupation
- Switch front panel with configurable RJ45 and SFP ports
- Editable port connection details
- Power supply socket view
- Cable trace search
- Master data page
- Excel/CSV import and export
- QR code page for hub rooms, racks, and devices
- Printable QR sticker sheet layout
- Fixed QR base URL setting for permanent office server links
- User role management UI
- Alerts and notifications starter module
- SNMP/LLDP discovery placeholder module
- Audit logs for create, update, delete, and port changes
- Admin protection for destructive actions

## Default Login

```text
Email: admin@example.com
Password: admin123
```

Change these before using the application in a real office.

## Docker Setup

From the project folder:

```powershell
cd "C:\Vijay's Projects\Ethernrt port AR Scanning"
docker compose up -d --build
```

Open the application:

```text
http://127.0.0.1:5173
```

Backend API:

```text
http://127.0.0.1:4000
```

PostgreSQL:

```text
Host: 127.0.0.1
Port: 5432
Database: rack_manager
User: rackadmin
Password: rackpassword
```

## First-Time Database Setup

If the database is new or empty, run:

```powershell
docker compose exec server npx prisma db push
docker compose exec server npm run seed
```

Then log in with the default admin account.

## Useful Docker Commands

Start or rebuild:

```powershell
docker compose up -d --build
```

Stop:

```powershell
docker compose down
```

View containers:

```powershell
docker compose ps
```

View server logs:

```powershell
docker compose logs -f server
```

## Mobile Phone Testing

Your current Windows Wi-Fi IP address is:

```text
192.168.29.134
```

To test from your mobile phone:

1. Keep Docker running on the laptop/PC.
2. Connect the mobile phone to the same Wi-Fi network as the laptop/PC.
3. Open this URL on the phone browser:

```text
http://192.168.29.134:5173
```

4. Log in with:

```text
admin@example.com
admin123
```

5. Open the QR page from the top navigation.
6. Scan or open a QR code. It should open the matching hub room, rack, or device page.

If the phone cannot open the site:

- Check that the phone and laptop are on the same Wi-Fi.
- Check Windows Firewall and allow Docker/Desktop or port `5173`.
- Run `ipconfig` again and confirm the Wi-Fi IPv4 address has not changed.
- Use the new IP address in this format:

```text
http://YOUR-WIFI-IP:5173
```

Important: `127.0.0.1` works only on the same computer. A phone must use the laptop/PC Wi-Fi IP address.

## Office Linux Server Deployment

For real office use, the recommended setup is to install this application on the Linux CLI server that is connected to the office LAN.

On the Linux server:

```bash
git clone https://github.com/vjs-19/network-rack-mgmt.git
cd network-rack-mgmt
docker compose up -d --build
```

If the database is new, initialize it:

```bash
docker compose exec server npx prisma db push
docker compose exec server npm run seed
```

Find the Linux server IP address:

```bash
ip addr
```

Office users can then open the application from any LAN-connected desktop or laptop:

```text
http://SERVER-IP:5173
```

Example:

```text
http://10.10.1.25:5173
```

### QR Codes In Office Network

For physical rack QR stickers, open the QR page using the Linux server IP address:

```text
http://SERVER-IP:5173/qr-codes
```

Then print the rack QR codes and stick each QR code on its matching physical rack.

When scanned, the QR code should open:

```text
http://SERVER-IP:5173/racks/RACK_ID
```

Important: if the office network has no Wi-Fi, normal mobile phones cannot open the QR link unless they are connected to the same office network through an approved Wi-Fi, VPN, or managed device network. The QR code itself will still be correct, but the phone must have network access to the Linux server.

Recommended office options:

- Use office desktop/laptop browsers to access the rack pages.
- Use an approved internal Wi-Fi or authorized tablet connected to the LAN.
- Use VPN access if the IT policy allows mobile access to internal services.
- Use a DNS name such as `http://rackmanager.office.local:5173` instead of a raw IP if your IT team can create it.

For stable QR stickers, avoid printing QRs with temporary addresses like `127.0.0.1` or a laptop IP. Use the permanent Linux server IP address or office DNS name.

## Application Workflow

```text
Dashboard
-> Building / Block
-> Hub Room
-> Rack Layout
-> Rack
-> Device
-> Switch Ports / Power Sockets
```

## QR Code Workflow

Open:

```text
/qr-codes
```

QR codes are generated for:

- Hub Rooms
- Racks
- Devices

Expected behavior:

- Hub Room QR opens the selected hub room layout.
- Rack QR opens the selected rack view.
- Device QR opens the selected device or switch details.

For office use, print the QR and stick it on the actual rack, switch, or hub room door.

Use **Print Sheet** on the QR page to print clean white QR sticker cards.

### Fixed QR Base URL

Open:

```text
/admin
```

Set the QR base URL to the permanent office server address:

```text
http://SERVER-IP:5173
```

or:

```text
http://rackmanager.office.local:5173
```

After saving this value, all QR codes encode that fixed address instead of depending on the browser address used to open the app.

## Rack Device Rules

When adding a rack device:

- Select device type.
- Select top U position.
- Select height as 1U or 2U.

For example:

```text
Power Supply 2U at U45
```

The app automatically occupies:

```text
U45 and U44
```

This same rule applies to switches, patch panels, cable managers, and power supply modules.

## Switch Port Configuration

When adding a switch, enter:

- Copper RJ45 port count
- Fiber SFP port count

Examples:

```text
48 RJ45 + 4 SFP
24 SFP + 4 RJ45
24 RJ45 + 2 SFP
```

The application creates the correct switch front panel from the entered counts.

## Cable Trace

Open:

```text
/trace
```

You can search by:

- Device name
- MAC address
- IP address
- Cable label
- Patch panel
- VLAN
- Switch name
- Switch port

The result shows the connection path and device/port details.

## Excel Import / Export

Open:

```text
/import-export
```

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

Note: The dashboard no longer requires typing a floor name when creating hub rooms manually. For import, `floorLevel` is the important value.

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
copperPortCount
sfpPortCount
notes
```

Useful `deviceType` values:

```text
SWITCH
PATCH_PANEL
CABLE_MANAGER
POWER_SUPPLY
SERVER
FIREWALL
ROUTER
UPS
OTHER
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

Useful `portType` values:

```text
RJ45
SFP
POWER_SOCKET
```

Allowed `status` values:

```text
CONNECTED
DISCONNECTED
DISABLED
UNKNOWN
```

## Admin And Audit

Open:

```text
/audit-logs
```

Audit logs record:

- Create actions
- Update actions
- Delete actions
- Port edits
- Connection clearing

Delete and other destructive actions require an admin user.

### User Role Management

Open:

```text
/admin
```

Admins can:

- Create users
- Edit name, email, and role
- Delete users
- Set roles as `admin`, `editor`, or `viewer`

Current backend enforcement protects admin-only destructive actions. More detailed per-role permissions can be expanded later.

## Alerts

Open:

```text
/alerts
```

The alerts module currently supports:

- Manual alert creation
- Severity: `info`, `warning`, `critical`
- Open/resolved status
- Delete alerts

Future live monitoring can create alerts automatically from SNMP, ping, port status, or discovery checks.

## Discovery Placeholder

Open:

```text
/discovery
```

The discovery module currently runs dummy SNMP/LLDP sample data only. It creates:

- Sample switch port status
- Sample MAC table style data
- Sample LLDP neighbor data
- A related alert
- An audit log record

Real SNMP/LLDP discovery needs office switch details:

- Switch management IPs
- SNMP version
- SNMP community or credentials
- LLDP/CDP availability
- Linux server network access to the switch management VLAN

## Development Without Docker

Install dependencies:

```powershell
npm install
```

Generate Prisma client:

```powershell
npm run prisma:generate
```

Run development servers:

```powershell
npm run dev
```

Frontend:

```text
http://127.0.0.1:5173
```

Backend:

```text
http://127.0.0.1:4000
```

Docker is recommended for normal testing because it starts PostgreSQL, backend, and frontend together.

## Future Upgrade Ideas

The database and code are prepared for future modules such as:

- SNMP discovery
- LLDP/CDP neighbor discovery
- Live switch port status
- Ping online/offline checks
- Alerts and notifications
- More detailed audit reports
- User roles and permissions
- Real rack drawing calibration
- Printable QR sticker sheets

These are planned future integrations for production environments that need live network monitoring.
