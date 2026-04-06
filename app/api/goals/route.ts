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
    const goals = db.prepare(`
      SELECT g.*, a.balance as linkedAccountBalance, a.name as linkedAccountName
      FROM PersonalGoal g
      LEFT JOIN PersonalAccount a ON g.linkedAccountId = a.id
      ORDER BY g.deadline ASC
    `).all()
    
    const accounts = db.prepare('SELECT id, name FROM PersonalAccount ORDER BY name ASC').all()
    db.close()
    
    return NextResponse.json({ goals, accounts })
  } catch (error) {
    console.error('Error fetching goals:', error)
    return NextResponse.json({ error: 'Failed to fetch goals' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, targetAmount, currentAmount, linkedAccountId, notes } = body
    
    if (!name || !targetAmount) {
      return NextResponse.json({ error: 'Name and targetAmount are required' }, { status: 400 })
    }
    
    const db = getDb()
    const id = `goal_${Date.now()}`
    
    // Используем дефолтные значения для period и deadline (они не используются, но нужны для совместимости)
    db.prepare(`
      INSERT INTO PersonalGoal (id, period, name, targetAmount, currentAmount, linkedAccountId, deadline, notes, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(
      id,
      'month', // дефолтное значение для совместимости
      name,
      targetAmount,
      currentAmount || 0,
      linkedAccountId || null,
      null, // deadline не используется
      notes || null
    )
    
    const goal = db.prepare('SELECT * FROM PersonalGoal WHERE id = ?').get(id)
    db.close()
    
    return NextResponse.json({ success: true, goal })
  } catch (error) {
    console.error('Error creating goal:', error)
    return NextResponse.json({ error: 'Failed to create goal' }, { status: 500 })
  }
}
