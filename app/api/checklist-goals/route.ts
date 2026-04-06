import { NextRequest, NextResponse } from 'next/server'
import Database from 'better-sqlite3'
import path from 'path'

const dbPath = path.join(process.cwd(), 'prisma', 'dev.db')

function getDb() {
  return new Database(dbPath)
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period')
    
    const db = getDb()
    let query = 'SELECT * FROM checklist_goals'
    const params: any[] = []
    
    if (period) {
      query += ' WHERE period = ?'
      params.push(period)
    }
    
    query += ' ORDER BY "order" ASC, createdAt ASC'
    
    const goals = db.prepare(query).all(...params)
    db.close()
    
    return NextResponse.json(goals, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  } catch (error) {
    console.error('Error fetching checklist goals:', error)
    return NextResponse.json({ error: 'Failed to fetch goals' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { period, title, notes, optional } = body
    
    if (!period || !title) {
      return NextResponse.json({ error: 'Period and title are required' }, { status: 400 })
    }
    
    const db = getDb()
    const id = `check_${Date.now()}`
    
    const maxOrder = db.prepare('SELECT COALESCE(MAX("order"), 0) as maxOrder FROM checklist_goals WHERE period = ?').get(period) as any
    const order = (maxOrder?.maxOrder || 0) + 1
    
    const priority = body.priority === 'high' || body.priority === 'low' ? body.priority : 'medium'
    const optionalVal = optional === true || optional === 1 ? 1 : 0
    db.prepare(`
      INSERT INTO checklist_goals (id, period, title, completed, "order", priority, notes, optional, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(id, period, title, 0, order, priority, notes || null, optionalVal)
    
    const goal = db.prepare('SELECT * FROM checklist_goals WHERE id = ?').get(id)
    db.close()
    
    console.log('Goal created successfully:', goal)
    return NextResponse.json({ success: true, goal })
  } catch (error: any) {
    console.error('Error creating checklist goal:', error)
    console.error('Error details:', error.message, error.stack)
    return NextResponse.json({ 
      error: 'Failed to create goal',
      details: error.message 
    }, { status: 500 })
  }
}
