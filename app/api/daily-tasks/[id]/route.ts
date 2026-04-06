import { NextRequest, NextResponse } from 'next/server'
import Database from 'better-sqlite3'
import path from 'path'

const dbPath = path.join(process.cwd(), 'prisma', 'dev.db')

function getDb() {
  return new Database(dbPath)
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const body = await request.json()
    const { title, description, date, completed, isKey, priority, order } = body
    
    const db = getDb()
    
    const updates: string[] = []
    const values: any[] = []
    
    if (title !== undefined) {
      updates.push('title = ?')
      values.push(title)
    }
    if (description !== undefined) {
      updates.push('description = ?')
      values.push(description || null)
    }
    if (date !== undefined) {
      const taskDate = new Date(date.includes('T') ? date : date + 'T12:00:00')
      updates.push('date = ?')
      values.push(taskDate.toISOString())
    }
    if (completed !== undefined) {
      updates.push('completed = ?')
      values.push(completed ? 1 : 0)
    }
    if (isKey !== undefined) {
      updates.push('isKey = ?')
      values.push(isKey ? 1 : 0)
    }
    if (priority !== undefined) {
      const validPriorities = ['main', 'important', 'movable']
      const taskPriority = validPriorities.includes(priority) ? priority : 'movable'
      updates.push('priority = ?')
      values.push(taskPriority)
    }
    if (order !== undefined) {
      updates.push('"order" = ?')
      values.push(order)
    }
    
    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }
    
    updates.push("updatedAt = datetime('now')")
    values.push(params.id)
    
    db.prepare(`
      UPDATE daily_tasks
      SET ${updates.join(', ')}
      WHERE id = ?
    `).run(...values)
    
    const task = db.prepare('SELECT * FROM daily_tasks WHERE id = ?').get(params.id) as any
    db.close()
    
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }
    
    // Убеждаемся, что у задачи есть priority
    const taskWithPriority = {
      ...task,
      priority: task.priority || 'movable'
    }
    
    return NextResponse.json({ success: true, task: taskWithPriority })
  } catch (error) {
    console.error('Error updating daily task:', error)
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const db = getDb()
    db.prepare('DELETE FROM daily_tasks WHERE id = ?').run(params.id)
    db.close()
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting daily task:', error)
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 })
  }
}
