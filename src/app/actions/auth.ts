"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { credentialsSchema } from "@/lib/validation";

export type AuthFormState = { error?: string; message?: string; email?: string };

function parseCredentials(formData: FormData) {
  return credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
}

export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = parseCredentials(formData);
  const email = String(formData.get("email") ?? "");
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    const message =
      error.code === "email_not_confirmed"
        ? "Please confirm your email address first (check your inbox)."
        : "Incorrect email or password.";
    return { error: message, email };
  }
  redirect("/documents");
}

export async function signUp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = parseCredentials(formData);
  const email = String(formData.get("email") ?? "");
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, email };

  const origin = (await headers()).get("origin") ?? "";
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    ...parsed.data,
    options: { emailRedirectTo: origin ? `${origin}/auth/callback` : undefined },
  });

  if (error) {
    if (error.code === "user_already_exists") return { error: "An account with this email already exists. Sign in instead.", email };
    if (error.code === "weak_password") return { error: error.message, email };
    if (error.code === "over_email_send_rate_limit") return { error: "Too many sign-up emails were sent. Please wait a minute and try again.", email };
    console.error("signUp failed", error);
    return { error: "We couldn't create your account. Please try again.", email };
  }
  // With email confirmation on, Supabase hides existing accounts by returning a user with no identities.
  if (data.user && data.user.identities?.length === 0) {
    return { error: "An account with this email already exists. Sign in instead.", email };
  }
  if (!data.session) {
    return { message: "Account created. Check your email to confirm it, then sign in.", email };
  }
  redirect("/documents");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
