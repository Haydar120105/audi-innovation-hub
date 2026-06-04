import { SignUp } from "@clerk/clerk-react";
import { dark } from "@clerk/themes";

export default function SignUpPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "linear-gradient(135deg, #0A0A14 0%, #0D0B1C 50%, #0A0A14 100%)" }}
    >
      <SignUp
        routing="hash"
        afterSignUpUrl="/"
        appearance={{
          baseTheme: dark,
          variables: {
            colorPrimary: "#BB0A21",
            colorBackground: "#0D0B1C",
            colorText: "#ffffff",
            colorTextSecondary: "rgba(255,255,255,0.5)",
            colorInputBackground: "rgba(255,255,255,0.06)",
            colorInputText: "#ffffff",
            borderRadius: "4px",
          },
          elements: {
            card: "shadow-none border border-white/10",
            headerTitle: "text-white",
            headerSubtitle: "text-white/50",
            formButtonPrimary: "bg-[#BB0A21] hover:opacity-85",
            footerActionLink: "text-[#BB0A21]",
          },
        }}
      />
    </div>
  );
}
