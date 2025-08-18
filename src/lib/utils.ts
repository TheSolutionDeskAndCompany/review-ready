import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(input: string | number): string {
  const date = new Date(input)
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

export function absoluteUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_APP_URL || ''}${path}`
}

export function truncate(str: string, length: number) {
  if (!str) return ""
  return str.length > length ? `${str.substring(0, length)}...` : str
}

export function capitalize(str: string) {
  if (!str) return ""
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function formatRating(rating?: number): string {
  return rating ? rating.toFixed(1) : "N/A"
}

type ProviderIconProps = {
  className?: string
}

export function getProviderIcon(provider: string, { className = "h-5 w-5" }: ProviderIconProps = {}) {
  const baseClass = `inline-block ${className}`
  
  switch (provider.toLowerCase()) {
    case "google":
      return `text-google-blue ${baseClass} font-bold`
    case "yelp":
      return `text-yelp-red ${baseClass} font-bold`
    case "facebook":
      return `text-facebook-blue ${baseClass} font-bold`
    default:
      return baseClass
  }
}

export function formatCurrency(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount)
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'string' || Array.isArray(value)) return value.length === 0
  if (isObject(value)) return Object.keys(value).length === 0
  return false
}
