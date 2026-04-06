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
    let query = 'SELECT id, title, description, date, completed, isKey, priority, "order", createdAt, updatedAt FROM daily_tasks'
    const params: any[] = []
    
    if (date) {
      // Локальная дата пользователя: 00:00–23:59 в его часовом поясе
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
      // Get tasks for date range
      const start = new Date(startDate + 'T00:00:00Z').toISOString()
      const end = new Date(endDate + 'T23:59:59.999Z').toISOString()
      query += ' WHERE date >= ? AND date <= ?'
      params.push(start, end)
    }
    
    query += ' ORDER BY date ASC, "order" ASC, createdAt ASC'
    
    const tasks = db.prepare(query).all(...params) as any[]
    
    // Строгая фильтрация на стороне сервера - показываем ТОЛЬКО задачи конкретного дня
    let filteredTasks = tasks
    if (date) {
      const tzOffset = searchParams.get('tzOffset')
      const offsetMs = tzOffset != null ? parseInt(tzOffset, 10) * 60 * 1000 : 0
      filteredTasks = tasks.filter((task: any) => {
        if (!task.date) return false
        const taskDate = new Date(task.date)
        const taskLocalMs = taskDate.getTime() - offsetMs
        const taskLocalStr = new Date(taskLocalMs).toISOString().split('T')[0]
        return taskLocalStr === date
      })
    } else if (startDate && endDate) {
      filteredTasks = tasks.filter((task: any) => {
        if (!task.date) return false
        const taskDate = new Date(task.date)
        const taskDateStr = taskDate.toISOString().split('T')[0]
        // Проверяем, что дата задачи попадает в диапазон
        return taskDateStr >= startDate && taskDateStr <= endDate
      })
    }
    
    // Убеждаемся, что у всех задач есть priority
    const tasksWithPriority = filteredTasks.map((task: any) => ({
      ...task,
      priority: task.priority || 'movable'
    }))
    
    db.close()
    
    return NextResponse.json(tasksWithPriority)
  } catch (error) {
    console.error('Error fetching daily tasks:', error)
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, date, isKey, priority = 'movable' } = body
    
    if (!title || !date) {
      return NextResponse.json({ error: 'Title and date are required' }, { status: 400 })
    }
    
    const db = getDb()
    const id = `task_${Date.now()}`
    
    // Parse date (can be YYYY-MM-DD or ISO string)
    // Если дата в формате YYYY-MM-DD, создаем дату в локальном времени
    let taskDate: Date
    if (date.includes('T')) {
      taskDate = new Date(date)
    } else {
      // YYYY-MM-DD формат - создаем в локальном времени
      const [year, month, day] = date.split('-').map(Number)
      taskDate = new Date(year, month - 1, day, 12, 0, 0)
    }
    
    // Get max order for this date
    const dateStart = new Date(taskDate.toISOString().split('T')[0] + 'T00:00:00').toISOString()
    const dateEnd = new Date(taskDate.toISOString().split('T')[0] + 'T23:59:59').toISOString()
    const maxOrder = db.prepare('SELECT COALESCE(MAX("order"), 0) as maxOrder FROM daily_tasks WHERE date >= ? AND date <= ?')
      .get(dateStart, dateEnd) as any
    const order = (maxOrder?.maxOrder || 0) + 1
    
    // Validate priority
    const validPriorities = ['main', 'important', 'movable']
    const taskPriority = validPriorities.includes(priority) ? priority : 'movable'
    
    db.prepare(`
      INSERT INTO daily_tasks (id, title, date, completed, isKey, priority, "order", createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(id, title, taskDate.toISOString(), 0, isKey ? 1 : 0, taskPriority, order)
    
    const task = db.prepare('SELECT * FROM daily_tasks WHERE id = ?').get(id)
    db.close()
    
    if (!task) {
      return NextResponse.json({ error: 'Task was not created properly' }, { status: 500 })
    }
    
    return NextResponse.json(task, { status: 201 })
  } catch (error: any) {
    console.error('Error creating daily task:', error)
    console.error('Error details:', {
      message: error?.message,
      stack: error?.stack,
    })
    return NextResponse.json({ 
      error: 'Failed to create task',
      details: error?.message || 'Unknown error'
    }, { status: 500 })
  }
}
