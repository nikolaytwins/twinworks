import { NextRequest, NextResponse } from 'next/server'
import Database from 'better-sqlite3'
import path from 'path'

const dbPath = path.join(process.cwd(), 'prisma', 'dev.db')

function getDb() {
  return new Database(dbPath)
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const db = getDb()
    const row = db.prepare('SELECT * FROM habit_definitions WHERE id = ?').get(id) as any
    db.close()
    if (!row) return NextResponse.json({ error: 'Habit not found' }, { status: 404 })
    return NextResponse.json({
      id: row.id,
      name: row.name,
      type: row.type,
      slotsCount: row.slotsCount ?? 7,
      order: row.order ?? 0,
      isMain: row.isMain === 1 || row.isMain === true,
    })
  } catch (error) {
    console.error('Error fetching habit:', error)
    return NextResponse.json({ error: 'Failed to fetch habit' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const db = getDb()
    const existing = db.prepare('SELECT * FROM habit_definitions WHERE id = ?').get(id) as any
    if (!existing) {
      db.close()
      return NextResponse.json({ error: 'Habit not found' }, { status: 404 })
    }
    const name = body.name != null ? String(body.name).trim() : existing.name
    const type = body.type === 'monthly' ? 'monthly' : (body.type === 'weekly' ? 'weekly' : existing.type)
    const slotsCount = body.slotsCount != null
      ? (type === 'weekly' ? 7 : Math.min(31, Math.max(1, parseInt(String(body.slotsCount), 10) || 4)))
      : (existing.slotsCount ?? 7)
    const order = body.order != null ? parseInt(String(body.order), 10) || 0 : existing.order
    const isMain = body.isMain != null ? (body.isMain === true || body.isMain === 1 ? 1 : 0) : (existing.isMain ? 1 : 0)
    db.prepare(`
      UPDATE habit_definitions SET name = ?, type = ?, slotsCount = ?, "order" = ?, isMain = ?, updatedAt = datetime('now') WHERE id = ?
    `).run(name, type, slotsCount, order, isMain, id)
    const row = db.prepare('SELECT * FROM habit_definitions WHERE id = ?').get(id) as any
    db.close()
    return NextResponse.json({
      success: true,
      habit: {
        id: row.id,
        name: row.name,
        type: row.type,
        slotsCount: row.slotsCount ?? 7,
        order: row.order ?? 0,
        isMain: row.isMain === 1 || row.isMain === true,
      },
    })
  } catch (error) {
    console.error('Error updating habit:', error)
    return NextResponse.json({ error: 'Failed to update habit' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const db = getDb()
    const r = db.prepare('DELETE FROM habit_definitions WHERE id = ?').run(id)
    db.close()
    if (r.changes === 0) return NextResponse.json({ error: 'Habit not found' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting habit:', error)
    return NextResponse.json({ error: 'Failed to delete habit' }, { status: 500 })
  }
}
