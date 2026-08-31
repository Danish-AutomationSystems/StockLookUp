export function isAllowedDomain(email: string | null | undefined, allowedDomain: string): boolean {
  if (!email) return false;
  const domain = email.split('@')[1]?.toLowerCase();
  return domain === allowedDomain.toLowerCase();
}

export function isAdmin(email: string | null | undefined, adminEmail: string): boolean {
  if (!email) return false;
  return email.toLowerCase() === adminEmail.toLowerCase();
}
