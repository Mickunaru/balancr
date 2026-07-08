import type { Metadata } from "next";

import { SignUpForm } from "./signup-form";

export const metadata: Metadata = {
  title: "Sign up — Balancr",
};

export default function SignUpPage() {
  return <SignUpForm />;
}
