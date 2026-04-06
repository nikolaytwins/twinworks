import { NextRequest, NextResponse } from 'next/server'
import Database from 'better-sqlite3'
import path from 'path'

const dbPath = path.join(process.cwd(), 'prisma', 'dev.db')

function getDb() {
  return new Database(dbPath)
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month')
    
    let query = `
      SELECT t.*, 
        fa.name as fromAccountName,
        ta.name as toAccountName
      FROM PersonalTransaction t
      LEFT JOIN PersonalAccount fa ON t.fromAccountId = fa.id
      LEFT JOIN PersonalAccount ta ON t.toAccountId = ta.id
    `
    
    const params: any[] = []
    
    if (month) {
      const [year, monthNum] = month.split('-').map(Number)
      const startDate = new Date(year, monthNum - 1, 1)
      const endDate = new Date(year, monthNum, 0, 23, 59, 59)
      query += ` WHERE t.date >= ? AND t.date <= ?`
      params.push(startDate.toISOString(), endDate.toISOString())
    }
    
    query += ` ORDER BY t.date DESC`
    
    const db = getDb()
    const transactions = db.prepare(query).all(...params)
    db.close()
    
    return NextResponse.json(transactions)
  } catch (error) {
    console.error('Error fetching transactions:', error)
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { date, type, amount, currency, category, description, fromAccountId, toAccountId } = body
    
    const db = getDb()
    const id = `t_${Date.now()}`
    
    db.prepare(`
      INSERT INTO PersonalTransaction (id, date, type, amount, currency, category, description, fromAccountId, toAccountId, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(
      id,
      date,
      type,
      amount,
      currency || 'RUB',
      category || null,
      description || null,
      fromAccountId || null,
      toAccountId || null
    )
    
    const transaction = db.prepare('SELECT * FROM PersonalTransaction WHERE id = ?').get(id)
    db.close()
    
    return NextResponse.json({ success: true, transaction })
  } catch (error) {
    console.error('Error creating transaction:', error)
    return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 })
  }
}
