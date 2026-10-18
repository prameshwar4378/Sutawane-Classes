import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app'
import { prisma } from '../src/services/db'

describe('Academic Session Validation & Management Suite', () => {
  const app = createApp()
  let createdSessionAId: string
  let createdSessionBId: string
  let emptySessionId: string

  beforeAll(async () => {
    // Clean up test sessions if present
    await prisma.receiptCounter.deleteMany({
      where: { session: { name: { in: ['TEST-SESS-A', 'TEST-SESS-B', 'TEST-SESS-EMPTY'] } } },
    })
    await prisma.academicSession.deleteMany({
      where: { name: { in: ['TEST-SESS-A', 'TEST-SESS-B', 'TEST-SESS-EMPTY'] } },
    })
  })

  afterAll(async () => {
    await prisma.receiptCounter.deleteMany({
      where: { session: { name: { in: ['TEST-SESS-A', 'TEST-SESS-B', 'TEST-SESS-EMPTY'] } } },
    })
    await prisma.academicSession.deleteMany({
      where: { name: { in: ['TEST-SESS-A', 'TEST-SESS-B', 'TEST-SESS-EMPTY'] } },
    })
  })

  it('1. should reject session creation if startDate >= endDate', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .send({
        name: 'TEST-INVALID-DATES',
        displayName: 'Invalid Dates',
        startDate: '2035-12-31',
        endDate: '2035-01-01',
      })

    expect(res.status).toBe(400)
    expect(res.body.error).toContain('strictly before End Date')
  })

  it('2. should create Session A successfully (e.g., 2035-01-01 to 2035-12-31)', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .send({
        name: 'TEST-SESS-A',
        displayName: 'Test Session A',
        startDate: '2035-01-01',
        endDate: '2035-12-31',
        isCurrent: false,
      })

    expect(res.status).toBe(201)
    expect(res.body.id).toBeDefined()
    createdSessionAId = res.body.id
  })

  it('3. should reject overlapping session as requested by user (e.g., 2035-08-05 to 2036-06-06)', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .send({
        name: 'TEST-OVERLAP-1',
        displayName: 'Overlapping Session',
        startDate: '2035-08-05',
        endDate: '2036-06-06',
      })

    expect(res.status).toBe(400)
    expect(res.body.error).toContain('Date overlap error')
    expect(res.body.error).toContain('Test Session A')
  })

  it('4. should reject overlapping session that envelopes Session A (2034-06-01 to 2036-01-01)', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .send({
        name: 'TEST-OVERLAP-2',
        displayName: 'Overlapping Envelope',
        startDate: '2034-06-01',
        endDate: '2036-01-01',
      })

    expect(res.status).toBe(400)
    expect(res.body.error).toContain('Date overlap error')
  })

  it('5. should allow creating non-overlapping Session B (2036-01-01 to 2036-12-31)', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .send({
        name: 'TEST-SESS-B',
        displayName: 'Test Session B',
        startDate: '2036-01-01',
        endDate: '2036-12-31',
      })

    expect(res.status).toBe(201)
    createdSessionBId = res.body.id
  })

  it('6. should reject update if updated dates overlap with another session', async () => {
    const res = await request(app)
      .put(`/api/sessions/${createdSessionBId}`)
      .send({
        name: 'TEST-SESS-B',
        displayName: 'Test Session B Updated',
        startDate: '2035-11-01', // Overlaps with Session A (which ends 2035-12-31)
        endDate: '2036-12-31',
      })

    expect(res.status).toBe(400)
    expect(res.body.error).toContain('Date overlap error')
  })

  it('7. should allow updating session within its own non-overlapping boundaries', async () => {
    const res = await request(app)
      .put(`/api/sessions/${createdSessionBId}`)
      .send({
        name: 'TEST-SESS-B',
        displayName: 'Updated Display Name B',
        startDate: '2036-02-01',
        endDate: '2036-11-30',
      })

    expect(res.status).toBe(200)
    expect(res.body.displayName).toBe('Updated Display Name B')
  })

  it('8. should create an empty session and allow deleting it', async () => {
    const createRes = await request(app)
      .post('/api/sessions')
      .send({
        name: 'TEST-SESS-EMPTY',
        displayName: 'Empty Test Session',
        startDate: '2038-01-01',
        endDate: '2038-12-31',
      })

    expect(createRes.status).toBe(201)
    emptySessionId = createRes.body.id

    const delRes = await request(app).delete(`/api/sessions/${emptySessionId}`)
    expect(delRes.status).toBe(200)
    expect(delRes.body.success).toBe(true)
  })

  it('9. should refuse to delete session if it has linked student admissions', async () => {
    // Find a non-current session with admissions or test current session refusal
    const sessionWithData = await prisma.academicSession.findFirst({
      where: {
        admissions: { some: {} },
      },
    })

    if (sessionWithData) {
      const res = await request(app).delete(`/api/sessions/${sessionWithData.id}`)
      expect(res.status).toBeGreaterThanOrEqual(400)
      expect(res.body.error).toMatch(/Cannot delete/i)
    }
  })
})
