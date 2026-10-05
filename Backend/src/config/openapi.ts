import { OpenAPIRegistry, OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import {
  googleLoginSchema,
  signupSchema,
  loginSchema,
  refreshSchema,
  emailOnlySchema,
  verifyEmailSchema,
  resetPasswordSchema,
} from "../modules/auth/auth.schema";
import { createRoomSchema, joinRoomSchema } from "../modules/rooms/rooms.schema";
import { createExpenseSchema, monthExpensesQuerySchema, monthlySummaryQuerySchema } from "../modules/expenses/expenses.schema";
import { profileSchema } from "../modules/users/users.schema";
import { contactSchema } from "../modules/contact/contact.schema";
import { contributionSchema, createFundSchema, spendSchema } from "../modules/funds/funds.schema";
import {
  createListingSchema,
  listingStatusActionSchema,
  myListingsQuery,
  nearbyListingsQuery,
  reportListingSchema,
  saveImageSchema,
  searchListingsQuery,
  updateListingSchema,
  ROOM_TYPES,
  FURNISHING,
} from "../modules/listings/listings.schema";
import { createRequestSchema, receivedRequestsQuery, respondToRequestSchema, sentRequestsQuery } from "../modules/requests/requests.schema";
import { listingsQuery, reasonSchema, reportsQuery, resolveReportSchema, roomsQuery, usersQuery } from "../modules/admin/admin.schema";

const registry = new OpenAPIRegistry();

const bearerAuth = registry.registerComponent("securitySchemes", "bearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
});

const roomResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: z.enum(["roommates", "trip"]),
  inviteCode: z.string().optional(),
  invite_code: z.string().nullable().optional().describe("Only sent to the room admin"),
  my_role: z.enum(["admin", "member"]).optional(),
});

const errorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string(),
  errors: z.record(z.string(), z.array(z.string())).optional().describe("Per-field messages (validation errors only)"),
});

// Paginated lists are documented with their full envelope; every other
// success response is wrapped automatically in getOpenApiDocument().
const paginationSchema = z.object({ page: z.number(), limit: z.number(), total: z.number(), totalPages: z.number() });
const page = <T extends z.ZodTypeAny>(item: T) =>
  z.object({ success: z.literal(true), data: z.array(item), pagination: paginationSchema });
const pageQuery = z.object({ page: z.number().int().min(1).optional(), limit: z.number().int().min(1).max(50).optional() });

const authUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string(),
  name: z.string(),
  picture: z.string().optional(),
  onboardingCompleted: z.boolean(),
});

const tokenPairResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: authUserSchema,
});

