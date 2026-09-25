import { z } from "zod";

export const roleSchema = z.enum(["ADMIN", "USER"]);

export const createUserSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.email().max(254).transform((s) => s.toLowerCase()),
  role: roleSchema.default("USER"),
});

export const updateUserSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.email().max(254).transform((s) => s.toLowerCase()),
  role: roleSchema,
});