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
    const { title, date, endTime, duration, participant, notes, completed } = body

    const updates: string[] = []
    const values: any[] = []

    if (title !== undefined) {
      updates.push('title = ?')
      values.push(String(title))
    }
    if (date !== undefined) {
      const d = new Date(date)
      if (isNaN(d.getTime())) {
        return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
      }
      updates.push('date = ?')
      values.push(d.toISOString())
    }
    if (endTime !== undefined) {
      if (endTime == null) {
        updates.push('endTime = ?')
        values.push(null)
      } else {
        const d = new Date(endTime)
        if (isNaN(d.getTime())) {
          return NextResponse.json({ error: 'Invalid endTime format' }, { status: 400 })
        }
        updates.push('endTime = ?')
        values.push(d.toISOString())
      }
    }
    if (duration !== undefined) {
      updates.push('duration = ?')
      values.push(duration == null ? null : Number(duration))
    }
    if (participant !== undefined) {
      updates.push('participant = ?')
      values.push(participant == null ? null : String(participant))
    }
    if (notes !== undefined) {
      updates.push('notes = ?')
      values.push(notes == null ? null : String(notes))
    }
    if (completed !== undefined) {
      updates.push('completed = ?')
      values.push(completed ? 1 : 0)
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    updates.push("updatedAt = datetime('now')")
    values.push(params.id)

    const db = getDb()
    const result = db.prepare(`
      UPDATE calls
      SET ${updates.join(', ')}
      WHERE id = ?
    `).run(...values)
    db.close()

    if (result.changes === 0) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 })
    }

    const db2 = getDb()
    const call = db2.prepare('SELECT * FROM calls WHERE id = ?').get(params.id)
    db2.close()

    return NextResponse.json({ success: true, call })
  } catch (error: any) {
    console.error('Error updating call:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to update call' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const db = getDb()
    const result = db.prepare('DELETE FROM calls WHERE id = ?').run(params.id)
    db.close()

    if (result.changes === 0) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting call:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to delete call' },
      { status: 500 }
    )
  }
}
