import type { Metadata } from "next";
import { ForgotPasswordPage } from "@/components/auth/forgot-password-page";
import "../create-account/create-account.css";

export const metadata: Metadata = {
  title: "Forgot Password | The IELTS Exam",
  description: "Reset your password for The IELTS Exam.",
};

export default function ForgotPassword() {
  return <ForgotPasswordPage />;
}
