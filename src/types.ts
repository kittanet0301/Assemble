export type Status = 'available' | 'focus' | 'away' | 'office';
export type LegacyAppearance = {
  skin: number;
  hairStyle: number;
  hairColor: number;
  shirtStyle: number;
  shirtColor: number;
  pantsColor: number;
};
export type ZepSlot = 'skin' | 'face' | 'clothes' | 'hair' | 'mask' | 'glasses';
export type ZepAppearance = { source: 'zep' } & Record<ZepSlot, number>;
export type Appearance = LegacyAppearance | ZepAppearance;
export type User = {
  id: string;
  name: string;
  role: 'admin' | 'member' | 'guest';
  avatar: string;
  appearance?: Appearance;
  status: Status;
  seat: string | null;
  email?: string;
  roomScope?: string;
};
export type GridMotion = {
  from: { x: number; y: number };
  to: { x: number; y: number };
  startedAt: number;
  durationMs: number;
  roomId: string | null;
};
export type Peer = User & {
  x: number;
  y: number;
  motion: GridMotion | null;
  roomId: string | null;
  direction: string;
  moving: boolean;
};
export type RoomInfo = {
  id: string;
  name: string;
  subtitle: string;
  color: string;
  count: number;
  capacity: number;
  x: number;
  y: number;
  w: number;
  h: number;
};
export type Snapshot = {
  serverTime: number;
  selfId: string;
  peers: Peer[];
  directory: User[];
  rooms: RoomInfo[];
};
export type Message = {
  id: string;
  senderId: string;
  name: string;
  avatar: string;
  appearance?: Appearance;
  channel: string;
  text: string;
  createdAt: number;
};
export type Config = {
  officeName: string;
  orgName: string;
  demo: boolean;
  preview?: boolean;
  providers: string[];
  mediaEnabled: boolean;
  maxOnline: number;
  roomCapacity: number;
};
export type Send = (value: Record<string, unknown>) => void;
