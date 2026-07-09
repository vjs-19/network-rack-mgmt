export type PortStatus = "CONNECTED" | "DISCONNECTED" | "DISABLED" | "UNKNOWN";

export type SwitchPort = {
  id: string;
  portNumber: number;
  portLabel: string;
  portType: string;
  status: PortStatus;
  connectedDeviceName: string | null;
  macAddress: string | null;
  cableLabel: string | null;
  patchPanel: string | null;
  vlan: string | null;
  speed: string | null;
  duplex: string | null;
  description: string | null;
  notes: string | null;
};

export type Device = {
  id: string;
  name: string;
  deviceType: string;
  brand: string | null;
  model: string | null;
  ipAddress: string | null;
  macAddress: string | null;
  firmwareVersion: string | null;
  softwareVersion: string | null;
  serialNumber: string | null;
  installationDate: string | null;
  location: string | null;
  notes: string | null;
  startUnit: number;
  heightUnits: number;
  ports: SwitchPort[];
};

export type RackUnit = {
  id: string;
  unitNumber: number;
  label: string;
  type: string;
  device: Device | null;
};

export type Rack = {
  id: string;
  name: string;
  unitCount: number;
  positionX: number;
  positionY: number;
  layoutImage: string | null;
  notes: string | null;
  devices: Device[];
  rackUnits: RackUnit[];
};

export type HubRoom = {
  id: string;
  name: string;
  type: string;
  layoutImage: string | null;
  notes: string | null;
  racks: Rack[];
  floor: { id: string; name: string; block: { id: string; name: string; building?: { name: string } } };
};
