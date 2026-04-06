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
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      return tomorrow
    case 'contact_established':
    case 'commercial_proposal':
      return today
    case 'thinking':
      const thinkingDate = new Date(today)
      thinkingDate.setDate(thinkingDate.getDate() + 1)
      return thinkingDate
    case 'paid':
    case 'pause':
      return null
    default:
      return null
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const db = getDb()
    const lead = db.prepare('SELECT * FROM agency_leads WHERE id = ?').get(id)
    db.close()
    
    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }
    
    return NextResponse.json(lead)
  } catch (error) {
    console.error('Error fetching lead:', error)
    return NextResponse.json({ error: 'Failed to fetch lead' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const body = await request.json()
    const { contact, source, taskDescription, status, nextContactDate } = body
    
    const db = getDb()
    
    // Получаем текущий лид
    const currentLead = db.prepare('SELECT * FROM agency_leads WHERE id = ?').get(id) as any
    if (!currentLead) {
      db.close()
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }
    
    // Если меняется статус и дата не была установлена вручную, обновляем дату автоматически
    let finalNextContactDate = currentLead.nextContactDate
    let finalManualDateSet = currentLead.manualDateSet ? 1 : 0
    
    if (nextContactDate !== undefined) {
      // Пользователь явно изменил дату (вручную)
      finalNextContactDate = nextContactDate || null
      finalManualDateSet = 1 // Помечаем, что дата установлена вручную
    } else if (status && status !== currentLead.status) {
      // Статус изменился, но дата не была изменена пользователем
      if (!currentLead.manualDateSet) {
        // Если дата не была установлена вручную, ставим автоматическую
        const autoDate = calculateNextContactDate(status)
        finalNextContactDate = autoDate ? autoDate.toISOString() : null
        finalManualDateSet = 0
      }
      // Если дата была установлена вручную, не трогаем её
    }
    
    db.prepare(`
      UPDATE agency_leads
      SET contact = COALESCE(?, contact),
          source = COALESCE(?, source),
          taskDescription = COALESCE(?, taskDescription),
          status = COALESCE(?, status),
          nextContactDate = ?,
          manualDateSet = ?,
          updatedAt = datetime('now')
      WHERE id = ?
    `).run(
      contact || null,
      source || null,
      taskDescription !== undefined ? (taskDescription || null) : null,
      status || null,
      finalNextContactDate,
      finalManualDateSet,
      id
    )
    
    // Сохраняем события в историю
    const historyId = `history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    if (status && status !== currentLead.status) {
      // Изменение статуса
      db.prepare(`
        INSERT INTO lead_history (id, leadId, eventType, oldStatus, newStatus, createdAt)
        VALUES (?, ?, 'status_changed', ?, ?, datetime('now'))
      `).run(historyId, id, currentLead.status, status)
    }
    
    if (source && source !== currentLead.source) {
      // Изменение источника
      const sourceHistoryId = `history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      db.prepare(`
        INSERT INTO lead_history (id, leadId, eventType, oldSource, newSource, createdAt)
        VALUES (?, ?, 'source_changed', ?, ?, datetime('now'))
      `).run(sourceHistoryId, id, currentLead.source, source)
    }
    
    if (nextContactDate !== undefined && nextContactDate !== currentLead.nextContactDate) {
      // Изменение даты
      const dateHistoryId = `history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      db.prepare(`
        INSERT INTO lead_history (id, leadId, eventType, oldDate, newDate, createdAt)
        VALUES (?, ?, 'date_changed', ?, ?, datetime('now'))
      `).run(dateHistoryId, id, currentLead.nextContactDate || null, nextContactDate || null)
    }
    
    const updatedLead = db.prepare('SELECT * FROM agency_leads WHERE id = ?').get(id)
    db.close()
    
    return NextResponse.json({ success: true, lead: updatedLead })
  } catch (error) {
    console.error('Error updating lead:', error)
    return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const db = getDb()
    
    const result = db.prepare('DELETE FROM agency_leads WHERE id = ?').run(id)
    db.close()
    
    if (result.changes === 0) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting lead:', error)
    return NextResponse.json({ error: 'Failed to delete lead' }, { status: 500 })
  }
}
