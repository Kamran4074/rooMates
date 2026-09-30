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
});

const errorResponseSchema = z.object({ message: z.string() });

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
  summary: "Exchange a Google ID token for a RooMates access/refresh token pair (creates the user + organization on first login)",
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
  summary: "List expenses in a room",
  security: [{ [bearerAuth.name]: [] }],
  request: { params: z.object({ roomId: z.string().uuid() }) },
  responses: {
    200: { description: "List of expenses", content: { "application/json": { schema: z.array(z.object({ id: z.string().uuid(), description: z.string(), amount_paise: z.string(), paid_by: z.string().uuid(), paid_by_name: z.string(), created_at: z.string() })) } } },
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

const generator = new OpenApiGeneratorV31(registry.definitions);

export function getOpenApiDocument() {
  return generator.generateDocument({
    openapi: "3.1.0",
    info: {
      title: "RooMates API",
      version: "1.0.0",
      description: "Multi-tenant expense-splitting API with room-membership-based Row-Level Security.",
    },
    servers: [{ url: "http://localhost:5000" }],
  });
}
