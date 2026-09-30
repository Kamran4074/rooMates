export type RoomType = "roommates" | "trip";

export interface Room {
  id: string;
  name: string;
  type: RoomType;
  invite_code: string;
  created_at: string;
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

export interface RoomBalances {
  balances: Balance[];
  settlements: Settlement[];
}

export interface MyExpense {
  id: string;
  description: string;
  amount_paise: number;
  my_share_paise: number;
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
