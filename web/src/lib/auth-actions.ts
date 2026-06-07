"use server";
import { signIn as nextAuthSignIn, signOut as nextAuthSignOut } from "@/auth";

export async function signInWithGoogle(redirectTo?: string) {
  await nextAuthSignIn("google", { redirectTo: redirectTo ?? "/" });
}

export async function signOut() {
  await nextAuthSignOut({ redirectTo: "/" });
}
