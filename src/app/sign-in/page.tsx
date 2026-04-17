import type { Metadata } from "next";
import { SignInPage } from "@/components/auth/sign-in-page";
import "../create-account/create-account.css";

export const metadata: Metadata = {
  title: "Sign In | The IELTS Exam",
  description: "Sign in to The IELTS Exam to access your mock tests and progress.",
};

export default function SignIn() {
  return <SignInPage />;
}
