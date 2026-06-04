import { SignIn } from "@clerk/clerk-react";

export default function SignInPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "#f3f4f6" }}
    >
      <SignIn
        routing="hash"
        afterSignInUrl="/dashboard"
        appearance={{
          variables: {
            colorPrimary: "#BB0A21",
            colorBackground: "#ffffff",
            colorText: "#111111",
            colorTextSecondary: "#555555",
            colorInputBackground: "#f9f9f9",
            colorInputText: "#111111",
            borderRadius: "4px",
          },
          elements: {
            card: "shadow-md border border-gray-200",
            headerTitle: "text-gray-900",
            headerSubtitle: "text-gray-500",
            formButtonPrimary: "bg-[#BB0A21] hover:opacity-85",
            footerActionLink: "text-[#BB0A21]",
          },
        }}
      />
    </div>
  );
}
