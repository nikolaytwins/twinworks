import { NextRequest, NextResponse } from 'next/server'
import Database from 'better-sqlite3'
import path from 'path'

const dbPath = path.join(process.cwd(), 'prisma', 'dev.db')

function getDb() {
  return new Database(dbPath)
}

export async function GET() {
  const db = getDb()
  try {
    let categories: any[] = []
    
    try {
      categories = db.prepare('SELECT * FROM expense_categories ORDER BY type, name').all() as any[]
    } catch (e) {
      categories = []
    }
    
    const defaultCategories = [
      { name: 'Квартира', type: 'personal', expectedMonthly: 0 },
      { name: 'Коммуналка', type: 'personal', expectedMonthly: 0 },
      { name: 'Продукты', type: 'personal', expectedMonthly: 0 },
      { name: 'Бытовые расходы', type: 'personal', expectedMonthly: 0 },
      { name: 'Подписки + интернет + связь', type: 'personal', expectedMonthly: 0 },
      { name: 'Совместное время с Лерой', type: 'personal', expectedMonthly: 0 },
      { name: 'На Леру', type: 'personal', expectedMonthly: 0 },
      { name: 'На себя', type: 'personal', expectedMonthly: 0 },
      { name: 'Путешествия', type: 'personal', expectedMonthly: 0 },
      { name: 'Рабочие расходы', type: 'personal', expectedMonthly: 0 },
      { name: 'Семейный отдых', type: 'personal', expectedMonthly: 0 },
      { name: 'Подарки', type: 'personal', expectedMonthly: 0 },
      { name: 'Рестораны по необходимости', type: 'personal', expectedMonthly: 0 },
      { name: 'Транспорт', type: 'personal', expectedMonthly: 0 },
      { name: 'Другое', type: 'personal', expectedMonthly: 0 },
      { name: 'Зарплаты', type: 'business', expectedMonthly: 0 },
      { name: 'Подписки', type: 'business', expectedMonthly: 0 },
      { name: 'Налоги', type: 'business', expectedMonthly: 0 },
      { name: 'Реклама', type: 'business', expectedMonthly: 0 },
      { name: 'Обучение', type: 'business', expectedMonthly: 0 },
    ]
    
    const existingNames = categories.map(c => c.name.toLowerCase())
    let addedNew = false
    
    for (const cat of defaultCategories) {
      if (!existingNames.includes(cat.name.toLowerCase())) {
        const id = `cat_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
        try {
          const insertQuery = "INSERT INTO expense_categories (id, name, type, expectedMonthly, createdAt, updatedAt) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))"
          db.prepare(insertQuery).run(id, cat.name, cat.type, cat.expectedMonthly)
          addedNew = true
        } catch (e) {
          // Category might already exist
        }
      }
    }
    
    if (addedNew) {
      categories = db.prepare('SELECT * FROM expense_categories ORDER BY type, name').all() as any[]
    }
    
    db.close()
    return NextResponse.json(categories)
  } catch (error) {
    db.close()
    console.error('Error fetching categories:', error)
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, type, expectedMonthly } = body
    
    if (!name || !type) {
      return NextResponse.json({ error: 'Name and type are required' }, { status: 400 })
    }
    
    const db = getDb()
    const id = `cat_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
    
    try {
      db.prepare("INSERT INTO expense_categories (id, name, type, expectedMonthly, createdAt, updatedAt) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))").run(id, name.trim(), type, expectedMonthly || 0)
      
      const category = db.prepare('SELECT * FROM expense_categories WHERE id = ?').get(id)
      db.close()
      
      return NextResponse.json({ success: true, category }, { status: 200 })
    } catch (e: any) {
      db.close()
      console.error('Database error creating category:', e)
      if (e.message && (e.message.includes('UNIQUE constraint') || e.message.includes('UNIQUE'))) {
        return NextResponse.json({ error: 'Категория с таким названием уже существует' }, { status: 400 })
      }
      throw e
    }
  } catch (error: any) {
    console.error('Error creating category:', error)
    const errorMessage = error?.message || 'Failed to create category'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, expectedMonthly } = body
    
    const db = getDb()
    db.prepare('UPDATE expense_categories SET expectedMonthly = ?, updatedAt = datetime("now") WHERE id = ?').run(expectedMonthly, id)
    db.close()
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating category:', error)
    return NextResponse.json({ error: 'Failed to update category' }, { status: 500 })
  }
}
