import { LOCAL_USER } from "@/lib/local-user";

export async function getLocalAuthClient() {
  return {
    auth: {
      getUser: async () => ({
        data: { user: LOCAL_USER },
        error: null,
      }),
      signOut: async () => ({ error: null }),
      exchangeCodeForSession: async () => ({ error: null }),
    },
  };
}

export async function getCurrentLocalUser() {
  return LOCAL_USER;
}
