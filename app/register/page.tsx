//app/register/page.tsx

import DeauBitLogo from "@/components/DeauBitLogo";
import RegisterForm from "@/components/RegisterForm";
import Link from "next/link";

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg space-y-8">
        
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="p-4 bg-(--db-surface) border-4 border-(--db-border) shadow-[6px_6px_0px_0px_var(--db-border)]">
            <DeauBitLogo size={50} />
          </div>
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter text-(--db-text)">Join DeauBit</h1>
            <p className="text-(--db-text-muted) font-bold">Start shortening links like a pro.</p>
          </div>
        </div>

        <RegisterForm />

        <div className="text-center">
          <span className="font-bold text-(--db-text-muted)">Already have an account? </span>
          <Link href="/" className="font-black text-(--db-primary) hover:bg-(--db-primary) hover:text-(--db-primary-fg) px-1 border-2 border-transparent hover:border-(--db-border) transition-all uppercase">
            Login Here
          </Link>
        </div>

      </div>
    </div>
  );
}
