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
  plan: "free" | "paid";
  max_rooms: number;
  room_count: number;
}

// ---------------- Admin ----------------

/** A row in the super admin's users list. */
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
  listing_count: number;
  room_count: number;
}

/** GET /api/admin/users/:id */
export interface AdminUserDetail extends Omit<AdminUser, "listing_count" | "room_count"> {
  email_verified: boolean;
  onboarding_completed: boolean;
  plan: "free" | "paid";
  max_rooms: number;
  active_sessions: number;
  rooms: { id: string; name: string; type: RoomType; role: "admin" | "member"; joined_at: string; member_count: number; net_paise: number }[];
  listings: { id: string; title: string; status: ListingStatus; city: string; created_at: string }[];
  history: { id: string; action: string; details: Record<string, unknown> | null; created_at: string; admin_name: string | null }[];
}
