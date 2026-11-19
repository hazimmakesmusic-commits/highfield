"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Film, Home, Image as ImageIcon, Library, LogOut, Maximize2, Mic } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Home", icon: Home },
  { href: "/image", label: "Image", icon: ImageIcon },
  { href: "/video", label: "Video", icon: Film },
  { href: "/lipsync", label: "Lip Sync", icon: Mic },
  { href: "/upscale", label: "Upscale", icon: Maximize2 },
  { href: "/library", label: "Library", icon: Library },
];

export function Sidebar() {
  const path = usePathname();
  const router = useRouter();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }
  return (
    <aside className="flex shrink-0 items-center gap-1 overflow-x-auto border-b p-2 md:h-screen md:w-56 md:flex-col md:items-stretch md:border-b-0 md:border-r md:p-4 md:sticky md:top-0 md:self-start">
      <Link href="/" className="mr-2 flex items-center gap-2 px-2 md:mb-6 md:mr-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="" className="size-7" />
        <span className="hidden font-semibold tracking-tight sm:inline">Afterimage</span>
      </Link>
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? path === "/" : path.startsWith(href);
        return (
          <Link key={href} href={href}
            className={cn("flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
              active && "bg-muted text-foreground")}>
            <Icon className="size-4" /> {label}
          </Link>
        );
      })}
      <button onClick={logout} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground md:mt-auto">
        <LogOut className="size-4" /> <span className="hidden sm:inline">Sign out</span>
      </button>
    </aside>
  );
}
