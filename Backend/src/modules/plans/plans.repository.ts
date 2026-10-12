import { Pool, PoolClient } from "pg";
import { Feature, Plan } from "../../config/plans";

// Reads of the price list (plan_catalog). Shaped the way the API returns it,
// prices in paise.

type Db = Pool | PoolClient;

export interface PlanInfo {
  id: Plan;
  name: string;
  tagline: string;
  price: { monthly: number; yearly: number };
  maxRooms: number;
  maxMembersPerRoom: number;
  maxListings: number;
  unlimited: boolean;
  features: Record<Feature, boolean>;
  support: string;
}

export interface PlanRow {
  id: Plan;
  name: string;
  tagline: string;
  price_monthly_paise: number;
  price_yearly_paise: number;
  max_rooms: number;
  max_members_per_room: number;
  max_listings: number;
  unlimited: boolean;
  feature_room_fund: boolean;
  feature_bill_sections: boolean;
  feature_find_room: boolean;
  support: string;
}

export const toPlanInfo = (r: PlanRow): PlanInfo => ({
  id: r.id,
  name: r.name,
  tagline: r.tagline,
  price: { monthly: r.price_monthly_paise, yearly: r.price_yearly_paise },
  maxRooms: r.max_rooms,
  maxMembersPerRoom: r.max_members_per_room,
  maxListings: r.max_listings,
  unlimited: r.unlimited,
  features: { roomFund: r.feature_room_fund, billSections: r.feature_bill_sections, findRoom: r.feature_find_room },
  support: r.support,
});

export async function listPlans(db: Db): Promise<PlanInfo[]> {
  const { rows } = await db.query<PlanRow>("SELECT * FROM plan_catalog ORDER BY sort_order");
  return rows.map(toPlanInfo);
}

export async function getPlan(db: Db, id: Plan): Promise<PlanInfo> {
  const { rows } = await db.query<PlanRow>("SELECT * FROM plan_catalog WHERE id = $1", [id]);
  return toPlanInfo(rows[0]);
}