registry.registerPath({
  method: "post",
  path: "/api/auth/google",
  tags: ["Auth"],
  summary: "Exchange a Google OAuth access token (verified with Google, audience-checked) for a RooMates token pair. Creates the account on first login, or links an existing one with the same email.",
  request: {
    body: { content: { "application/json": { schema: googleLoginSchema } } },
  },
  responses: {
    200: { description: "Login successful", content: { "application/json": { schema: tokenPairResponseSchema } } },
    401: { description: "Invalid Google token", content: { "application/json": { schema: errorResponseSchema } } },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/auth/signup",
  tags: ["Auth"],
  summary: "Create an account with email + password. Emails a 6-digit code; no tokens until /verify-email succeeds.",
  request: { body: { content: { "application/json": { schema: signupSchema } } } },
  responses: {
    201: {
      description: "Account created, verification pending",
      content: { "application/json": { schema: z.object({ requiresVerification: z.literal(true), email: z.string() }) } },
    },
    409: { description: "Email already registered", content: { "application/json": { schema: errorResponseSchema } } },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/auth/verify-email",
  tags: ["Auth"],
  summary: "Confirm the emailed signup code; signs the user in on success",
  request: { body: { content: { "application/json": { schema: verifyEmailSchema } } } },
  responses: {
    200: { description: "Email verified, signed in", content: { "application/json": { schema: tokenPairResponseSchema } } },
    400: { description: "Invalid or expired code", content: { "application/json": { schema: errorResponseSchema } } },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/auth/resend-verification",
  tags: ["Auth"],
  summary: "Resend the signup verification code (rate-limited, never reveals whether the email exists)",
  request: { body: { content: { "application/json": { schema: emailOnlySchema } } } },
  responses: { 200: { description: "Generic acknowledgement", content: { "application/json": { schema: z.object({ message: z.string() }) } } } },
});

registry.registerPath({
  method: "post",
  path: "/api/auth/forgot-password",
  tags: ["Auth"],
  summary: "Email a password-reset code (never reveals whether the email exists)",
  request: { body: { content: { "application/json": { schema: emailOnlySchema } } } },
  responses: { 200: { description: "Generic acknowledgement", content: { "application/json": { schema: z.object({ message: z.string() }) } } } },
});

registry.registerPath({
  method: "post",
  path: "/api/auth/reset-password",
  tags: ["Auth"],
  summary: "Set a new password using the emailed code; revokes all existing sessions and signs in",
  request: { body: { content: { "application/json": { schema: resetPasswordSchema } } } },
  responses: {
    200: { description: "Password reset, signed in", content: { "application/json": { schema: tokenPairResponseSchema } } },
    400: { description: "Invalid or expired code", content: { "application/json": { schema: errorResponseSchema } } },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/auth/login",
  tags: ["Auth"],
  summary: "Log in with email + password",
  request: { body: { content: { "application/json": { schema: loginSchema } } } },
  responses: {
    200: { description: "Login successful", content: { "application/json": { schema: tokenPairResponseSchema } } },
    401: { description: "Invalid email or password", content: { "application/json": { schema: errorResponseSchema } } },
    403: { description: "Email not verified yet - a fresh code was emailed", content: { "application/json": { schema: errorResponseSchema } } },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/auth/refresh",
  tags: ["Auth"],
  summary: "Exchange a valid refresh token for a new access/refresh pair (rotates the refresh token)",
  request: { body: { content: { "application/json": { schema: refreshSchema } } } },
  responses: {
    200: { description: "New token pair issued", content: { "application/json": { schema: tokenPairResponseSchema } } },
    401: { description: "Invalid or expired refresh token", content: { "application/json": { schema: errorResponseSchema } } },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/auth/logout",
  tags: ["Auth"],
  summary: "Revoke a refresh token (logout)",
  request: { body: { content: { "application/json": { schema: refreshSchema } } } },
  responses: {
    204: { description: "Logged out" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/rooms",
  tags: ["Rooms"],
  summary: "List rooms the authenticated user belongs to",
  security: [{ [bearerAuth.name]: [] }],
  responses: {
    200: { description: "List of rooms", content: { "application/json": { schema: z.array(roomResponseSchema) } } },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/rooms",
  tags: ["Rooms"],
  summary: "Create a new room (subject to the organization's room quota)",
  security: [{ [bearerAuth.name]: [] }],
  request: { body: { content: { "application/json": { schema: createRoomSchema } } } },
  responses: {
    201: { description: "Room created", content: { "application/json": { schema: roomResponseSchema } } },
    403: { description: "Room quota exceeded", content: { "application/json": { schema: errorResponseSchema } } },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/rooms/{roomId}",
  tags: ["Rooms"],
  summary: "Get a single room by id",
  security: [{ [bearerAuth.name]: [] }],
  request: { params: z.object({ roomId: z.string().uuid() }) },
  responses: {
    200: { description: "Room", content: { "application/json": { schema: roomResponseSchema } } },
    404: { description: "Room not found or not a member", content: { "application/json": { schema: errorResponseSchema } } },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/rooms/join",
  tags: ["Rooms"],
  summary: "Join a room using its invite code",
  security: [{ [bearerAuth.name]: [] }],
  request: { body: { content: { "application/json": { schema: joinRoomSchema } } } },
  responses: {
    200: { description: "Joined room", content: { "application/json": { schema: roomResponseSchema } } },
    404: { description: "Invalid invite code", content: { "application/json": { schema: errorResponseSchema } } },
    409: { description: "Already a member of this room", content: { "application/json": { schema: errorResponseSchema } } },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/rooms/{roomId}/members",
  tags: ["Rooms"],
  summary: "List members of a room",
  security: [{ [bearerAuth.name]: [] }],
  request: { params: z.object({ roomId: z.string().uuid() }) },
  responses: {
    200: {
      description: "Room members",
      content: {
        "application/json": {
          schema: z.array(
            z.object({
              user_id: z.string().uuid(),
              role: z.enum(["admin", "member"]),
              joined_at: z.string(),
              name: z.string(),
              email: z.string(),
              picture: z.string().nullable().optional(),
            })
          ),
        },
      },
    },
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/rooms/{roomId}/members/{userId}",
  tags: ["Rooms"],
  summary: "Admin only: remove a member. Refused while they have an unsettled balance; rotates the invite code so they can't rejoin with it.",
  security: [{ [bearerAuth.name]: [] }],
  request: { params: z.object({ roomId: z.string().uuid(), userId: z.string().uuid() }) },
  responses: {
    204: { description: "Removed" },
    403: { description: "Not the room admin", content: { "application/json": { schema: errorResponseSchema } } },
    409: { description: "Member still has money to settle", content: { "application/json": { schema: errorResponseSchema } } },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/rooms/{roomId}/invite-code",
  tags: ["Rooms"],
  summary: "Admin only: replace the invite code (the old one stops working)",
  security: [{ [bearerAuth.name]: [] }],
  request: { params: z.object({ roomId: z.string().uuid() }) },
  responses: {
    200: { description: "New code", content: { "application/json": { schema: z.object({ inviteCode: z.string() }) } } },
    403: { description: "Not the room admin", content: { "application/json": { schema: errorResponseSchema } } },
  },
});

const balanceSchema = z.object({
  userId: z.string().uuid(),
  name: z.string(),
  netPaise: z.number().describe("Positive = is owed money, negative = owes money"),
});

const settlementSchema = z.object({
  fromUserId: z.string().uuid(),
  toUserId: z.string().uuid(),
  amountPaise: z.number(),
  fromName: z.string().optional(),
  toName: z.string().optional(),
});

registry.registerPath({
  method: "post",
  path: "/api/rooms/{roomId}/expenses",
  tags: ["Expenses"],
  summary: "Add an expense to a room, split equally or with custom shares",
  security: [{ [bearerAuth.name]: [] }],
  request: {
    params: z.object({ roomId: z.string().uuid() }),
    body: { content: { "application/json": { schema: createExpenseSchema } } },
  },
  responses: {
    201: { description: "Expense created", content: { "application/json": { schema: z.object({ id: z.string().uuid(), description: z.string(), amountPaise: z.number(), paidBy: z.string().uuid() }) } } },
    400: { description: "Splits don't add up to the total amount", content: { "application/json": { schema: errorResponseSchema } } },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/rooms/{roomId}/expenses",
  tags: ["Expenses"],
  summary: "List expenses in a room, newest first (paginated)",
  security: [{ [bearerAuth.name]: [] }],
  request: { params: z.object({ roomId: z.string().uuid() }), query: pageQuery },
  responses: {
    200: { description: "One page of expenses", content: { "application/json": { schema: page(z.object({ id: z.string().uuid(), description: z.string(), amount_paise: z.string(), paid_by: z.string().uuid(), paid_by_name: z.string(), created_at: z.string() })) } } },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/rooms/{roomId}/balances",
  tags: ["Expenses"],
  summary: "Get each member's net balance and the simplified (minimum-transaction) settlement plan",
  security: [{ [bearerAuth.name]: [] }],
  request: { params: z.object({ roomId: z.string().uuid() }) },
  responses: {
    200: {
      description: "Balances and settlement plan",
      content: {
        "application/json": {
          schema: z.object({ balances: z.array(balanceSchema), settlements: z.array(settlementSchema) }),
        },
      },
    },
  },
});

const profileResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string(),
  name: z.string(),
  phone: z.string().nullable().optional(),
  picture: z.string().nullable().optional(),
  onboarding_completed: z.boolean(),
});

registry.registerPath({
  method: "get",
  path: "/api/users/me",
  tags: ["Users"],
  summary: "Current user's profile plus plan usage (plan, room limit, rooms used)",
  security: [{ [bearerAuth.name]: [] }],
  responses: {
    200: {
      description: "Profile and plan usage",
      content: {
        "application/json": {
          schema: profileResponseSchema.extend({
            plan: z.enum(["free", "paid"]),
            max_rooms: z.number(),
            room_count: z.number(),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/users/me",
  tags: ["Users"],
  summary: "Update profile (name, phone)",
  security: [{ [bearerAuth.name]: [] }],
  request: { body: { content: { "application/json": { schema: profileSchema } } } },
  responses: {
    200: { description: "Profile updated", content: { "application/json": { schema: profileResponseSchema } } },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/users/me/onboarding",
  tags: ["Users"],
  summary: "Finish onboarding: saves profile and marks onboarding complete",
  security: [{ [bearerAuth.name]: [] }],
  request: { body: { content: { "application/json": { schema: profileSchema } } } },
  responses: {
    200: { description: "Profile saved, onboarding complete", content: { "application/json": { schema: profileResponseSchema } } },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/contact",
  tags: ["Contact"],
  summary: "Send a message from the public contact form to the site owner's inbox",
  request: { body: { content: { "application/json": { schema: contactSchema } } } },
  responses: {
    200: { description: "Message sent", content: { "application/json": { schema: z.object({ message: z.string() }) } } },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/expenses",
  tags: ["Expenses"],
  summary: "All expenses in one month across every room the caller belongs to (months cut in IST)",
  security: [{ [bearerAuth.name]: [] }],
  request: { query: monthExpensesQuerySchema },
  responses: {
    200: {
      description: "Expenses for the month, newest first",
      content: {
        "application/json": {
          schema: z.array(
            z.object({
              id: z.string().uuid(),
              description: z.string(),
              amount_paise: z.number(),
              my_share_paise: z.number(),
              created_at: z.string(),
              paid_by: z.string().uuid(),
              paid_by_name: z.string(),
              room_id: z.string().uuid(),
              room_name: z.string(),
              room_type: z.enum(["roommates", "trip"]),
            })
          ),
        },
      },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/expenses/monthly-summary",
  tags: ["Expenses"],
  summary: "Per-month totals for the caller: group spend, what they paid, their share, net",
  security: [{ [bearerAuth.name]: [] }],
  request: { query: monthlySummaryQuerySchema },
  responses: {
    200: {
      description: "One row per month, newest first",
      content: {
        "application/json": {
          schema: z.array(
            z.object({
              month: z.string().describe("YYYY-MM"),
              expenseCount: z.number(),
              totalPaise: z.number(),
              iPaidPaise: z.number(),
              mySharePaise: z.number(),
              netPaise: z.number().describe("Positive = others owe you for that month"),
            })
          ),
        },
      },
    },
  },
});

const fundHeadlineSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  perMemberPaise: z.number(),
  createdAt: z.string(),
  expectedPaise: z.number().describe("perMemberPaise x current members"),
  collectedPaise: z.number(),
  spentPaise: z.number(),
  balancePaise: z.number().describe("Cash the fund should hold: collected - spent"),
  pendingPaise: z.number().describe("Sum of each member's unpaid share (overpayments don't offset others)"),
});

const fundParams = z.object({ roomId: z.string().uuid(), fundId: z.string().uuid() });
const createdIdSchema = z.object({ id: z.string().uuid() });

registry.registerPath({
  method: "get",
  path: "/api/rooms/{roomId}/funds",
  tags: ["Funds"],
  summary: "List a room's pooled-money funds with collected / spent / pending totals",
  security: [{ [bearerAuth.name]: [] }],
  request: { params: z.object({ roomId: z.string().uuid() }) },
  responses: { 200: { description: "Funds, newest first", content: { "application/json": { schema: z.array(fundHeadlineSchema) } } } },
});

registry.registerPath({
  method: "post",
  path: "/api/rooms/{roomId}/funds",
  tags: ["Funds"],
  summary: "Start a fund, e.g. '₹1500 each for October'",
  security: [{ [bearerAuth.name]: [] }],
  request: {
    params: z.object({ roomId: z.string().uuid() }),
    body: { content: { "application/json": { schema: createFundSchema } } },
  },
  responses: { 201: { description: "Fund created", content: { "application/json": { schema: createdIdSchema.extend({ name: z.string() }) } } } },
});

registry.registerPath({
  method: "get",
  path: "/api/rooms/{roomId}/funds/{fundId}",
  tags: ["Funds"],
  summary: "Fund detail: totals, each member's paid / pending, and the full history",
  security: [{ [bearerAuth.name]: [] }],
  request: { params: fundParams },
  responses: {
    200: {
      description: "Fund detail",
      content: {
        "application/json": {
          schema: fundHeadlineSchema.extend({
            members: z.array(
              z.object({ userId: z.string().uuid(), name: z.string(), picture: z.string().nullable(), paidPaise: z.number(), pendingPaise: z.number() })
            ),
            entries: z.array(
              z.object({
                id: z.string().uuid(),
                kind: z.enum(["contribution", "spend"]),
                member_id: z.string().uuid().nullable(),
                member_name: z.string().nullable(),
                amount_paise: z.number(),
                note: z.string().nullable(),
                created_by: z.string().uuid(),
                created_by_name: z.string().nullable(),
                created_at: z.string(),
              })
            ),
          }),
        },
      },
    },
    404: { description: "Fund not found", content: { "application/json": { schema: errorResponseSchema } } },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/rooms/{roomId}/funds/{fundId}/contributions",
  tags: ["Funds"],
  summary: "Record money a member paid into the fund (partial payments are separate entries)",
  security: [{ [bearerAuth.name]: [] }],
  request: { params: fundParams, body: { content: { "application/json": { schema: contributionSchema } } } },
  responses: {
    201: { description: "Payment recorded", content: { "application/json": { schema: createdIdSchema } } },
    400: { description: "Not a room member", content: { "application/json": { schema: errorResponseSchema } } },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/rooms/{roomId}/funds/{fundId}/spends",
  tags: ["Funds"],
  summary: "Spend from the fund. Rejected if it exceeds the fund's balance (checked under a row lock).",
  security: [{ [bearerAuth.name]: [] }],
  request: { params: fundParams, body: { content: { "application/json": { schema: spendSchema } } } },
  responses: {
    201: { description: "Spend recorded", content: { "application/json": { schema: createdIdSchema } } },
    400: { description: "Not enough money in the fund", content: { "application/json": { schema: errorResponseSchema } } },
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/rooms/{roomId}/funds/{fundId}/entries/{entryId}",
  tags: ["Funds"],
  summary: "Delete an entry you recorded",
  security: [{ [bearerAuth.name]: [] }],
  request: { params: fundParams.extend({ entryId: z.string().uuid() }) },
  responses: {
    204: { description: "Deleted" },
    403: { description: "Recorded by someone else", content: { "application/json": { schema: errorResponseSchema } } },
    409: { description: "Payment's money already spent", content: { "application/json": { schema: errorResponseSchema } } },
  },
});

// ================= Listings, requests, admin =================
// Compact helper for the newer routes: method, path, tag, summary and the
// shapes that matter. Error responses all share errorResponseSchema.
function route(
  method: "get" | "post" | "patch" | "delete",
  path: string,
  tag: string,
  summary: string,
  opts: {
    params?: z.ZodObject;
    query?: z.ZodObject;
    body?: z.ZodType;
    ok?: z.ZodType;
    status?: 200 | 201 | 204;
    errors?: Record<number, string>;
  } = {}
) {
  const status = opts.status ?? (method === "post" ? 201 : method === "delete" ? 204 : 200);
  registry.registerPath({
    method,
    path,
    tags: [tag],
    summary,
    security: [{ [bearerAuth.name]: [] }],
    request: {
      ...(opts.params && { params: opts.params }),
      ...(opts.query && { query: opts.query }),
      ...(opts.body && { body: { content: { "application/json": { schema: opts.body } } } }),
    },
    responses: {
      [status]:
        status === 204 || !opts.ok
          ? { description: "Done" }
          : { description: "Success", content: { "application/json": { schema: opts.ok } } },
      ...Object.fromEntries(
        Object.entries(opts.errors ?? {}).map(([code, description]) => [
          code,
          { description, content: { "application/json": { schema: errorResponseSchema } } },
        ])
      ),
    },
  });
}

const listingIdParams = z.object({ listingId: z.string().uuid() });
const listingCard = z.object({
  id: z.string().uuid(),
  title: z.string(),
  rent_paise: z.number(),
  room_type: z.enum(ROOM_TYPES),
  furnishing: z.enum(FURNISHING),
  locality: z.string(),
  city: z.string(),
  pincode: z.string(),
  available_from: z.string(),
  status: z.string(),
  is_mine: z.boolean(),
  cover_url: z.string().nullable(),
  created_at: z.string(),
});
const statusResult = z.object({ id: z.string().uuid(), status: z.string() });
const forbidden = { 403: "Not your listing" };
const notFound = { 404: "Not found (or not visible to you)" };

route("get", "/api/listings", "Listings", "Search published listings by city, pincode, rent range, room type, furnishing, availability", {
  query: searchListingsQuery,
  ok: page(listingCard),
});
route("get", "/api/listings/nearby", "Listings", "Published listings within radiusKm of lat/lng, nearest first (bounding box + haversine)", {
  query: nearbyListingsQuery,
  ok: page(listingCard.extend({ distance_km: z.number() })),
});
route("get", "/api/listings/mine", "Listings", "Owner dashboard: my listings in every status, with pending request counts", {
  query: myListingsQuery,
  ok: page(listingCard.extend({ pending_requests: z.number(), rejection_reason: z.string().nullable() })),
});
route("post", "/api/listings", "Listings", "Create a listing as a draft (needs a phone number on the account; max 5 active)", {
  body: createListingSchema,
  ok: z.object({ id: z.string().uuid(), status: z.literal("draft") }),
  errors: { 400: "Validation failed", 403: "No phone number, or listing limit reached" },
});
route("get", "/api/listings/{listingId}", "Listings", "Listing detail with photos. Owners also get request counts; others get their own request status", {
  params: listingIdParams,
  ok: listingCard.extend({
    description: z.string(),
    amenities: z.array(z.string()),
    images: z.array(z.object({ id: z.string(), url: z.string(), is_primary: z.boolean() })),
  }),
  errors: notFound,
});
route("patch", "/api/listings/{listingId}", "Listings", "Edit your listing (partial). Editing a published or rejected listing sends it back to review", {
  params: listingIdParams,
  body: updateListingSchema,
  ok: statusResult,
  errors: { ...forbidden, ...notFound, 409: "Removed by a moderator, or rented" },
});
route("delete", "/api/listings/{listingId}", "Listings", "Delete your listing (photos, requests and reports go with it)", {
  params: listingIdParams,
  errors: { ...forbidden, ...notFound },
});
route("post", "/api/listings/{listingId}/status", "Listings", "Owner lifecycle: submit (draft/rejected -> pending), mark_rented, relist (rented -> pending)", {
  params: listingIdParams,
  body: listingStatusActionSchema,
  status: 200,
  ok: statusResult,
  errors: { ...forbidden, 409: "Not allowed from the current status" },
});
route("post", "/api/listings/{listingId}/images/upload-signature", "Listings", "Get a signed Cloudinary upload (the browser uploads the file directly)", {
  params: listingIdParams,
  status: 200,
  ok: z.object({
    uploadUrl: z.string(),
    apiKey: z.string(),
    public_id: z.string(),
    timestamp: z.number(),
    allowed_formats: z.string(),
    signature: z.string(),
  }),
  errors: { ...forbidden, 400: "Photo limit (6) reached", 503: "Photo uploads not configured" },
});
route("post", "/api/listings/{listingId}/images", "Listings", "Attach an uploaded photo (must be in this listing's Cloudinary folder). The first photo becomes the cover", {
  params: listingIdParams,
  body: saveImageSchema,
  ok: z.object({ id: z.string().uuid(), url: z.string(), is_primary: z.boolean() }),
  errors: forbidden,
});
route("delete", "/api/listings/{listingId}/images/{imageId}", "Listings", "Remove a photo", {
  params: listingIdParams.extend({ imageId: z.string().uuid() }),
  errors: forbidden,
});
route("post", "/api/listings/{listingId}/images/{imageId}/cover", "Listings", "Make a photo the cover", {
  params: listingIdParams.extend({ imageId: z.string().uuid() }),
  status: 204,
  errors: forbidden,
});
route("post", "/api/listings/{listingId}/reports", "Listings", "Report a published listing (once per user)", {
  params: listingIdParams,
  body: reportListingSchema,
  errors: { 400: "Your own listing", 409: "Already reported" },
});

const requestRow = z.object({
  id: z.string().uuid(),
  status: z.enum(["pending", "accepted", "rejected"]),
  message: z.string().nullable(),
  created_at: z.string(),
  listing_id: z.string().uuid(),
  listing_title: z.string(),
});
route("post", "/api/requests", "Requests", "Tell an owner you're interested in their published listing", {
  body: createRequestSchema,
  ok: z.object({ id: z.string().uuid(), status: z.literal("pending") }),
  errors: { 400: "Your own listing", 404: "Listing not found", 409: "Already requested" },
});
route("get", "/api/requests/sent", "Requests", "Requests I sent. owner_phone/owner_email are filled in only once accepted", {
  query: sentRequestsQuery,
  ok: page(requestRow.extend({ owner_name: z.string().nullable(), owner_phone: z.string().nullable(), owner_email: z.string().nullable() })),
});
route("get", "/api/requests/received", "Requests", "Requests on my listings. Requester contact is filled in only once accepted", {
  query: receivedRequestsQuery,
  ok: page(
    requestRow.extend({ requester_name: z.string().nullable(), requester_phone: z.string().nullable(), requester_email: z.string().nullable() })
  ),
});
route("patch", "/api/requests/{requestId}", "Requests", "Owner accepts or rejects. markRented also closes the listing and declines other pending requests (one transaction)", {
  params: z.object({ requestId: z.string().uuid() }),
  body: respondToRequestSchema,
  ok: z.object({ id: z.string().uuid(), status: z.string(), listingRented: z.boolean() }),
  errors: { 403: "Not the listing's owner", 404: "Request not found", 409: "Already answered" },
});

const adminOnly = { 401: "Not signed in", 403: "Not a super admin" };
const idParams = z.object({ id: z.string().uuid() });
route("get", "/api/admin/stats", "Admin", "Dashboard counts: users, owners, listings by status, open reports, rooms", {
  ok: z.record(z.string(), z.number()),
  errors: adminOnly,
});
route("get", "/api/admin/users", "Admin", "Users, with search and a suspended filter", {
  query: usersQuery,
  ok: page(z.object({ id: z.string(), name: z.string(), email: z.string(), role: z.string(), suspended_at: z.string().nullable() })),
  errors: adminOnly,
});
route("post", "/api/admin/users/{id}/suspend", "Admin", "Suspend an account: blocks sign-in and revokes its refresh tokens (audit-logged)", {
  params: idParams,
  status: 200,
  errors: { ...adminOnly, 409: "Already suspended" },
});
route("post", "/api/admin/users/{id}/unsuspend", "Admin", "Restore a suspended account (audit-logged)", { params: idParams, status: 200, errors: adminOnly });
route("get", "/api/admin/listings", "Admin", "All listings by status; the pending queue is oldest first", {
  query: listingsQuery,
  ok: page(listingCard.pick({ id: true, title: true, city: true, status: true })),
  errors: adminOnly,
});
route("get", "/api/admin/listings/{id}", "Admin", "Any listing with its owner, photos and reports", { params: idParams, errors: adminOnly });
route("post", "/api/admin/listings/{id}/approve", "Admin", "pending -> published (audit-logged)", {
  params: idParams,
  status: 200,
  ok: statusResult,
  errors: { ...adminOnly, 409: "Not pending" },
});
route("post", "/api/admin/listings/{id}/reject", "Admin", "pending -> rejected, with a reason shown to the owner (audit-logged)", {
  params: idParams,
  body: reasonSchema,
  status: 200,
  ok: statusResult,
  errors: adminOnly,
});
route("post", "/api/admin/listings/{id}/remove", "Admin", "Take a listing down from any status (audit-logged)", {
  params: idParams,
  body: reasonSchema,
  status: 200,
  ok: statusResult,
  errors: adminOnly,
});
route("get", "/api/admin/reports", "Admin", "Reported listings", { query: reportsQuery, errors: adminOnly });
route("post", "/api/admin/reports/{id}/resolve", "Admin", "dismiss, resolve, or remove_listing (which resolves every open report on it)", {
  params: idParams,
  body: resolveReportSchema,
  status: 200,
  errors: adminOnly,
});
route("get", "/api/admin/rooms", "Admin", "All expense rooms (support view)", { query: roomsQuery, errors: adminOnly });
route("get", "/api/admin/rooms/{id}", "Admin", "Read-only view of any room: members, recent expenses, balances", { params: idParams, errors: adminOnly });
route("get", "/api/admin/audit-logs", "Admin", "Who did what, newest first", { query: pageQuery, errors: adminOnly });

const fundEntryParams = z.object({ roomId: z.string().uuid(), fundId: z.string().uuid(), entryId: z.string().uuid() });
route("post", "/api/rooms/{roomId}/funds/{fundId}/entries/{entryId}/confirm", "Funds", "Collector/room admin: confirm a payment a member recorded, or mark a closing refund/collection as done", {
  params: fundEntryParams,
  status: 200,
  ok: z.object({ id: z.string().uuid(), confirmed: z.literal(true) }),
  errors: { 403: "Not the collector or room admin", 409: "Already confirmed, or the fund is closed" },
});
route("get", "/api/rooms/{roomId}/funds/{fundId}/close-preview", "Funds", "What closing would do: each person's equal share of the spending and who gets money back or owes", {
  params: fundParams,
  errors: { 403: "Not the collector or room admin", 409: "Already closed" },
});
route("post", "/api/rooms/{roomId}/funds/{fundId}/close", "Funds", "Close the fund and record the refunds/collections. Blocked while payments wait for confirmation", {
  params: fundParams,
  status: 200,
  errors: { 403: "Not the collector or room admin", 409: "Closed already, or unconfirmed payments" },
});

const generator = new OpenApiGeneratorV31(registry.definitions);

type JsonSchema = { properties?: Record<string, unknown> } & Record<string, unknown>;

// Mirrors utils/response.ts: success bodies are { success, message?, data }.
// Registering each path with its bare `data` schema and wrapping it here keeps
// the envelope defined in one place instead of in every route above.
function wrapSuccessResponses(doc: ReturnType<typeof generator.generateDocument>) {
  for (const methods of Object.values(doc.paths ?? {})) {
    for (const operation of Object.values(methods as Record<string, { responses?: Record<string, unknown> }>)) {
      for (const [code, response] of Object.entries(operation?.responses ?? {})) {
        const content = (response as { content?: Record<string, { schema?: JsonSchema }> }).content?.["application/json"];
        if (!code.startsWith("2") || !content?.schema || content.schema.properties?.success) continue;
        content.schema = {
          type: "object",
          properties: { success: { type: "boolean", const: true }, message: { type: "string" }, data: content.schema },
          required: ["success", "data"],
        };
      }
    }
  }
  return doc;
}

export function getOpenApiDocument() {
  return wrapSuccessResponses(
    generator.generateDocument({
      openapi: "3.1.0",
      info: {
        title: "RooMates API",
        version: "1.0.0",
        description:
          "Expense splitting for roommates plus room-vacancy listings. Rooms are isolated with Postgres Row-Level Security; " +
          "every response is { success, message?, data, pagination? }.",
      },
      servers: [{ url: "http://localhost:5000" }],
    })
  );
}
