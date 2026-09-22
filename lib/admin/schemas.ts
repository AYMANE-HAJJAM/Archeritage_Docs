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

export const createSectionSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1)
    .max(20)
    .regex(/^[0-9]+(?:\.[0-9]+)?$/, "Code de rubrique invalide")
    .optional()
    .nullable(),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional()
    .nullable(),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional().nullable(),
  kind: z.enum(["documentary", "structured", "sequences"]).default("documentary"),
  groupId: z.string().optional().nullable(),
  tracks: z.array(z.string()).default(["documents", "photos"]),
});
