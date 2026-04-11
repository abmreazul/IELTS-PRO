import type { Metadata } from "next";
import { SignInPage } from "@/components/auth/sign-in-page";
import "../create-account/create-account.css";

export const metadata: Metadata = {
  title: "Sign In | IELTS Pro",
  description: "Sign in to IELTS Pro to access your mock tests and progress.",
};

export default function SignIn() {
  return <SignInPage />;
}
