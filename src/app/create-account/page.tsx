import type { Metadata } from "next";
import { CreateAccountPage } from "@/components/auth/create-account-page";
import "./create-account.css";

export const metadata: Metadata = {
  title: "Create Account | The IELTS Exam",
  description: "Create an account on The IELTS Exam and start full-length mock tests.",
};

export default function CreateAccount() {
  return <CreateAccountPage />;
}
