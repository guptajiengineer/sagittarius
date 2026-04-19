import { describe, it, expect, vi } from 'vitest'
import { countScansInLast24Hours } from '../helpers'
import { db } from '../client'

vi.mock('../client', () => ({
  db: {
    scan: {
      count: vi.fn()
    }
  }
}))

describe('countScansInLast24Hours', () => {
  it('should return number of scans using a rolling 24 hour window', async () => {
    vi.mocked(db.scan.count).mockResolvedValue(5)
    
    const result = await countScansInLast24Hours('user123')
    
    expect(result).toBe(5)
    expect(db.scan.count).toHaveBeenCalledTimes(1)
    
    const callArgs = vi.mocked(db.scan.count).mock.calls[0]![0]!
    expect(callArgs.where?.userId).toBe('user123')
    
    const createdAtFilter = callArgs.where?.createdAt as { gte: Date }
    const gteDate = createdAtFilter.gte
    
    const now = new Date()
    const diffHours = (now.getTime() - gteDate.getTime()) / (1000 * 60 * 60)
    expect(diffHours).toBeCloseTo(24, 1)
  })
})
