import { NextRequest, NextResponse } from 'next/server'
import Database from 'better-sqlite3'
import path from 'path'

const dbPath = path.join(process.cwd(), 'prisma', 'dev.db')

function getDb() {
  return new Database(dbPath)
}

function ensureTable(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS profi_responses (
      id TEXT PRIMARY KEY,
      createdAt TEXT NOT NULL,
      cost REAL NOT NULL,
      refundAmount REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'response',
      projectAmount REAL,
      notes TEXT,
      updatedAt TEXT NOT NULL
    )
  `)
}

export async function GET(request: NextRequest) {
  try {
    const db = getDb()
    ensureTable(db)

    // Миграция: старый статус project → paid (оплачено)
    db.prepare(`UPDATE profi_responses SET status = 'paid' WHERE status = 'project'`).run()

    const { searchParams } = new URL(request.url)
    const withStats = searchParams.get('stats') === '1'

    const items = db.prepare(`
      SELECT * FROM profi_responses
      ORDER BY createdAt DESC
    `).all() as Array<{
      id: string
      createdAt: string
      cost: number
      refundAmount: number
      status: string
      projectAmount: number | null
      notes: string | null
      updatedAt: string
    }>

    function formatProfiDate(iso: string): string {
      const d = new Date(iso)
      return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
    }

    let getReminder: (profiId: string, createdAt: string) => { date: string; leadId: string } | null = () => null
    try {
      const leadRows = db.prepare(`
        SELECT id, contact, nextContactDate FROM agency_leads
        WHERE source = 'Profi.ru' AND nextContactDate IS NOT NULL
      `).all() as Array<{ id: string; contact: string; nextContactDate: string }>
      const contactToLead = new Map<string, { date: string; leadId: string }>()
      for (const row of leadRows) {
        contactToLead.set(row.contact, { date: row.nextContactDate, leadId: row.id })
      }
      getReminder = (profiId: string, createdAt: string) => {
        const contact = `Profi отклик (${formatProfiDate(createdAt)})`
        return contactToLead.get(contact) ?? null
      }
    } catch (_) {}

    const itemsWithReminder = items.map((item: Record<string, unknown>) => ({
      ...item,
      reminder: getReminder(item.id as string, item.createdAt as string),
    }))

    let stats: Record<string, unknown> | null = null
    if (withStats && itemsWithReminder.length > 0) {
      const totalPaid = itemsWithReminder.reduce((s: number, r: any) => s + r.cost, 0)
      const totalRefunded = items.reduce((s, r) => s + (r.refundAmount || 0), 0)
      const netSpent = totalPaid - totalRefunded
      const countResponse = itemsWithReminder.filter((r: any) => r.status === 'response').length
      const countConversation = itemsWithReminder.filter((r: any) => r.status === 'conversation').length
      const countProposal = itemsWithReminder.filter((r: any) => r.status === 'proposal').length
      const countPaid = itemsWithReminder.filter((r: any) => r.status === 'paid').length
      const countRefunded = itemsWithReminder.filter((r: any) => r.status === 'refunded').length
      const countDrain = itemsWithReminder.filter((r: any) => r.status === 'drain').length
      const totalProjectAmount = itemsWithReminder
        .filter((r: any) => r.status === 'paid' && r.projectAmount != null)
        .reduce((s: number, r: any) => s + (r.projectAmount ?? 0), 0)

      const totalResponses = itemsWithReminder.length
      // Просмотренные = все отклики без возврата (если был возврат — отклик непросмотренный)
      const viewedResponses = totalResponses - countRefunded
      const toConversation = countConversation + countProposal + countPaid
      const toProposal = countProposal + countPaid
      // % от отклика в переписку, % от переписки в КП, % от КП в оплату
      const convRate = totalResponses > 0 ? (toConversation / totalResponses) * 100 : 0
      const proposalRate = toConversation > 0 ? (toProposal / toConversation) * 100 : 0
      const paidRate = toProposal > 0 ? (countPaid / toProposal) * 100 : 0
      // Общий % от отклика в оплату
      const responseToPaidRate = totalResponses > 0 ? (countPaid / totalResponses) * 100 : 0
      // Цена платящего клиента (сколько потратили на отклики на одного оплатившего)
      const costPerPayingClient = countPaid > 0 ? netSpent / countPaid : null
      // Средний чек платящего клиента
      const avgCheckPaying = countPaid > 0 ? totalProjectAmount / countPaid : null

      stats = {
        totalPaid,
        totalRefunded,
        netSpent,
        totalResponses,
        countResponse,
        countConversation,
        countProposal,
        countPaid,
        countRefunded,
        countDrain,
        totalProjectAmount,
        roi: netSpent > 0 ? ((totalProjectAmount - netSpent) / netSpent) * 100 : 0,
        costPerPayingClient,
        avgCheckPaying,
        responseToPaidRate: Math.round(responseToPaidRate * 10) / 10,
        funnel: {
          responses: totalResponses,
          viewedResponses,
          toConversation,
          toProposal,
          toPaid: countPaid,
          convRate: Math.round(convRate * 10) / 10,
          proposalRate: Math.round(proposalRate * 10) / 10,
          paidRate: Math.round(paidRate * 10) / 10,
        },
      }
    }

    db.close()
    return NextResponse.json(stats ? { items: itemsWithReminder, stats } : itemsWithReminder)
  } catch (error) {
    console.error('Error fetching profi responses:', error)
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { cost, notes } = body

    if (cost == null || cost < 0) {
      return NextResponse.json({ error: 'cost is required and must be >= 0' }, { status: 400 })
    }

    const db = getDb()
    ensureTable(db)

    const id = `profi_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO profi_responses (id, createdAt, cost, refundAmount, status, projectAmount, notes, updatedAt)
      VALUES (?, ?, ?, 0, 'response', NULL, ?, ?)
    `).run(id, now, Number(cost), notes || null, now)

    // Автосоздание напоминания: лид с датой «завтра» — появится в «Клиенты дожать» на дашборде
    try {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(12, 0, 0, 0)
      const nextContactDateIso = tomorrow.toISOString()
      const created = new Date(now)
      const contact = `Profi отклик (${String(created.getDate()).padStart(2, '0')}.${String(created.getMonth() + 1).padStart(2, '0')}.${created.getFullYear()})`
      const source = 'Profi.ru'
      const taskDescription = notes ? `Напомнить заказчику. ${notes}` : 'Напомнить заказчику'
      const leadId = `lead_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
      db.prepare(`
        INSERT INTO agency_leads (id, contact, source, taskDescription, status, nextContactDate, manualDateSet, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, 'new', ?, 1, datetime('now'), datetime('now'))
      `).run(leadId, contact, source, taskDescription, nextContactDateIso)
    } catch (_) {
      // Таблица agency_leads может отсутствовать — игнорируем
    }

    const row = db.prepare('SELECT * FROM profi_responses WHERE id = ?').get(id)
    db.close()

    return NextResponse.json({ success: true, item: row })
  } catch (error) {
    console.error('Error creating profi response:', error)
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 })
  }
}
