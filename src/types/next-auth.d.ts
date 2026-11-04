import type { Role } from '@/generated/prisma/client'
import type { DefaultSession } from 'next-auth'

/**
 * Ergänzt die Typen von Auth.js um die anwendungsspezifischen Felder.
 * Die JWT-Erweiterung wird an beiden Stellen deklariert, weil next-auth den
 * Typ aus `@auth/core/jwt` re-exportiert.
 */
declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: Role
      mustChangePassword: boolean
      authProvider: 'LOCAL' | 'OIDC'
    } & DefaultSession['user']
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    uid?: string
    role?: Role
    mustChangePassword?: boolean
    authProvider?: 'LOCAL' | 'OIDC'
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    uid?: string
    role?: Role
    mustChangePassword?: boolean
    authProvider?: 'LOCAL' | 'OIDC'
  }
}

export {}
