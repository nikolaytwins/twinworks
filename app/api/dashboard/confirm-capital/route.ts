import { NextRequest, NextResponse } from 'next/server'
import Database from 'better-sqlite3'
import path from 'path'

const dbPath = path.join(process.cwd(), 'prisma', 'dev.db')

function getDb() {
  return new Database(dbPath)
}

export async function POST(request: NextRequest) {
  try {
    const db = getDb()
    let ipTaxReserve = 0
    try {
      const body = await request.json().catch(() => ({}))
      ipTaxReserve = Math.max(0, parseFloat(body.ipTaxReserve) || 0)
    } catch (_) {}

    // Получаем текущие счета
    const accounts = db.prepare('SELECT * FROM PersonalAccount').all() as any[]
    
    // Для консистентности с /api/dashboard считаем капитал так же:
    // Резервы (подушка/цель) исключаем, замороженные активы (type = 'other') включаем.
    // ИП на налоги вычитаем из доступных (как в блоке «Общий капитал»).
    const reserveKeywords = ['резерв', 'подушка', 'цель']
    const reserveAccounts = accounts.filter((a: any) =>
      reserveKeywords.some(keyword => a.name.toLowerCase().includes(keyword.toLowerCase()))
    )
    const reserveAccountIds = reserveAccounts.map((a: any) => a.id)
    
    const frozenAccounts = accounts.filter((a: any) => a.type === 'other')
    const frozenAccountIds = frozenAccounts.map((a: any) => a.id)
    
    const availableAccounts = accounts.filter((a: any) =>
      (a.type === 'card' || a.type === 'cash' || a.type === 'bank') &&
      !reserveAccountIds.includes(a.id) &&
      !frozenAccountIds.includes(a.id)
    )
    
    const availableRaw = availableAccounts.reduce((sum: number, acc: any) => sum + (acc.balance || 0), 0)
    const availableNow = Math.max(0, availableRaw - ipTaxReserve)
    const frozenAmount = frozenAccounts.reduce((sum: number, acc: any) => sum + (acc.balance || 0), 0)
    const totalAccounts = availableNow + frozenAmount
    
    // Dev-диагностика: убеждаемся, что сохраняем именно актуальную сумму счетов
    console.log('✅ Confirm capital: computed totalAccounts for confirmation', {
      dbPath,
      userId: null, // auth не используется, одна БД на все данные
      totalAccounts,
      accountsCount: accounts.length,
      accountsSample: accounts.slice(0, 10).map((a: any) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        balance: a.balance,
      })),
    })
    
    // Проверяем, есть ли запись в personal_settings
    const existing = db.prepare('SELECT id FROM personal_settings LIMIT 1').get() as any
    
    if (existing) {
      // Обновляем существующую запись
      db.prepare(`
        UPDATE personal_settings 
        SET lastConfirmedTotalAccounts = ?, 
            lastConfirmedTotalAccountsDate = datetime('now'),
            updatedAt = datetime('now')
        WHERE id = ?
      `).run(totalAccounts, existing.id)
    } else {
      // Создаем новую запись
      const id = `settings_${Date.now()}`
      db.prepare(`
        INSERT INTO personal_settings (id, expectedMonthlyExpenses, lastConfirmedTotalAccounts, lastConfirmedTotalAccountsDate, updatedAt)
        VALUES (?, 0, ?, datetime('now'), datetime('now'))
      `).run(id, totalAccounts)
    }

    db.close()
    
    return NextResponse.json({ 
      success: true, 
      lastConfirmedTotalAccounts: totalAccounts,
      lastConfirmedTotalAccountsDate: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error confirming capital:', error)
    return NextResponse.json({ error: 'Failed to confirm capital' }, { status: 500 })
  }
}
