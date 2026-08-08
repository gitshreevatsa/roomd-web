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
  /** Primary / active team (convenience). Memberships are the source of truth. */
  teamId: string;
  /** This user's own roomd bearer key — never overwritten by another person's login. */
  apiKey: string;
  authMethods: ("apikey" | "email" | "google" | "github")[];
  createdAt: string;
  /** Operator disabled the account; dashboard login blocked until cleared. */
  disabledAt?: string;
  /**
   * Explicit platform-operator flag (Identity v2).
   * Authorisation uses this flag (plus OPERATOR_USER_IDS break-glass), not a
   * live compare of apiKey === ROOMD_MASTER_KEY.
   */
  isOperator?: boolean;
  /** Billing plan for hard caps / Stripe. */
  plan?: "free" | "team" | "enterprise";
  stripeCustomerId?: string;
  /** Hex-encoded TOTP secret when operator MFA is enrolled. */
  totpSecret?: string;
  totpEnabledAt?: string;
}

/** User ↔ Team join (Identity v2). One human can belong to multiple teams. */
export interface MembershipRecord {
  userId: string;
  teamId: string;
  role: "owner" | "member";
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
  /** Credential-bound agent id for review/approve (roomd). */
  boundAgentId?: string;
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
  status: "pending" | "invited" | "declined" | "revoked";
  createdAt: string;
  invitedAt?: string;
  declinedAt?: string;
  revokedAt?: string;
  teamId?: string;
  keyId?: string;
}

/** Response status from POST /api/waitlist (collapsed to avoid enumeration). */
export type WaitlistJoinStatus = "ok";

/** Direct org invites issued from Owner → Invite (never mixed into waitlist). */
export interface OrgInviteEntry {
  email: string;
  status: "pending_delivery" | "delivered" | "revoked";
  teamId: string;
  keyId: string;
  keyHint: string;
  createdAt: string;
  deliveredAt?: string;
  delivery?: "email" | "copy";
  revokedAt?: string;
}
