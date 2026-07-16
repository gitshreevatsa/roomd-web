// Shared between roomd and roomd-web

export type ContextType =
  | "api_contract"
  | "arch_decision"
  | "task"
  | "change_request"
  | "note";

export type TaskStatus = "pending" | "in_progress" | "done" | "blocked";

export interface ContextEntry {
  id: string;
  type: ContextType;
  author: string;
  timestamp: string;
  summary: string;
  consuming_agents: string[];
  payload: Record<string, unknown>;
  version: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  owner: string | null;
  created_at: string;
  updated_at: string;
  depends_on: string[];
}

export interface Plan {
  project: string;
  created_at: string;
  updated_at: string;
  tasks: Task[];
}

export interface Event {
  id: string;
  type: string;
  from: string;
  to: string | "all";
  payload: Record<string, unknown>;
  timestamp: string;
  read_by: string[];
  reply_to_id?: string;
}

export type AgentOnlineStatus = "online" | "offline";

export interface AgentPresence {
  agentId: string;
  status: AgentOnlineStatus;
  lastSeen: string | null;
}

// roomd-web own types

export interface UserRecord {
  id: string;
  email?: string;
  name?: string;
  passwordHash?: string;
  teamId: string;
  apiKey: string;
  authMethods: ("apikey" | "email" | "google" | "github")[];
  createdAt: string;
}

export interface RoomMeta {
  roomId: string;
  name: string;
  createdBy: string;
  createdAt: string;
}

export interface DynKey {
  keyId: string;
  secret?: string;
  hint: string;
  teamId: string;
  createdAt: string;
  note?: string;
}

export interface InviteToken {
  tokenId: string;
  token?: string;
  hint: string;
  roomId: string;
  createdAt: string;
  expiresAt?: string;
}

export interface RoomSummary {
  roomId: string;
  name: string;
  agents: string[];
  taskCount: number;
  doneTasks: number;
  contextCount: number;
  lastActivity: string | null;
  agentsOnline: number;
}

export interface WaitlistEntry {
  email: string;
  status: "pending" | "invited" | "declined";
  createdAt: string;
  invitedAt?: string;
  declinedAt?: string;
  teamId?: string;
}
