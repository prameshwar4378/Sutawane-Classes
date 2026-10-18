import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app'
import { prisma } from '../src/services/db'

describe('Dynamic Classes & Courses API Suite', () => {
  const app = createApp()
  let testCourseId: string
  const testCourseName = 'Test Robotics & AI ' + Date.now()

  afterAll(async () => {
    // Cleanup test course if still exists
    await prisma.course.deleteMany({
      where: { name: { startsWith: 'Test Robotics & AI' } },
    })
    await prisma.$disconnect()
  })

  it('GET /api/courses - should auto-seed default courses and list them with enrolled counts', async () => {
    const res = await request(app).get('/api/courses')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.length).toBeGreaterThanOrEqual(8)

    // Should include standard classes
    const courseNames = res.body.map((c: any) => c.name)
    expect(courseNames).toContain('Class 8')
    expect(courseNames).toContain('Class 10')
    expect(courseNames).toContain('Class 12 Science')

    // Each course should have enrolledCount property
    expect(typeof res.body[0].enrolledCount).toBe('number')
  })

  it('POST /api/courses - should create a new dynamic course', async () => {
    const res = await request(app)
      .post('/api/courses')
      .send({
        name: testCourseName,
        code: 'ROBO-AI',
        description: 'Advanced Robotics and AI for High Schoolers',
        defaultFee: 30000,
        sortOrder: 15,
        isActive: true,
      })

    expect(res.status).toBe(201)
    expect(res.body.id).toBeDefined()
    expect(res.body.name).toBe(testCourseName)
    expect(res.body.code).toBe('ROBO-AI')
    expect(res.body.defaultFee).toBe(30000)
    expect(res.body.isActive).toBe(true)
    expect(res.body.enrolledCount).toBe(0)

    testCourseId = res.body.id
  })

  it('POST /api/courses - should reject duplicate course names', async () => {
    const res = await request(app)
      .post('/api/courses')
      .send({
        name: testCourseName,
        code: 'ROBO-2',
      })

    expect(res.status).toBe(409)
    expect(res.body.error).toMatch(/already exists/i)
  })

  it('PUT /api/courses/:id - should update course fee and description', async () => {
    const res = await request(app)
      .put(`/api/courses/${testCourseId}`)
      .send({
        name: testCourseName,
        defaultFee: 35000,
        description: 'Updated Robotics description',
      })

    expect(res.status).toBe(200)
    expect(res.body.defaultFee).toBe(35000)
    expect(res.body.description).toBe('Updated Robotics description')
  })

  it('DELETE /api/courses/:id - should delete course when no students enrolled', async () => {
    const res = await request(app).delete(`/api/courses/${testCourseId}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    // Verify course is gone
    const verify = await prisma.course.findUnique({ where: { id: testCourseId } })
    expect(verify).toBeNull()
  })

  it('DELETE /api/courses/:id - should block deletion if student admissions are enrolled', async () => {
    // Find a course that has enrolled students (or create an admission for Class 10)
    let class10 = await prisma.course.findUnique({ where: { name: 'Class 10' } })
    expect(class10).toBeDefined()

    // Create a dummy student admission with standard 'Class 10' if none exists
    const branch = await prisma.branch.findFirst({ where: { isActive: true } })
    const session = await prisma.academicSession.findFirst({ where: { isCurrent: true } })

    const student = await prisma.student.create({
      data: {
        studentCode: 'TEST-STD-' + Date.now(),
        fullName: 'Test Enrollment Student',
        parentPhone: '9998887776',
      },
    })

    const admission = await prisma.studentAdmission.create({
      data: {
        studentId: student.id,
        branchId: branch!.id,
        sessionId: session!.id,
        standard: 'Class 10',
        rollNumber: 'ROLL-' + Date.now(),
      },
    })

    // Now try to delete Class 10
    const res = await request(app).delete(`/api/courses/${class10!.id}`)
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/Cannot delete course.*currently enrolled/i)

    // Clean up dummy admission and student
    await prisma.studentAdmission.delete({ where: { id: admission.id } })
    await prisma.student.delete({ where: { id: student.id } })
  })
})
