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
    
    // Get or create settings
    let settings = db.prepare('SELECT * FROM expense_settings LIMIT 1').get() as any
    if (!settings) {
      const id = 'expense_settings_1'
      db.prepare(`
        INSERT INTO expense_settings (id, dailyExpenseLimit, updatedAt)
        VALUES (?, 3500, datetime('now'))
      `).run(id)
      settings = db.prepare('SELECT * FROM expense_settings LIMIT 1').get() as any
    }
    
    // Get one-time expenses for current month
    const today = new Date()
    const year = today.getFullYear()
    const month = today.getMonth() + 1
    
    const oneTimeExpenses = db.prepare(`
      SELECT * FROM one_time_expenses
      WHERE year = ? AND month = ?
      ORDER BY createdAt DESC
    `).all(year, month) as any[]
    
    db.close()
    
    return NextResponse.json({
      dailyExpenseLimit: settings.dailyExpenseLimit || 3500,
      oneTimeExpenses: oneTimeExpenses || [],
    })
  } catch (error) {
    console.error('Error fetching expense settings:', error)
    return NextResponse.json({ error: 'Failed to fetch expense settings' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { dailyExpenseLimit } = body
    
    const db = getDb()
    
    // Get or create settings
    let settings = db.prepare('SELECT id FROM expense_settings LIMIT 1').get() as any
    if (!settings) {
      const id = 'expense_settings_1'
      db.prepare(`
        INSERT INTO expense_settings (id, dailyExpenseLimit, updatedAt)
        VALUES (?, ?, datetime('now'))
      `).run(id, dailyExpenseLimit || 3500)
    } else {
      db.prepare(`
        UPDATE expense_settings
        SET dailyExpenseLimit = ?, updatedAt = datetime('now')
        WHERE id = ?
      `).run(dailyExpenseLimit || 3500, settings.id)
    }
    
    db.close()
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating expense settings:', error)
    return NextResponse.json({ error: 'Failed to update expense settings' }, { status: 500 })
  }
}
