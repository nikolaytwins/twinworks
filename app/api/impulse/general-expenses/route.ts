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
    let expenses: any[] = []
    
    try {
      expenses = db.prepare('SELECT * FROM ImpulseGeneralExpense ORDER BY createdAt DESC').all() as any[]
    } catch (e) {
      // Table might not exist yet
      expenses = []
    }
    
    db.close()
    return NextResponse.json(expenses)
  } catch (error) {
    console.error('Error fetching general expenses:', error)
    return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { employeeName, employeeRole, amount, notes } = body
    
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Amount is required and must be greater than 0' }, { status: 400 })
    }
    
    const db = getDb()
    const id = `impexp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    db.prepare(`
      INSERT INTO ImpulseGeneralExpense (id, employeeName, employeeRole, amount, notes, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(id, employeeName || null, employeeRole || null, amount, notes || null)
    
    const expense = db.prepare('SELECT * FROM ImpulseGeneralExpense WHERE id = ?').get(id)
    db.close()
    
    if (!expense) {
      return NextResponse.json({ error: 'Failed to retrieve created expense' }, { status: 500 })
    }
    
    return NextResponse.json({ success: true, expense }, { status: 200 })
  } catch (error) {
    console.error('Error creating general expense:', error)
    return NextResponse.json({ error: 'Failed to create expense', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}
