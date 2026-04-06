import { NextRequest, NextResponse } from 'next/server'
import Database from 'better-sqlite3'
import path from 'path'

const dbPath = path.join(process.cwd(), 'prisma', 'dev.db')

function getDb() {
  return new Database(dbPath)
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const db = getDb()
    const student = db.prepare('SELECT * FROM ImpulseStudent WHERE id = ?').get(params.id) as any
    db.close()
    
    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }
    
    return NextResponse.json(student)
  } catch (error) {
    console.error('Error fetching student:', error)
    return NextResponse.json({ error: 'Failed to fetch student' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const body = await request.json()
    const { name, productType, totalAmount, paidAmount, deadline, status, trafficSource, notes } = body
    
    const db = getDb()
    db.prepare(`
      UPDATE ImpulseStudent 
      SET name = ?, productType = ?, totalAmount = ?, paidAmount = ?, deadline = ?, status = ?, trafficSource = ?, notes = ?, updatedAt = datetime('now')
      WHERE id = ?
    `).run(name, productType, totalAmount, paidAmount || 0, deadline || null, status, trafficSource ?? null, notes || null, params.id)
    
    const student = db.prepare('SELECT * FROM ImpulseStudent WHERE id = ?').get(params.id) as any
    db.close()
    
    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }
    
    return NextResponse.json({ success: true, student })
  } catch (error) {
    console.error('Error updating student:', error)
    return NextResponse.json({ error: 'Failed to update student' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const db = getDb()
    db.prepare('DELETE FROM ImpulseStudent WHERE id = ?').run(params.id)
    db.close()
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting student:', error)
    return NextResponse.json({ error: 'Failed to delete student' }, { status: 500 })
  }
}
