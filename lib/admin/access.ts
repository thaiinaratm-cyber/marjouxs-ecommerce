export type AdminAccessStatus =
  | "authorized"
  | "unauthenticated"
  | "not_admin"
  | "verification_error";

export type AdminAccess = {
  status: AdminAccessStatus;
  userId: string | null;
};

export function classifyAdminAccess(input: {
  userId?: string | null;
  authFailed?: boolean;
  adminCheckFailed?: boolean;
  isActiveAdmin?: boolean;
}): AdminAccess {
  if (input.authFailed || input.adminCheckFailed) {
    return { status: "verification_error", userId: input.userId ?? null };
  }

  if (!input.userId) {
    return { status: "unauthenticated", userId: null };
  }

  if (!input.isActiveAdmin) {
    return { status: "not_admin", userId: input.userId };
  }

  return { status: "authorized", userId: input.userId };
}
