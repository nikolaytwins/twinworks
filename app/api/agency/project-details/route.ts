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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    const db = getDb()
    ensureTable(db)
    let query = 'SELECT * FROM AgencyProjectDetail'
    const params: any[] = []

    if (projectId) {
      query += ' WHERE projectId = ?'
      params.push(projectId)
    }

    query += ' ORDER BY "order" ASC, createdAt ASC'

    const rows = db.prepare(query).all(...params)
    db.close()

    return NextResponse.json(rows)
  } catch (error) {
    console.error('Error fetching project details:', error)
    return NextResponse.json({ error: 'Failed to fetch project details' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      projectId,
      title,
      quantity,
      unitPrice,
      order,
    } = body

    if (!projectId || !title) {
      return NextResponse.json({ error: 'projectId and title are required' }, { status: 400 })
    }

    const db = getDb()
    ensureTable(db)
    const id = `pd_${Date.now()}`

    const numericQuantity = typeof quantity === 'number' ? quantity : parseFloat(quantity ?? '1')
    const numericUnitPrice = typeof unitPrice === 'number' ? unitPrice : parseFloat(unitPrice ?? '0')

    db.prepare(`
      INSERT INTO AgencyProjectDetail (id, projectId, title, quantity, unitPrice, "order", createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, COALESCE(?, 0), datetime('now'), datetime('now'))
    `).run(
      id,
      projectId,
      String(title),
      isNaN(numericQuantity) ? 1 : numericQuantity,
      isNaN(numericUnitPrice) ? 0 : numericUnitPrice,
      typeof order === 'number' ? order : null,
    )

    const detail = db.prepare('SELECT * FROM AgencyProjectDetail WHERE id = ?').get(id)
    db.close()

    return NextResponse.json({ success: true, detail })
  } catch (error) {
    console.error('Error creating project detail:', error)
    return NextResponse.json({ error: 'Failed to create project detail' }, { status: 500 })
  }
}

