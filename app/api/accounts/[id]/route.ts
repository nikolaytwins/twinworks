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
    const account = db.prepare('SELECT * FROM PersonalAccount WHERE id = ?').get(params.id)
    db.close()
    
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }
    
    return NextResponse.json(account)
  } catch (error) {
    console.error('Error fetching account:', error)
    return NextResponse.json({ error: 'Failed to fetch account' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const body = await request.json()
    const { name, type, currency, balance, notes } = body
    
    const db = getDb()
    const result = db.prepare(`
      UPDATE PersonalAccount 
      SET name = ?, type = ?, currency = ?, balance = ?, notes = ?, updatedAt = datetime('now')
      WHERE id = ?
    `).run(name, type, currency || 'RUB', balance || 0, notes || null, params.id)
    
    if (result.changes === 0) {
      db.close()
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }
    
    const account = db.prepare('SELECT * FROM PersonalAccount WHERE id = ?').get(params.id)
    db.close()
    
    return NextResponse.json({ success: true, account })
  } catch (error) {
    console.error('Error updating account:', error)
    return NextResponse.json({ error: 'Failed to update account' }, { status: 500 })
  }
}
