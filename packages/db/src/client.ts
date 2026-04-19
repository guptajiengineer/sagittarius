import { PrismaClient } from '@prisma/client'
import { applyConsentLogImmutability } from './middleware'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

applyConsentLogImmutability(db)

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
}

export type { PrismaClient }
