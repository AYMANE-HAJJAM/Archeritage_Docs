/** Public label for a user. Never returns an id. */
export type PersonNameSource = {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
};

/**
 * `User.name` is the configured display name.
 * firstName + lastName is the fallback used by the user form when `name` is empty.
 * Email is only used when neither readable name exists.
 */
export function formatPersonName(
  user: PersonNameSource | null | undefined,
): string {
  if (!user) return "—";
  const name = user.name?.trim();
  if (name) return name;
  const composed = [user.firstName, user.lastName]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(" ");
  if (composed) return composed;
  const email = user.email?.trim();
  if (email) return email;
  return "—";
}
