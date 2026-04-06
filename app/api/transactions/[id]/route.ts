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
    const transaction = db.prepare(`
      SELECT t.*, 
        fa.name as fromAccountName,
        ta.name as toAccountName
      FROM PersonalTransaction t
      LEFT JOIN PersonalAccount fa ON t.fromAccountId = fa.id
      LEFT JOIN PersonalAccount ta ON t.toAccountId = ta.id
      WHERE t.id = ?
    `).get(params.id)
    db.close()
    
    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }
    
    return NextResponse.json(transaction)
  } catch (error) {
    console.error('Error fetching transaction:', error)
    return NextResponse.json({ error: 'Failed to fetch transaction' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const body = await request.json()
    const { date, type, amount, currency, category, description, fromAccountId, toAccountId } = body
    
    const db = getDb()
    db.prepare(`
      UPDATE PersonalTransaction 
      SET date = ?, type = ?, amount = ?, currency = ?, category = ?, description = ?, 
          fromAccountId = ?, toAccountId = ?, updatedAt = datetime('now')
      WHERE id = ?
    `).run(
      date,
      type,
      amount,
      currency || 'RUB',
      category || null,
      description || null,
      fromAccountId || null,
      toAccountId || null,
      params.id
    )
    
    const transaction = db.prepare(`
      SELECT t.*, 
        fa.name as fromAccountName,
        ta.name as toAccountName
      FROM PersonalTransaction t
      LEFT JOIN PersonalAccount fa ON t.fromAccountId = fa.id
      LEFT JOIN PersonalAccount ta ON t.toAccountId = ta.id
      WHERE t.id = ?
    `).get(params.id)
    db.close()
    
    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }
    
    return NextResponse.json({ success: true, transaction }, { status: 200 })
  } catch (error) {
    console.error('Error updating transaction:', error)
    return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const db = getDb()
    db.prepare('DELETE FROM PersonalTransaction WHERE id = ?').run(params.id)
    db.close()
    
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Error deleting transaction:', error)
    return NextResponse.json({ error: 'Failed to delete transaction' }, { status: 500 })
  }
}
