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
    // Сортируем по полю order, а затем по имени, если order одинаковый
    const accounts = db.prepare('SELECT * FROM PersonalAccount ORDER BY COALESCE("order", 0) ASC, name ASC').all()
    db.close()
    return NextResponse.json(accounts)
  } catch (error) {
    console.error('Error fetching accounts:', error)
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, type, currency, balance, notes } = body
    
    const db = getDb()
    // Получаем максимальный order и добавляем 1 для нового счета
    const maxOrderResult = db.prepare('SELECT COALESCE(MAX("order"), 0) as maxOrder FROM PersonalAccount').get() as { maxOrder: number }
    const newOrder = (maxOrderResult?.maxOrder || 0) + 1
    
    const id = `acc_${Date.now()}`
    db.prepare(`
      INSERT INTO PersonalAccount (id, name, type, currency, balance, notes, "order", createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(id, name, type, currency || 'RUB', balance || 0, notes || null, newOrder)
    
    const account = db.prepare('SELECT * FROM PersonalAccount WHERE id = ?').get(id)
    db.close()
    
    return NextResponse.json({ success: true, account })
  } catch (error) {
    console.error('Error creating account:', error)
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { accountOrders } = body // массив { id, order }
    
    if (!Array.isArray(accountOrders)) {
      return NextResponse.json({ error: 'accountOrders must be an array' }, { status: 400 })
    }
    
    if (accountOrders.length === 0) {
      return NextResponse.json({ error: 'accountOrders array is empty' }, { status: 400 })
    }
    
    const db = getDb()
    const updateStmt = db.prepare('UPDATE PersonalAccount SET "order" = ?, updatedAt = datetime(\'now\') WHERE id = ?')
    
    // Используем транзакцию для атомарного обновления
    const updateMany = db.transaction((orders) => {
      for (const { id, order } of orders) {
        if (!id || order === undefined) {
          throw new Error(`Invalid account order: id=${id}, order=${order}`)
        }
        updateStmt.run(order, id)
      }
    })
    
    updateMany(accountOrders)
    db.close()
    
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Error updating account orders:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to update account orders'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
