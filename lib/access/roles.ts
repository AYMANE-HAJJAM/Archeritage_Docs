/** Pure role helpers — safe for unit tests (no server-only). */

export type AccessUser = {
  id: string;
  role: "ADMIN" | "USER";
  status?: "INVITED" | "ACTIVE" | "DISABLED";
};

export function canManagePlatform(user: AccessUser): boolean {
  return user.role === "ADMIN";
}
