import { NextRequest, NextResponse } from 'next/server'
import Database from 'better-sqlite3'
import path from 'path'

const dbPath = path.join(process.cwd(), 'prisma', 'dev.db')

function getDb() {
  return new Database(dbPath)
}

// Функция для вычисления автоматической даты следующего касания
function calculateNextContactDate(status: string): Date | null {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  switch (status) {
    case 'new':
      // today + 1 day
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      return tomorrow
    case 'contact_established':
    case 'commercial_proposal':
      // today
      return today
    case 'thinking':
      // today + 1 day
      const thinkingDate = new Date(today)
      thinkingDate.setDate(thinkingDate.getDate() + 1)
      return thinkingDate
    case 'paid':
    case 'pause':
      // автоматическая дата не ставится
      return null
    default:
      return null
  }
}

export async function GET() {
  try {
    const db = getDb()
    
    // Проверяем, существует ли таблица
    try {
      const tableInfo = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='agency_leads'").get()
      if (!tableInfo) {
        db.close()
        return NextResponse.json([])
      }
    } catch (e) {
      db.close()
      return NextResponse.json([])
    }
    
    const leads = db.prepare(`
      SELECT * FROM agency_leads
      ORDER BY 
        CASE status
          WHEN 'new' THEN 1
          WHEN 'contact_established' THEN 2
          WHEN 'commercial_proposal' THEN 3
          WHEN 'thinking' THEN 4
          WHEN 'paid' THEN 5
          WHEN 'pause' THEN 6
        END,
        createdAt DESC
    `).all()
    db.close()
    return NextResponse.json(Array.isArray(leads) ? leads : [])
  } catch (error) {
    console.error('Error fetching leads:', error)
    // Возвращаем пустой массив вместо ошибки, чтобы не ломать UI
    return NextResponse.json([])
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { contact, source, taskDescription, status = 'new' } = body
    
    if (!contact || !source) {
      return NextResponse.json({ error: 'Contact and source are required' }, { status: 400 })
    }
    
    const db = getDb()
    
    // Вычисляем автоматическую дату, если статус требует этого
    const autoDate = calculateNextContactDate(status)
    const nextContactDate = autoDate ? autoDate.toISOString() : null
    const manualDateSet = false // При создании дата всегда автоматическая
    
    const id = `lead_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    db.prepare(`
      INSERT INTO agency_leads (id, contact, source, taskDescription, status, nextContactDate, manualDateSet, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(id, contact, source, taskDescription || null, status, nextContactDate, manualDateSet ? 1 : 0)
    
    // Сохраняем событие создания в историю
    const historyId = `history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    db.prepare(`
      INSERT INTO lead_history (id, leadId, eventType, newStatus, newSource, createdAt)
      VALUES (?, ?, 'created', ?, ?, datetime('now'))
    `).run(historyId, id, status, source)
    
    const lead = db.prepare('SELECT * FROM agency_leads WHERE id = ?').get(id)
    db.close()
    
    return NextResponse.json({ success: true, lead })
  } catch (error) {
    console.error('Error creating lead:', error)
    return NextResponse.json({ error: 'Failed to create lead: ' + (error instanceof Error ? error.message : String(error)) }, { status: 500 })
  }
}
