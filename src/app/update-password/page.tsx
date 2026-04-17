import type { Metadata } from "next";
import { UpdatePasswordPage } from "@/components/auth/update-password-page";
import "../create-account/create-account.css";

export const metadata: Metadata = {
  title: "Update Password | The IELTS Exam",
  description: "Set a new password for your account on The IELTS Exam.",
};

export default function UpdatePassword() {
  return <UpdatePasswordPage />;
}
