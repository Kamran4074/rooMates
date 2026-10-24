export type RoomType = "roommates" | "trip";

export interface Room {
  id: string;
  name: string;
  type: RoomType;
  /** Only sent to the room admin; null for everyone else. */
  invite_code: string | null;
  my_role: "admin" | "member";
  created_at: string;
}

/** GET /api/rooms/:id also returns the room's totals. */
export interface RoomDetail extends Room {
  expense_count: number;
  total_spent_paise: number;
  /** Size limit from the room owner's plan. */
  member_count: number;
  max_members: number;
  plan: PlanId;
}

/** A room as returned by GET /api/rooms, with the caller's balance in it. */
export interface RoomListItem extends Room {
  /** Net balance in paise: positive = I'm owed, negative = I owe. */
  my_net_paise: number;
}

export interface Member {
  user_id: string;
  role: "admin" | "member";
  name: string;
  email: string;
  picture: string | null;
}

export interface Expense {
  id: string;
  description: string;
  amount_paise: string;
  paid_by: string;
  paid_by_name: string;
  /** The day it was spent (YYYY-MM-DD), chosen when adding it. */
  expense_date: string;
  /** Who added it: they (or the room admin) may delete it. */
  created_by: string;
  created_at: string;
  /** The bill section it was filed under (Rent, Groceries...), if any. */
  category_name: string | null;
  /** How many people it's split between. */
  shared_by: number;
}

/** A bill section of a room and who shares it (GET /api/rooms/:id/categories). */
export interface Category {
  id: string;
  name: string;
  member_ids: string[];
}

export interface Balance {
  userId: string;
  name: string;
  netPaise: number;
}

export interface Settlement {
  fromUserId: string;
  toUserId: string;
  amountPaise: number;
  fromName: string;
  toName: string;
}

/** A recorded settle-up payment (GET /api/rooms/:id/settlements). Amount in paise. */
export interface Payment {
  id: string;
  from_user_id: string;
  from_name: string;
  to_user_id: string;
  to_name: string;
  amount_paise: number;
  /** YYYY-MM-DD */
  settled_on: string;
  note: string | null;
  created_by: string;
  created_at: string;
}

export interface RoomBalances {
  balances: Balance[];
  settlements: Settlement[];
}

/** A pooled-money fund ("kitty") as listed by GET /api/rooms/:id/funds. All amounts in paise. */
export interface Fund {
  id: string;
  name: string;
  perMemberPaise: number;
  collectorId: string;
  status: "open" | "closed";
  closedAt: string | null;
  createdAt: string;
  expectedPaise: number;
  /** Confirmed money only. */
  collectedPaise: number;
  /** Recorded by members, not yet confirmed by the collector. */
  awaitingConfirmationPaise: number;
  spentPaise: number;
  balancePaise: number;
  pendingPaise: number;
}

export interface FundMember {
  userId: string;
  name: string;
  picture: string | null;
  paidPaise: number;
  awaitingPaise: number;
  pendingPaise: number;
}

/** contribution/spend while open; refund (collector -> member) and collection (member -> collector) when closed. */
export interface FundEntry {
  id: string;
  kind: "contribution" | "spend" | "refund" | "collection";
  member_id: string | null;
  member_name: string | null;
  amount_paise: number;
  note: string | null;
  /** Money actually changed hands: payment confirmed by the collector, or settlement done. */
  confirmed: boolean;
  created_by: string;
  created_by_name: string | null;
  created_at: string;
  /** Who agreed it's right, and when (the other side of the payment). */
  confirmed_by_name: string | null;
  confirmed_at: string | null;
  /** The member said the collector's record about them is wrong. Never counts; kept as a record. */
  disputed_at: string | null;
  disputed_by_name: string | null;
  dispute_note: string | null;
}

/** A payment the collector/admin recorded for me, waiting for my approval (GET /api/fund-approvals). */
export interface FundApproval {
  id: string;
  fund_id: string;
  fund_name: string;
  room_id: string;
  room_name: string;
  room_type: RoomType;
  amount_paise: number;
  note: string | null;
  created_at: string;
  created_by: string;
  recorded_by_name: string;
}

export interface FundDetail extends Fund {
  collector: { id: string; name: string; picture: string | null };
  /** I'm the collector or the room admin. */
  canManage: boolean;
  members: FundMember[];
  entries: FundEntry[];
}

export interface FundClosePreview {
  spentPaise: number;
  sharePerPersonPaise: number;
  unconfirmedPayments: number;
  lines: { userId: string; name: string; paidPaise: number; sharePaise: number; netPaise: number; isCollector: boolean }[];
  transfers: { userId: string; name: string; kind: "refund" | "collection"; amountPaise: number }[];
}

// ---------------- Listings ----------------

export type ListingStatus = "draft" | "pending" | "published" | "rejected" | "rented" | "removed";
export type RoomTypeOption = "private_room" | "shared_room" | "entire_flat";
export type Furnishing = "furnished" | "semi_furnished" | "unfurnished";
export type RequestStatus = "pending" | "accepted" | "rejected";

