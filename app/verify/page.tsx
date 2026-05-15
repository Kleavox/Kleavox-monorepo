//app/verify/page.tsx

import VerifyForm from "@/components/VerifyForm";
import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";

export default function VerifyPage() {
  return (
    <div className="db-card w-full max-w-md p-8 sm:p-10 shadow-2xl animate-reveal border-(--db-border) space-y-8">
      <VerifyForm />
      <div className="text-center border-t border-(--db-border)/30 pt-6">
        <Link
          href="/register"
          className="nothing-label text-[9px] hover:text-(--db-text) flex items-center justify-center gap-2 transition-colors"
        >
          <ArrowLeft size={12} />
          <span className="underline">INCORRECT_EMAIL?_BACK</span>
        </Link>
      </div>
    </div>
  );
}
