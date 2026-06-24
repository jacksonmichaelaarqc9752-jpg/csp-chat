import Link from "next/link";
import { cn } from "@/lib/utils";

export function GlassPanel({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <section className={cn("glass rounded-[28px]", className)}>{children}</section>;
}

export function PrimaryButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-400 via-fuchsia-400 to-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 shadow-glow transition active:scale-[0.98] disabled:opacity-60",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function GhostLink({
  children,
  href,
  className
}: {
  children: React.ReactNode;
  href: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/8 px-4 py-2 text-sm font-medium text-slate-100 backdrop-blur transition hover:bg-white/14 active:scale-[0.98]",
        className
      )}
    >
      {children}
    </Link>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "min-h-12 w-full rounded-2xl border border-white/10 bg-slate-950/35 px-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-pink-300/60 focus:ring-4 focus:ring-pink-300/10",
        props.className
      )}
    />
  );
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "w-full resize-none rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-500 focus:border-pink-300/60 focus:ring-4 focus:ring-pink-300/10",
        props.className
      )}
    />
  );
}

export function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-slate-200">
      {children}
    </span>
  );
}
