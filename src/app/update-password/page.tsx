import type { Metadata } from "next";
import { UpdatePasswordPage } from "@/components/auth/update-password-page";
import "../create-account/create-account.css";

export const metadata: Metadata = {
  title: "Update Password | IELTS Pro",
  description: "Set a new password for your IELTS Pro account.",
};

export default function UpdatePassword() {
  return <UpdatePasswordPage />;
}
