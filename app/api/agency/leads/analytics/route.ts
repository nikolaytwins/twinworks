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
    const startDate = searchParams.get('startDate') // YYYY-MM-DD
    const endDate = searchParams.get('endDate') // YYYY-MM-DD
    
    const db = getDb()
    
    // Проверяем существование таблицы истории
    const tableExists = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='lead_history'
    `).get()
    
    if (!tableExists) {
      db.close()
      return NextResponse.json({
        conversions: [],
        sources: []
      })
    }
    
    // Определяем период
    const periodStart = startDate ? new Date(startDate + 'T00:00:00').toISOString() : null
    const periodEnd = endDate ? new Date(endDate + 'T23:59:59').toISOString() : null
    
    let dateFilter = ''
    const params: any[] = []
    
    if (periodStart && periodEnd) {
      dateFilter = 'WHERE createdAt >= ? AND createdAt <= ?'
      params.push(periodStart, periodEnd)
    } else if (periodStart) {
      dateFilter = 'WHERE createdAt >= ?'
      params.push(periodStart)
    } else if (periodEnd) {
      dateFilter = 'WHERE createdAt <= ?'
      params.push(periodEnd)
    }
    
    // Получаем все события изменения статуса за период
    const statusChanges = db.prepare(`
      SELECT leadId, oldStatus, newStatus, createdAt
      FROM lead_history
      ${dateFilter}
      AND eventType = 'status_changed'
      ORDER BY createdAt ASC
    `).all(...params) as any[]
    
    // Конверсии переходов (по уникальным лидам)
    const conversions: Record<string, { count: number; percentage: number }> = {}
    
    // Определяем переходы для отслеживания
    const trackedTransitions = [
      { from: 'new', to: 'contact_established', label: 'Новые → Контакт установлен' },
      { from: 'contact_established', to: 'commercial_proposal', label: 'Контакт установлен → Коммерческое предложение' },
      { from: 'commercial_proposal', to: 'paid', label: 'Коммерческое предложение → Оплачен' },
      { from: 'commercial_proposal', to: 'thinking', label: 'Коммерческое предложение → Думает / изучает' },
      { from: 'thinking', to: 'paid', label: 'Думает / изучает → Оплачен' },
    ]
    
    // Для каждого перехода считаем уникальные лиды
    for (const transition of trackedTransitions) {
      const uniqueLeads = new Set<string>()
      
      for (const change of statusChanges) {
        if (change.oldStatus === transition.from && change.newStatus === transition.to) {
          uniqueLeads.add(change.leadId)
        }
      }
      
      conversions[transition.label] = {
        count: uniqueLeads.size,
        percentage: 0 // Будет вычислено ниже
      }
    }
    
    // Переход в паузу из любого статуса
    const pauseTransitions = statusChanges.filter(
      c => c.newStatus === 'pause'
    )
    const uniquePauseLeads = new Set(pauseTransitions.map(c => c.leadId))
    conversions['Любой → Пауза'] = {
      count: uniquePauseLeads.size,
      percentage: 0
    }
    
    // Вычисляем проценты конверсии (относительно предыдущего шага)
    // Новые → Контакт установлен: процент от всех "Новые"
    const newLeads = new Set(
      statusChanges.filter(c => c.oldStatus === 'new' || c.newStatus === 'new').map(c => c.leadId)
    )
    // Также учитываем лиды, созданные в период
    const createdInPeriod = db.prepare(`
      SELECT DISTINCT leadId FROM lead_history
      ${dateFilter}
      AND eventType = 'created'
    `).all(...params) as any[]
    createdInPeriod.forEach((c: any) => newLeads.add(c.leadId))
    
    if (newLeads.size > 0 && conversions['Новые → Контакт установлен']) {
      conversions['Новые → Контакт установлен'].percentage = 
        (conversions['Новые → Контакт установлен'].count / newLeads.size) * 100
    }
    
    // Контакт установлен → Коммерческое предложение
    const contactEstablishedLeads = new Set(
      statusChanges.filter(c => c.oldStatus === 'contact_established' || c.newStatus === 'contact_established').map(c => c.leadId)
    )
    if (contactEstablishedLeads.size > 0 && conversions['Контакт установлен → Коммерческое предложение']) {
      conversions['Контакт установлен → Коммерческое предложение'].percentage = 
        (conversions['Контакт установлен → Коммерческое предложение'].count / contactEstablishedLeads.size) * 100
    }
    
    // Коммерческое предложение → Оплачен
    const commercialProposalLeads = new Set(
      statusChanges.filter(c => c.oldStatus === 'commercial_proposal' || c.newStatus === 'commercial_proposal').map(c => c.leadId)
    )
    if (commercialProposalLeads.size > 0 && conversions['Коммерческое предложение → Оплачен']) {
      conversions['Коммерческое предложение → Оплачен'].percentage = 
        (conversions['Коммерческое предложение → Оплачен'].count / commercialProposalLeads.size) * 100
    }
    
    // Коммерческое предложение → Думает / изучает
    if (commercialProposalLeads.size > 0 && conversions['Коммерческое предложение → Думает / изучает']) {
      conversions['Коммерческое предложение → Думает / изучает'].percentage = 
        (conversions['Коммерческое предложение → Думает / изучает'].count / commercialProposalLeads.size) * 100
    }
    
    // Думает / изучает → Оплачен
    const thinkingLeads = new Set(
      statusChanges.filter(c => c.oldStatus === 'thinking' || c.newStatus === 'thinking').map(c => c.leadId)
    )
    if (thinkingLeads.size > 0 && conversions['Думает / изучает → Оплачен']) {
      conversions['Думает / изучает → Оплачен'].percentage = 
        (conversions['Думает / изучает → Оплачен'].count / thinkingLeads.size) * 100
    }
    
    // Источники за период
    // Считаем лиды, созданные в период, по их источнику на момент создания
    const createdEvents = db.prepare(`
      SELECT leadId, newSource
      FROM lead_history
      ${dateFilter}
      AND eventType = 'created'
    `).all(...params) as any[]
    
    // Для каждого источника считаем уникальные лиды, созданные с этим источником
    const sourcesMap: Record<string, Set<string>> = {}
    
    for (const event of createdEvents) {
      if (event.newSource) {
        if (!sourcesMap[event.newSource]) {
          sourcesMap[event.newSource] = new Set()
        }
        sourcesMap[event.newSource].add(event.leadId)
      }
    }
    
    // Преобразуем в формат для ответа
    const sourcesResult: Array<{ source: string; count: number }> = []
    for (const [source, leadSet] of Object.entries(sourcesMap)) {
      sourcesResult.push({
        source,
        count: leadSet.size
      })
    }
    
    db.close()
    
    return NextResponse.json({
      conversions: Object.entries(conversions).map(([label, data]) => ({
        label,
        count: data.count,
        percentage: Math.round(data.percentage * 10) / 10
      })),
      sources: sourcesResult
    })
  } catch (error) {
    console.error('Error fetching analytics:', error)
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
  }
}
