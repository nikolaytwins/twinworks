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
    const year = searchParams.get('year')
    const month = searchParams.get('month')
    
    const db = getDb()
    const today = new Date()
    const targetYear = year ? parseInt(year) : today.getFullYear()
    const targetMonth = month ? parseInt(month) : today.getMonth() + 1
    
    const expenses = db.prepare(`
      SELECT * FROM one_time_expenses
      WHERE year = ? AND month = ?
      ORDER BY createdAt DESC
    `).all(targetYear, targetMonth) as any[]
    
    db.close()
    return NextResponse.json(expenses)
  } catch (error) {
    console.error('Error fetching one-time expenses:', error)
    return NextResponse.json({ error: 'Failed to fetch one-time expenses' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, amount, month, year, paid, type } = body
    
    if (!name || !amount || !month || !year) {
      return NextResponse.json({ error: 'Name, amount, month, and year are required' }, { status: 400 })
    }
    
    const db = getDb()
    const id = `exp_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
    const expenseType = type || 'personal' // По умолчанию личные расходы
    
    db.prepare(`
      INSERT INTO one_time_expenses (id, name, amount, month, year, paid, type, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(id, name, parseFloat(amount), month, year, paid ? 1 : 0, expenseType)
    
    const expense = db.prepare('SELECT * FROM one_time_expenses WHERE id = ?').get(id)
    db.close()
    
    return NextResponse.json({ success: true, expense })
  } catch (error) {
    console.error('Error creating one-time expense:', error)
    return NextResponse.json({ error: 'Failed to create one-time expense' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, paid, name, amount, type } = body
    
    console.log('📥 Получен запрос на обновление расхода:', { id, paid, name, amount, type })
    
    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }
    
    const db = getDb()
    
    // Нормализуем значение paid: любое truthy значение -> 1, иначе -> 0
    // Это важно, потому что из фронтенда может прийти true/false, 1/0, "1"/"0"
    const normalizePaid = (value: any): number => {
      if (value === true || value === 1 || value === '1' || value === 'true') {
        return 1
      }
      return 0
    }
    
    // Если передано только paid - обновляем только его (для переключения галочки)
    // Важно: проверяем, что другие поля НЕ переданы (undefined или null)
    const isOnlyPaidUpdate = paid !== undefined && 
                              (name === undefined || name === null) && 
                              (amount === undefined || amount === null) && 
                              (type === undefined || type === null)
    
    if (isOnlyPaidUpdate) {
      const paidValue = normalizePaid(paid)
      console.log(`🔄 Обновление ТОЛЬКО статуса оплаты для расхода ${id}:`)
      console.log(`   Входящее значение paid: ${paid} (тип: ${typeof paid})`)
      console.log(`   Нормализованное значение: ${paidValue}`)
      
      const result = db.prepare(`
        UPDATE one_time_expenses
        SET paid = ?
        WHERE id = ?
      `).run(paidValue, id)
      
      console.log(`   Строк обновлено: ${result.changes}`)
      
      // Проверяем, что обновление прошло
      const updated = db.prepare('SELECT paid, name FROM one_time_expenses WHERE id = ?').get(id) as any
      console.log(`✅ Статус обновлен в БД для "${updated?.name}": paid = ${updated?.paid} (тип: ${typeof updated?.paid})`)
    } else {
      // Полное редактирование всех полей
      const updates: string[] = []
      const values: any[] = []
      
      if (name !== undefined) {
        updates.push('name = ?')
        values.push(name)
      }
      if (amount !== undefined) {
        updates.push('amount = ?')
        values.push(parseFloat(amount))
      }
      if (type !== undefined) {
        updates.push('type = ?')
        values.push(type)
      }
      if (paid !== undefined) {
        updates.push('paid = ?')
        // Нормализуем значение paid
        const paidValue = (paid === true || paid === 1 || paid === '1' || paid === 'true') ? 1 : 0
        values.push(paidValue)
        console.log(`🔄 Обновление paid в полном редактировании: ${paid} -> ${paidValue}`)
      }
      
      if (updates.length === 0) {
        return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
      }
      
      values.push(id)
      db.prepare(`
        UPDATE one_time_expenses
        SET ${updates.join(', ')}
        WHERE id = ?
      `).run(...values)
    }
    
    const expense = db.prepare('SELECT * FROM one_time_expenses WHERE id = ?').get(id) as any
    db.close()
    
    if (!expense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    }
    
    console.log(`📤 Возвращаем обновленный расход:`, {
      id: expense.id,
      name: expense.name,
      paid: expense.paid,
      paidType: typeof expense.paid
    })
    
    return NextResponse.json({ success: true, expense })
  } catch (error) {
    console.error('Error updating one-time expense:', error)
    return NextResponse.json({ error: 'Failed to update one-time expense' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }
    
    const db = getDb()
    db.prepare('DELETE FROM one_time_expenses WHERE id = ?').run(id)
    db.close()
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting one-time expense:', error)
    return NextResponse.json({ error: 'Failed to delete one-time expense' }, { status: 500 })
  }
}
