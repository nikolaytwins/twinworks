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
    const date = searchParams.get('date') // YYYY-MM-DD format
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    
    const db = getDb()
    let query = 'SELECT * FROM calls'
    const params: any[] = []
    
    if (date) {
      const tzOffset = searchParams.get('tzOffset')
      const offsetMs = tzOffset != null && tzOffset !== '' ? (parseInt(tzOffset, 10) || 0) * 60 * 1000 : 0
      const midnightUtc = new Date(date + 'T00:00:00.000Z').getTime()
      const startMs = midnightUtc + offsetMs
      const endMs = startMs + 86400000 - 1
      const dateStart = new Date(startMs).toISOString()
      const dateEnd = new Date(endMs).toISOString()
      query += ' WHERE date >= ? AND date <= ?'
      params.push(dateStart, dateEnd)
    } else if (startDate && endDate) {
      // Get calls for date range
      const start = new Date(startDate + 'T00:00:00Z').toISOString()
      const end = new Date(endDate + 'T23:59:59.999Z').toISOString()
      query += ' WHERE date >= ? AND date <= ?'
      params.push(start, end)
    }
    
    query += ' ORDER BY date ASC'
    
    const calls = db.prepare(query).all(...params) as any[]
    
    // Строгая фильтрация на стороне сервера - показываем ТОЛЬКО события конкретного дня
    let filteredCalls = calls
    if (date) {
      const tzOffset = searchParams.get('tzOffset')
      const offsetMs = tzOffset != null && tzOffset !== '' ? (parseInt(tzOffset, 10) || 0) * 60 * 1000 : 0
      filteredCalls = calls.filter((call: any) => {
        if (!call.date) return false
        const callDate = new Date(call.date)
        const callLocalMs = callDate.getTime() - offsetMs
        const callLocalStr = new Date(callLocalMs).toISOString().split('T')[0]
        return callLocalStr === date
      })
    } else if (startDate && endDate) {
      filteredCalls = calls.filter((call: any) => {
        if (!call.date) return false
        const callDate = new Date(call.date)
        const callDateStr = callDate.toISOString().split('T')[0]
        // Проверяем, что дата события попадает в диапазон
        return callDateStr >= startDate && callDateStr <= endDate
      })
    }
    
    db.close()
    
    return NextResponse.json(filteredCalls)
  } catch (error) {
    console.error('Error fetching calls:', error)
    return NextResponse.json({ error: 'Failed to fetch calls' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, date, endTime, duration, participant, notes } = body
    
    console.log('📥 POST /api/calls - Received data:', { title, date, endTime, duration, participant, notes })
    
    if (!title || !date) {
      return NextResponse.json({ error: 'Title and date are required' }, { status: 400 })
    }
    
    const db = getDb()
    const id = `call_${Date.now()}`
    
    // Parse date (should include time, e.g., "2026-01-18T14:30:00" or "2026-01-18 14:30")
    let callDate: Date
    try {
      if (date.includes('T')) {
        callDate = new Date(date)
      } else if (date.includes(' ')) {
        // Format: "YYYY-MM-DD HH:MM"
        callDate = new Date(date.replace(' ', 'T'))
      } else {
        // Only date provided, default to 12:00
        callDate = new Date(date + 'T12:00:00')
      }
      
      if (isNaN(callDate.getTime())) {
        throw new Error(`Invalid date format: ${date}`)
      }
    } catch (error) {
      console.error('❌ Error parsing date:', error)
      return NextResponse.json({ error: `Invalid date format: ${date}` }, { status: 400 })
    }

    let callEndTime: Date | null = null
    if (endTime) {
      try {
        if (endTime.includes('T')) {
          callEndTime = new Date(endTime)
        } else if (endTime.includes(' ')) {
          callEndTime = new Date(endTime.replace(' ', 'T'))
        } else {
          callEndTime = new Date(endTime + 'T12:00:00')
        }
        
        if (isNaN(callEndTime.getTime())) {
          console.warn('⚠️ Invalid endTime format, ignoring:', endTime)
          callEndTime = null
        }
      } catch (error) {
        console.warn('⚠️ Error parsing endTime, ignoring:', error)
        callEndTime = null
      }
    }
    
    const callDateISO = callDate.toISOString()
    const callEndTimeISO = callEndTime ? callEndTime.toISOString() : null
    
    console.log('💾 Inserting call:', { id, title, date: callDateISO, endTime: callEndTimeISO, duration, participant, notes })
    
    try {
      db.prepare(`
        INSERT INTO calls (id, title, date, endTime, duration, participant, notes, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(id, title, callDateISO, callEndTimeISO, duration || null, participant || null, notes || null)
      
      const call = db.prepare('SELECT * FROM calls WHERE id = ?').get(id)
      db.close()
      
      console.log('✅ Call created successfully:', call)
      return NextResponse.json({ success: true, call })
    } catch (dbError: any) {
      console.error('❌ Database error:', dbError)
      db.close()
      return NextResponse.json({ error: `Database error: ${dbError.message || 'Unknown error'}` }, { status: 500 })
    }
  } catch (error: any) {
    console.error('❌ Error creating call:', error)
    return NextResponse.json({ error: `Failed to create call: ${error.message || 'Unknown error'}` }, { status: 500 })
  }
}
