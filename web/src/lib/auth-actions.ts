"use server";
import { signIn as nextAuthSignIn } from "@/auth";

export async function signInWithGoogle(redirectTo?: string) {
  await nextAuthSignIn("google", { redirectTo: redirectTo ?? "/" });
}
