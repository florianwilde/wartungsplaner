import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Führt Tailwind-Klassen zusammen und löst Konflikte auf. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
