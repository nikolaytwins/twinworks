import { NextRequest, NextResponse } from 'next/server'
import Database from 'better-sqlite3'
import path from 'path'

const dbPath = path.join(process.cwd(), 'prisma', 'dev.db')

function getDb() {
  return new Database(dbPath)
}

export async function GET() {
  try {
    const db = getDb()
    const students = db.prepare(`
      SELECT s.*, 
        COALESCE(SUM(e.amount), 0) as totalExpenses
      FROM ImpulseStudent s
      LEFT JOIN ImpulseExpense e ON s.id = e.studentId
      GROUP BY s.id
      ORDER BY s.createdAt DESC
    `).all()
    db.close()
    return NextResponse.json(students)
  } catch (error) {
    console.error('Error fetching students:', error)
    return NextResponse.json({ error: 'Failed to fetch students' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, productType, totalAmount, paidAmount, deadline, status, trafficSource, notes } = body
    
    const db = getDb()
    const id = `stud_${Date.now()}`
    
    db.prepare(`
      INSERT INTO ImpulseStudent (id, name, productType, totalAmount, paidAmount, deadline, status, trafficSource, notes, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(
      id,
      name,
      productType,
      totalAmount || 0,
      paidAmount || 0,
      deadline || null,
      status || 'not_paid',
      trafficSource ?? null,
      notes || null
    )
    
    const student = db.prepare('SELECT * FROM ImpulseStudent WHERE id = ?').get(id)
    db.close()
    
    return NextResponse.json({ success: true, student })
  } catch (error) {
    console.error('Error creating student:', error)
    return NextResponse.json({ error: 'Failed to create student' }, { status: 500 })
  }
}
