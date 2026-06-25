import { redirect } from "next/navigation";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const query = new URLSearchParams();

  if (next) query.set("next", next);
  if (error) query.set("error", error);

  const suffix = query.toString();
  redirect(`/login${suffix ? `?${suffix}` : ""}`);
}
