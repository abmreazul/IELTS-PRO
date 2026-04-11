import type { Metadata } from "next";
import { ForgotPasswordPage } from "@/components/auth/forgot-password-page";
import "../create-account/create-account.css";

export const metadata: Metadata = {
  title: "Forgot Password | IELTS Pro",
  description: "Reset your IELTS Pro account password.",
};

export default function ForgotPassword() {
  return <ForgotPasswordPage />;
}
