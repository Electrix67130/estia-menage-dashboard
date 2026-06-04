import Link from "next/link";
import Providers from "@/app/providers";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <div className="flex min-h-screen flex-1 items-center justify-center bg-zinc-50 px-6 py-12 dark:bg-zinc-950">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-8 flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-estia.svg"
              alt="Estia"
              className="h-24 w-auto dark:hidden"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-estia-blanc.svg"
              alt="Estia"
              className="hidden h-24 w-auto dark:block"
            />
          </Link>
          <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            {children}
          </div>
        </div>
      </div>
    </Providers>
  );
}
