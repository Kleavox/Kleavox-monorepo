//app/verify/page.tsx

import DeauBitLogo from "@/components/DeauBitLogo";
import VerifyForm from "@/components/VerifyForm";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function VerifyPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center mb-4">
            <DeauBitLogo size={60} />
        </div>

        <VerifyForm />

        <div className="text-center">
          <Link href="/register" className="inline-flex items-center gap-2 font-bold text-sm text-(--db-text-muted) hover:text-(--db-text) transition-colors">
            <ArrowLeft className="h-4 w-4" /> Incorrect Email? Go Back
          </Link>
        </div>
      </div>

    </div>
  );
}
