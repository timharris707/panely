export type LocalUser = {
  id: string;
  email: string;
  created_at: string;
  app_metadata: Record<string, string>;
  user_metadata: Record<string, string>;
};

export const LOCAL_USER: LocalUser = {
  id: "local-user",
  email: "local@panely.local",
  created_at: "2026-06-25T00:00:00.000Z",
  app_metadata: { provider: "local" },
  user_metadata: { full_name: "Local Panely User" },
};

export async function getCurrentUser() {
  return LOCAL_USER;
}
