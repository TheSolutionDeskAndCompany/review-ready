"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { signOut } from "next-auth/react"

export function MainNav() {
  const pathname = usePathname()

  const items = [
    {
      href: "/dashboard",
      label: "Dashboard",
      active: pathname === "/dashboard",
    },
    {
      href: "/reviews",
      label: "Reviews",
      active: pathname.startsWith("/reviews"),
    },
    {
      href: "/settings",
      label: "Settings",
      active: pathname.startsWith("/settings"),
    },
  ]

  return (
    <div className="flex h-16 items-center border-b px-4">
      <div className="flex items-center">
        <Link href="/dashboard" className="flex items-center space-x-2">
          <span className="text-xl font-bold">ReviewReady</span>
        </Link>
      </div>
      <nav className="ml-6 flex items-center space-x-4 lg:space-x-6">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "text-sm font-medium transition-colors hover:text-primary",
              item.active ? "text-primary" : "text-muted-foreground"
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="ml-auto flex items-center space-x-4">
        <Button
          variant="outline"
          onClick={() => signOut({ callbackUrl: "/auth/signin" })}
        >
          Sign out
        </Button>
      </div>
    </div>
  )
}
