import type { PrismaClient } from '@prisma/client'

/**
 * Registers Prisma middleware that prevents any UPDATE or DELETE
 * on the consent_log table. ConsentLog records are legal evidence
 * and must be immutable after creation.
 */
export function applyConsentLogImmutability(prisma: PrismaClient): void {
  prisma.$use(async (params: any, next: any) => {
    if (
      params.model === 'ConsentLog' &&
      (params.action === 'update' ||
        params.action === 'updateMany' ||
        params.action === 'delete' ||
        params.action === 'deleteMany')
    ) {
      throw new Error(
        '[SECURITY] ConsentLog records are immutable. Update/delete operations are prohibited.'
      )
    }
    return next(params)
  })
}
