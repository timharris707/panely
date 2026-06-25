import { LOCAL_USER } from "@/lib/local-user";

type LocalAuthResult = {
  data: { user: typeof LOCAL_USER } | { url: string } | null;
  error: { message: string } | null;
};

export function createLocalAuthClient() {
  return {
    auth: {
      signInWithPassword: async (credentials?: unknown): Promise<LocalAuthResult> => {
        void credentials;
        return { data: { user: LOCAL_USER }, error: null };
      },
      signUp: async (credentials?: unknown): Promise<LocalAuthResult> => {
        void credentials;
        return { data: { user: LOCAL_USER }, error: null };
      },
      signInWithOAuth: async (options?: unknown): Promise<LocalAuthResult> => {
        void options;
        return { data: { url: "/advisory" }, error: null };
      },
      signOut: async (): Promise<{ error: null }> => ({ error: null }),
    },
  };
}
