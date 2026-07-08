import type { Metadata } from "next";

import { SignInForm } from "./signin-form";

export const metadata: Metadata = {
  title: "Sign in — Balancr",
};

export default function SignInPage() {
  return <SignInForm />;
}
