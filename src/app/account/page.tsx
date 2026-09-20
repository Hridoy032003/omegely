import AccountPanel from "@/components/AccountPanel";

export const metadata = {
  title: "Your Omegley account",
  description: "Create an optional Omegley account and manage your profile.",
  alternates: { canonical: "/account" },
};

export default function AccountPage() {
  return <AccountPanel />;
}
