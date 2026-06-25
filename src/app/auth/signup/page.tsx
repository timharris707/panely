import { redirect } from "next/navigation";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const query = new URLSearchParams({ view: "signup" });

  if (next) query.set("next", next);

  redirect(`/login?${query.toString()}`);
}
