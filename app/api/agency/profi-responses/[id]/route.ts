import { NextRequest, NextResponse } from 'next/server'
import Database from 'better-sqlite3'
import path from 'path'

const dbPath = path.join(process.cwd(), 'prisma', 'dev.db')

function getDb() {
  return new Database(dbPath)
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const db = getDb()
    const row = db.prepare('SELECT * FROM profi_responses WHERE id = ?').get(id)
    db.close()
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(row)
  } catch (error) {
    console.error('Error fetching profi response:', error)
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const body = await request.json()
    const { status, refundAmount, projectAmount, notes } = body

    const db = getDb()
    const current = db.prepare('SELECT * FROM profi_responses WHERE id = ?').get(id) as Record<string, unknown> | undefined
    if (!current) {
      db.close()
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const allowed = ['response', 'viewed', 'conversation', 'proposal', 'paid', 'refunded', 'drain']
    const newStatus = status != null && allowed.includes(status) ? status : current.status as string
    const newRefund = refundAmount != null ? Number(refundAmount) : (current.refundAmount as number)
    const newProjectAmount = newStatus === 'paid' && projectAmount != null ? Number(projectAmount) : (newStatus === 'paid' ? (current.projectAmount as number | null) : null)
    const newNotes = notes !== undefined ? (notes || null) : (current.notes as string | null)

    db.prepare(`
      UPDATE profi_responses
      SET status = ?, refundAmount = ?, projectAmount = ?, notes = ?, updatedAt = ?
      WHERE id = ?
    `).run(newStatus, newRefund, newProjectAmount, newNotes, new Date().toISOString(), id)

    const row = db.prepare('SELECT * FROM profi_responses WHERE id = ?').get(id)
    db.close()
    return NextResponse.json({ success: true, item: row })
  } catch (error) {
    console.error('Error updating profi response:', error)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const db = getDb()
    const row = db.prepare('SELECT id FROM profi_responses WHERE id = ?').get(id)
    if (!row) {
      db.close()
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    db.prepare('DELETE FROM profi_responses WHERE id = ?').run(id)
    db.close()
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting profi response:', error)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
