import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app'
import { prisma } from '../src/services/db'

describe('Unified Financial Statement & Movement Report API', () => {
  const app = createApp()
  let testBranchId: string
  let testSessionId: string

  beforeAll(async () => {
    const branch = await prisma.branch.findFirst({ where: { isActive: true } })
    const session = await prisma.academicSession.findFirst({ where: { isCurrent: true } })
    testBranchId = branch?.id || ''
    testSessionId = session?.id || ''
  })

  it('should return 200 and accurate statement for daily mode', async () => {
    const today = new Date().toISOString().split('T')[0]
    const res = await request(app)
      .get('/api/reports/statement')
      .query({
        branchId: testBranchId,
        sessionId: testSessionId,
        startDate: today,
        endDate: today,
      })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.summary).toBeDefined()
    expect(typeof res.body.summary.totalCollections).toBe('number')
    expect(typeof res.body.summary.totalExpenses).toBe('number')
    expect(typeof res.body.summary.netMovement).toBe('number')
    expect(res.body.summary.netMovement).toBe(
      res.body.summary.totalCollections - res.body.summary.totalExpenses
    )
    expect(Array.isArray(res.body.collections)).toBe(true)
    expect(Array.isArray(res.body.expenses)).toBe(true)
  })

  it('should return 200 and accurate statement for monthly mode', async () => {
    const res = await request(app)
      .get('/api/reports/statement')
      .query({
        branchId: 'ALL',
        sessionId: 'ALL',
        startDate: '2026-10-01',
        endDate: '2026-10-31',
      })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.summary.isProfit).toBe(res.body.summary.netMovement >= 0)
    expect(res.body.summary.collectionsByMode).toBeDefined()
    expect(res.body.summary.expensesByCategory).toBeDefined()
  })

  it('should return 200 and accurate statement for custom range mode', async () => {
    const res = await request(app)
      .get('/api/reports/statement')
      .query({
        startDate: '2026-06-01',
        endDate: '2026-12-31',
      })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.period.startDate).toBeDefined()
    expect(res.body.period.endDate).toBeDefined()
  })
})
