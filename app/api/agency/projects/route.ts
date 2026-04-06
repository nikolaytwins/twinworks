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
    const projects = db.prepare(`
      SELECT p.*, 
        COALESCE(SUM(e.amount), 0) as totalExpenses
      FROM AgencyProject p
      LEFT JOIN AgencyExpense e ON p.id = e.projectId
      GROUP BY p.id
      ORDER BY p.createdAt DESC
    `).all()
    db.close()
    return NextResponse.json(projects)
  } catch (error) {
    console.error('Error fetching projects:', error)
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, totalAmount, paidAmount, deadline, status, serviceType, clientType, paymentMethod, clientContact, notes } = body
    
    const db = getDb()
    const id = `proj_${Date.now()}`
    
    db.prepare(`
      INSERT INTO AgencyProject (id, name, totalAmount, paidAmount, deadline, status, serviceType, clientType, paymentMethod, clientContact, notes, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(
      id,
      name,
      totalAmount || 0,
      paidAmount || 0,
      deadline || null,
      status || 'not_paid',
      serviceType,
      clientType || null,
      paymentMethod || null,
      clientContact || null,
      notes || null
    )
    
    const project = db.prepare('SELECT * FROM AgencyProject WHERE id = ?').get(id)
    db.close()
    
    return NextResponse.json({ success: true, project })
  } catch (error) {
    console.error('Error creating project:', error)
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
  }
}
