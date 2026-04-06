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
    const goal = db.prepare('SELECT * FROM PersonalGoal WHERE id = ?').get(params.id)
    db.close()
    
    if (!goal) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
    }
    
    return NextResponse.json(goal)
  } catch (error) {
    console.error('Error fetching goal:', error)
    return NextResponse.json({ error: 'Failed to fetch goal' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const body = await request.json()
    const { name, targetAmount, currentAmount, linkedAccountId, notes } = body
    
    if (!name || !targetAmount) {
      return NextResponse.json({ error: 'Name and targetAmount are required' }, { status: 400 })
    }
    
    const db = getDb()
    // Обновляем только нужные поля, период и дедлайн оставляем как есть (они не используются)
    db.prepare(`
      UPDATE PersonalGoal 
      SET name = ?, targetAmount = ?, currentAmount = ?, linkedAccountId = ?, notes = ?, updatedAt = datetime('now')
      WHERE id = ?
    `).run(name, targetAmount, currentAmount || 0, linkedAccountId || null, notes || null, params.id)
    
    const goal = db.prepare('SELECT * FROM PersonalGoal WHERE id = ?').get(params.id)
    db.close()
    
    if (!goal) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
    }
    
    return NextResponse.json({ success: true, goal }, { status: 200 })
  } catch (error) {
    console.error('Error updating goal:', error)
    return NextResponse.json({ error: 'Failed to update goal' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const db = getDb()
    db.prepare('DELETE FROM PersonalGoal WHERE id = ?').run(params.id)
    db.close()
    
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Error deleting goal:', error)
    return NextResponse.json({ error: 'Failed to delete goal' }, { status: 500 })
  }
}
