type Session = { accessToken: string; demo?: boolean } | null;

// Client storage is not proof of a role: only a protected backend response grants entry.
export async function verifyAdminAccess(
  session: Session,
  authorize: () => Promise<unknown>,
): Promise<boolean> {
  if (!session?.accessToken || session.demo || session.accessToken === "demo-access-token") return false;
  try {
    await authorize();
    return true;
  } catch {
    return false;
  }
}
