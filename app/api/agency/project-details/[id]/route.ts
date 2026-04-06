import { NextRequest, NextResponse } from 'next/server'
import Database from 'better-sqlite3'
import path from 'path'

const dbPath = path.join(process.cwd(), 'prisma', 'dev.db')

function getDb() {
  return new Database(dbPath)
}

function ensureTable(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS "AgencyProjectDetail" (
      "id" TEXT PRIMARY KEY,
      "projectId" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "quantity" REAL NOT NULL DEFAULT 1,
      "unitPrice" REAL NOT NULL DEFAULT 0,
      "order" INTEGER NOT NULL DEFAULT 0,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "AgencyProjectDetail_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "AgencyProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `)
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const body = await request.json()
    const { title, quantity, unitPrice, order } = body

    const db = getDb()
    ensureTable(db)

    const existing = db
      .prepare('SELECT * FROM AgencyProjectDetail WHERE id = ?')
      .get(params.id) as
        | { title: string; quantity: number; unitPrice: number; order: number }
        | undefined
    if (!existing) {
      db.close()
      return NextResponse.json({ error: 'Detail not found' }, { status: 404 })
    }

    const nextTitle = title != null ? String(title) : existing.title
    const qRaw = quantity != null ? quantity : existing.quantity
    const pRaw = unitPrice != null ? unitPrice : existing.unitPrice

    const numericQuantity = typeof qRaw === 'number' ? qRaw : parseFloat(String(qRaw))
    const numericUnitPrice = typeof pRaw === 'number' ? pRaw : parseFloat(String(pRaw))

    const nextOrder =
      typeof order === 'number'
        ? order
        : typeof existing.order === 'number'
        ? existing.order
        : 0

    db.prepare(`
      UPDATE AgencyProjectDetail
      SET title = ?, quantity = ?, unitPrice = ?, "order" = ?, updatedAt = datetime('now')
      WHERE id = ?
    `).run(
      nextTitle,
      isNaN(numericQuantity) ? existing.quantity : numericQuantity,
      isNaN(numericUnitPrice) ? existing.unitPrice : numericUnitPrice,
      nextOrder,
      params.id,
    )

    const detail = db.prepare('SELECT * FROM AgencyProjectDetail WHERE id = ?').get(params.id)
    db.close()

    return NextResponse.json({ success: true, detail })
  } catch (error) {
    console.error('Error updating project detail:', error)
    return NextResponse.json({ error: 'Failed to update project detail' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const db = getDb()
    ensureTable(db)
    db.prepare('DELETE FROM AgencyProjectDetail WHERE id = ?').run(params.id)
    db.close()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting project detail:', error)
    return NextResponse.json({ error: 'Failed to delete project detail' }, { status: 500 })
  }
}