/** A listing as shown in lists/cards. Rent in paise. */
export interface ListingCard {
  id: string;
  title: string;
  rent_paise: number;
  room_type: RoomTypeOption;
  furnishing: Furnishing;
  locality: string;
  city: string;
  pincode: string;
  available_from: string;
  status: ListingStatus;
  is_mine: boolean;
  cover_url: string | null;
  created_at: string;
  distance_km?: number;
  pending_requests?: number;
  rejection_reason?: string | null;
}

export interface ListingImage {
  id: string;
  url: string;
  is_primary: boolean;
}

export interface ListingDetail extends Omit<ListingCard, "cover_url"> {
  description: string;
  amenities: string[];
  state: string;
  latitude: number | null;
  longitude: number | null;
  rejection_reason: string | null;
  updated_at: string;
  images: ListingImage[];
  /** Owner only. */
  request_counts?: Partial<Record<RequestStatus, number>>;
  /** Everyone else: whether they've already sent a request. */
  my_request_status?: RequestStatus | null;
}

export interface SentRequest {
  id: string;
  status: RequestStatus;
  message: string | null;
  created_at: string;
  listing_id: string;
  listing_title: string;
  listing_city: string;
  listing_locality: string;
  listing_rent_paise: number;
  listing_status: ListingStatus;
  owner_name: string | null;
  owner_phone: string | null;
  owner_email: string | null;
}

export interface ReceivedRequest {
  id: string;
  status: RequestStatus;
  message: string | null;
  created_at: string;
  listing_id: string;
  listing_title: string;
  listing_status: ListingStatus;
  requester_name: string | null;
  requester_picture: string | null;
  requester_phone: string | null;
  requester_email: string | null;
}

export interface MyExpense {
  id: string;
  description: string;
  amount_paise: number;
  my_share_paise: number;
  expense_date: string;
  created_at: string;
  paid_by: string;
  paid_by_name: string;
  room_id: string;
  room_name: string;
  room_type: RoomType;
  category_name: string | null;
}

export interface MonthSummary {
  month: string;
  expenseCount: number;
  totalPaise: number;
  iPaidPaise: number;
  mySharePaise: number;
  netPaise: number;
}

export interface Me {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  picture: string | null;
  onboarding_completed: boolean;
  plan: PlanId;
  max_rooms: number;
  max_members_per_room: number;
  room_count: number;
  /** False for Google-only accounts: deleting then needs no password. */
  has_password: boolean;
}

// ---------------- Admin ----------------

/** A row in the super admin's users list. */
/** A person in a group, as the admin console shows them. */
export interface AdminGroupMember {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  picture: string | null;
  role: "admin" | "member";
  joined_at: string;
  last_active_at: string | null;
  suspended_at: string | null;
  deleted_at: string | null;
}

/** A row of the admin Groups tab (GET /api/admin/rooms). */
export interface AdminGroup {
  id: string;
  name: string;
  type: RoomType;
  created_at: string;
  created_by_name: string | null;
  /** Who runs it now - may differ from the creator after a hand-over. */
  owner_id: string | null;
  owner_name: string | null;
  owner_email: string | null;
  owner_picture: string | null;
  member_count: number;
  members: AdminGroupMember[];
  expense_count: number;
  total_spent_paise: number;
  last_expense_at: string | null;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  picture: string | null;
  role: "user" | "super_admin";
  suspended_at: string | null;
  /** Set when an admin deleted (anonymised) the account. */
  deleted_at: string | null;
  created_at: string;
  /** Last sign-in or session refresh. */
  last_active_at: string | null;
  has_google: boolean;
  has_password: boolean;
  /** Finished onboarding (name + phone). */
  onboarding_completed: boolean;
  plan: PlanId;
  listing_count: number;
  room_count: number;
  /** Groups they run (they're the room admin). */
  owned_group_count: number;
  /** Distinct other people in the groups they run. */
  people_in_groups: number;
}

/** GET /api/admin/users/:id */
export interface AdminUserDetail extends Omit<AdminUser, "listing_count" | "room_count" | "owned_group_count" | "people_in_groups"> {
  email_verified: boolean;
  max_rooms: number;
  max_members_per_room: number;
  plan_expires_at: string | null;
  active_sessions: number;
  rooms: { id: string; name: string; type: RoomType; role: "admin" | "member"; joined_at: string; member_count: number; net_paise: number }[];
  listings: { id: string; title: string; status: ListingStatus; city: string; created_at: string }[];
  history: { id: string; action: string; details: Record<string, unknown> | null; created_at: string; admin_name: string | null }[];
}

export type OnboardingStage = "email_verified" | "profile_completed" | "joined_group" | "first_expense" | "activated";

/** A row in the onboarding tracker (GET /api/admin/onboarding). */
export interface OnboardingUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  picture: string | null;
  created_at: string;
  last_active_at: string | null;
  email_verified_at: string | null;
  onboarding_completed_at: string | null;
  joined_group_at: string | null;
  first_expense_at: string | null;
  /** The first step they haven't done yet. */
  stage: OnboardingStage;
  /** Days since their last completed step; null once activated. */
  days_waiting: number | null;
  dormant: boolean;
}

export interface OnboardingCounts {
  signed_up: number;
  email_verified: number;
  profile_completed: number;
  joined_group: number;
  first_expense: number;
  stuck: number;
  activated: number;
  dormant: number;
  waiting_email_verified: number;
  waiting_profile_completed: number;
  waiting_joined_group: number;
  waiting_first_expense: number;
}

export type ActivityType =
  | "expense_added"
  | "expense_deleted"
  | "payment_recorded"
  | "payment_deleted"
  | "fund_opened"
  | "fund_closed"
  | "fund_payment_recorded"
  | "fund_payment_approved"
  | "fund_payment_disputed"
  | "fund_spend"
  | "fund_settled"
  | "member_joined"
  | "member_left"
  | "member_removed"
  | "join_requested"
  | "join_rejected";

/** One row of the activity feed (GET /api/notifications), written by database triggers. */
export interface ActivityEvent {
  id: string;
  type: ActivityType;
  room_id: string;
  room_name: string;
  room_type: RoomType;
  actor_id: string | null;
  actor_name: string | null;
  subject_id: string | null;
  subject_name: string | null;
  to_name: string | null;
  amount_paise: number | null;
  data: {
    description?: string;
    category?: string | null;
    fund?: string;
    fund_id?: string;
    note?: string | null;
    confirmed?: boolean;
    kind?: string;
    /** join_requested: the requester's name (they aren't a member yet). */
    name?: string;
  };
  created_at: string;
  /** Someone else did it after I last opened the feed. */
  unread: boolean;
}

/** One open fund in my rooms, from my side (GET /api/funds/summary). Amounts in paise. */
export interface FundStatus {
  fundId: string;
  fundName: string;
  roomId: string;
  roomName: string;
  perMemberPaise: number;
  collector: { id: string; name: string };
  /** I'm the collector or the room admin. */
  canManage: boolean;
  expectedPaise: number;
  collectedPaise: number;
  balancePaise: number;
  /** null if I'm not in this fund. duePaise = not paid and not already waiting for a confirmation. */
  me: { paidPaise: number; awaitingPaise: number; duePaise: number } | null;
  /** Managers only: who still owes, biggest first. */
  toCollect: { userId: string; name: string; duePaise: number; awaitingPaise: number }[];
  /** Members' own records waiting for my confirmation (managers). */
  toConfirm: number;
  /** Records the collector made for me, waiting for my approval. */
  toApprove: number;
}

/** A month's spending in one bill section (GET /api/expenses/by-category). */
export interface CategorySpend {
  /** null = no section. */
  category: string | null;
  totalPaise: number;
  mySharePaise: number;
  expenseCount: number;
}

/** GET /api/rooms/join-requests */
export interface JoinRequests {
  /** Mine, waiting for a room admin. */
  mine: { id: string; room_id: string; room_name: string; room_type: RoomType; created_at: string }[];
  /** Others', for rooms I run, waiting for me. */
  toApprove: { id: string; room_id: string; room_name: string; user_id: string; name: string; email: string; picture: string | null; created_at: string }[];
}

// ---------------- Plans ----------------

export type PlanId = "basic" | "standard" | "premium";
export type PaidPlanId = Exclude<PlanId, "basic">;
export type BillingCycle = "monthly" | "yearly";
export type PlanFeature = "roomFund" | "billSections" | "findRoom";

/** GET /api/plans - one plan in the price list. Prices in paise. */
export interface PlanInfo {
  id: PlanId;
  name: string;
  tagline: string;
  price: Record<BillingCycle, number>;
  maxRooms: number;
  maxMembersPerRoom: number;
  maxListings: number;
  unlimited: boolean;
  features: Record<PlanFeature, boolean>;
  support: string;
}

export interface UpgradeRequest {
  id: string;
  plan: PaidPlanId;
  billing_cycle: BillingCycle;
  amount_paise: number;
  phone: string;
  note: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  created_at: string;
  decided_at: string | null;
  admin_note: string | null;
}

/** GET /api/plans/me */
export interface MyPlan {
  plan: PlanId;
  /** When a paid plan ends (then it's Basic again); null = no end. */
  expiresAt: string | null;
  limits: { maxRooms: number; maxMembersPerRoom: number; maxListings: number };
  features: Record<PlanFeature, boolean>;
  usage: { rooms: number; listings: number };
  latestRequest: UpgradeRequest | null;
}

/** GET /api/admin/upgrade-requests */
export interface AdminUpgradeRequest extends UpgradeRequest {
  user_id: string;
  name: string;
  email: string;
  picture: string | null;
  current_plan: PlanId;
  plan_expires_at: string | null;
  decided_by_name: string | null;
}
