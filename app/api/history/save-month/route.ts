import { NextRequest, NextResponse } from 'next/server'
import Database from 'better-sqlite3'
import path from 'path'

const dbPath = path.join(process.cwd(), 'prisma', 'dev.db')

function getDb() {
  return new Database(dbPath)
}

// Функция для расчета прибыли агентства (ТОЧНО ТА ЖЕ логика, что на странице агентства)
function calculateAgencyProfit(db: Database.Database, year: number, month: number) {
  const monthStart = new Date(year, month - 1, 1)
  const monthEnd = new Date(year, month, 0, 23, 59, 59)
  
  // Берем проекты, созданные в этом месяце (как на странице агентства)
  const agencyProjects = db.prepare(`
    SELECT * FROM AgencyProject
    WHERE date(createdAt) >= date(?) AND date(createdAt) <= date(?)
  `).all(monthStart.toISOString().split('T')[0], monthEnd.toISOString().split('T')[0]) as any[]
  
  // Для каждого проекта получаем расходы отдельно (как на странице агентства через API)
  const projectsWithExpenses = agencyProjects.map((p: any) => {
    const expenses = db.prepare(`
      SELECT * FROM AgencyExpense WHERE projectId = ?
    `).all(p.id) as any[]
    const totalExpenses = expenses.reduce((sum: number, e: any) => sum + (e.amount || 0), 0)
    
    // Автоматически корректируем paidAmount в зависимости от статуса (как на странице агентства)
    let correctedPaidAmount = p.paidAmount
    if (p.status === 'paid' && p.paidAmount !== p.totalAmount) {
      correctedPaidAmount = p.totalAmount
    } else if (p.status === 'not_paid' && p.paidAmount !== 0) {
      correctedPaidAmount = 0
    }
    
    return { ...p, totalExpenses, paidAmount: correctedPaidAmount }
  })
  
  // Общие расходы за месяц
  let agencyGeneralExpenses: any[] = []
  try {
    agencyGeneralExpenses = db.prepare(`
      SELECT * FROM AgencyGeneralExpense
      WHERE date(createdAt) >= date(?) AND date(createdAt) <= date(?)
    `).all(monthStart.toISOString().split('T')[0], monthEnd.toISOString().split('T')[0]) as any[]
  } catch (e) {
    agencyGeneralExpenses = []
  }
  
  // Расчет ТОЧНО так же, как на странице агентства (строки 360-373)
  const expectedRevenue = projectsWithExpenses.reduce((sum: number, p: any) => sum + (p.totalAmount || 0), 0)
  const actualRevenue = projectsWithExpenses.reduce((sum: number, p: any) => sum + (p.paidAmount || 0), 0)
  const projectExpenses = projectsWithExpenses.reduce((sum: number, p: any) => sum + (p.totalExpenses || 0), 0)
  const generalExpensesTotal = agencyGeneralExpenses.reduce((sum: number, e: any) => sum + (e.amount || 0), 0)
  
  // Расчет налогов: 6916 руб/месяц + 1% от суммы на расчетный счет
  const accountRevenue = projectsWithExpenses
    .filter((p: any) => p.paymentMethod === 'account' && p.status === 'paid')
    .reduce((sum: number, p: any) => sum + (p.paidAmount || 0), 0)
  const taxAmount = 6916 + (accountRevenue * 0.01)
  
  const totalExpenses = projectExpenses + generalExpensesTotal + taxAmount
  const expectedProfit = expectedRevenue - totalExpenses
  const actualProfit = actualRevenue - totalExpenses
  
  return {
    expectedRevenue,
    actualRevenue,
    expectedProfit,
    actualProfit
  }
}

// Функция для расчета прибыли импульса (ТОЧНО ТА ЖЕ логика, что на странице импульса)
function calculateImpulseProfit(db: Database.Database, year: number, month: number) {
  const monthStart = new Date(year, month - 1, 1)
  const monthEnd = new Date(year, month, 0, 23, 59, 59)
  
  // Берем студентов, созданных в этом месяце (как на странице импульса)
  const impulseStudents = db.prepare(`
    SELECT * FROM ImpulseStudent
    WHERE date(createdAt) >= date(?) AND date(createdAt) <= date(?)
  `).all(monthStart.toISOString().split('T')[0], monthEnd.toISOString().split('T')[0]) as any[]
  
  // Для каждого студента получаем расходы отдельно (как на странице импульса через API)
  const studentsWithExpenses = impulseStudents.map((s: any) => {
    const expenses = db.prepare(`
      SELECT * FROM ImpulseExpense WHERE studentId = ?
    `).all(s.id) as any[]
    const totalExpenses = expenses.reduce((sum: number, e: any) => sum + (e.amount || 0), 0)
    
    // Автоматически корректируем paidAmount в зависимости от статуса (как на странице импульса)
    let correctedPaidAmount = s.paidAmount
    if (s.status === 'paid' && s.paidAmount !== s.totalAmount) {
      correctedPaidAmount = s.totalAmount
    } else if (s.status === 'not_paid' && s.paidAmount !== 0) {
      correctedPaidAmount = 0
    }
    
    return { ...s, totalExpenses, paidAmount: correctedPaidAmount }
  })
  
  // Общие расходы за месяц
  let impulseGeneralExpenses: any[] = []
  try {
    impulseGeneralExpenses = db.prepare(`
      SELECT * FROM ImpulseGeneralExpense
      WHERE date(createdAt) >= date(?) AND date(createdAt) <= date(?)
    `).all(monthStart.toISOString().split('T')[0], monthEnd.toISOString().split('T')[0]) as any[]
  } catch (e) {
    impulseGeneralExpenses = []
  }
  
  // Расчет ТОЧНО так же, как на странице импульса (строки 352-358)
  const expectedRevenue = studentsWithExpenses.reduce((sum: number, s: any) => sum + (s.totalAmount || 0), 0)
  const actualRevenue = studentsWithExpenses.reduce((sum: number, s: any) => sum + (s.paidAmount || 0), 0)
  const studentExpenses = studentsWithExpenses.reduce((sum: number, s: any) => sum + (s.totalExpenses || 0), 0)
  const generalExpensesTotal = impulseGeneralExpenses.reduce((sum: number, e: any) => sum + (e.amount || 0), 0)
  
  const totalExpenses = studentExpenses + generalExpensesTotal
  const expectedProfit = expectedRevenue - totalExpenses
  const actualProfit = actualRevenue - totalExpenses
  
  return {
    expectedRevenue,
    actualRevenue,
    expectedProfit,
    actualProfit
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { year, month } = body

    if (!year || !month) {
      return NextResponse.json({ error: 'Year and month are required' }, { status: 400 })
    }

    const db = getDb()
    
    // Get current metrics (все данные, не фильтруем по месяцу)
    const accounts = db.prepare('SELECT * FROM PersonalAccount').all() as any[]
    const totalAccounts = accounts.reduce((sum: number, acc: any) => sum + acc.balance, 0)
    const cushionAccounts = accounts.filter((a: any) => a.name.toLowerCase().includes('подушка'))
    const cushionAmount = cushionAccounts.reduce((sum: number, acc: any) => sum + acc.balance, 0)
    const goalAccounts = accounts.filter((a: any) => a.name.toLowerCase().includes('цель'))
    const goalsAmount = goalAccounts.reduce((sum: number, acc: any) => sum + acc.balance, 0)
    
    // Получаем готовые данные о прибыли агентства
    // Используем ту же логику, что на странице агентства (фильтр по дате создания)
    const agencyProfit = calculateAgencyProfit(db, year, month)
    const agencyExpectedRevenue = agencyProfit.expectedRevenue
    const agencyActualRevenue = agencyProfit.actualRevenue
    const agencyExpectedProfit = agencyProfit.expectedProfit
    const agencyActualProfit = agencyProfit.actualProfit
    
    console.log(`[save-month] Agency ${year}-${month}: revenue=${agencyActualRevenue}, profit=${agencyActualProfit}`)
    
    // Если прибыль = 0 или отрицательная, но на странице агентства показывается другая цифра,
    // возможно нужно использовать другую логику (например, по дате оплаты)
    
    // Получаем готовые данные о прибыли импульса (используем функцию расчета)
    const impulseProfit = calculateImpulseProfit(db, year, month)
    const impulseExpectedRevenue = impulseProfit.expectedRevenue
    const impulseActualRevenue = impulseProfit.actualRevenue
    const impulseExpectedProfit = impulseProfit.expectedProfit
    const impulseActualProfit = impulseProfit.actualProfit
    
    console.log(`[save-month] Impulse ${year}-${month}: revenue=${impulseActualRevenue}, profit=${impulseActualProfit}`)
    
    // Общая прибыль = фактическая прибыль агентства + фактическая прибыль импульса
    const totalActualProfit = agencyActualProfit + impulseActualProfit
    const totalExpectedProfit = agencyExpectedProfit + impulseExpectedProfit
    
    // Общая выручка = ожидаемая выручка агентства + ожидаемая выручка импульса
    const totalRevenue = agencyExpectedRevenue + impulseExpectedRevenue
    
    // Используем totalActualProfit для общей прибыли (фактическая)
    const totalProfit = totalActualProfit
    
    // Calculate personal and business expenses for specified month
    const monthStart = new Date(year, month - 1, 1)
    const monthEnd = new Date(year, month, 0, 23, 59, 59)
    
    let transactions: any[] = []
    let categories: any[] = []
    try {
      transactions = db.prepare(`
        SELECT * FROM PersonalTransaction 
        WHERE type = 'expense' 
        AND date >= ? AND date <= ?
      `).all(monthStart.toISOString(), monthEnd.toISOString()) as any[]
      
      categories = db.prepare('SELECT * FROM expense_categories').all() as any[]
    } catch (e) {
      transactions = []
      categories = []
    }
    
    const personalCategoryNames = categories
      .filter(c => c.type === 'personal')
      .map(c => c.name)
    
    const businessCategoryNames = categories
      .filter(c => c.type === 'business')
      .map(c => c.name)
    
    const personalExpenses = transactions
      .filter(t => t.category && personalCategoryNames.includes(t.category))
      .reduce((sum: number, t: any) => sum + (t.amount || 0), 0)
    
    const businessExpenses = transactions
      .filter(t => t.category && businessCategoryNames.includes(t.category))
      .reduce((sum: number, t: any) => sum + (t.amount || 0), 0)
    
    // Save or update history
    const existing = db.prepare('SELECT id FROM monthly_history WHERE year = ? AND month = ?').get(year, month)
    
    if (existing) {
      db.prepare(`
        UPDATE monthly_history SET
          totalAccounts = ?, cushionAmount = ?, goalsAmount = ?,
          personalExpenses = ?, businessExpenses = ?,
          agencyExpectedRevenue = ?, agencyActualRevenue = ?, agencyExpectedProfit = ?, agencyActualProfit = ?,
          impulseExpectedRevenue = ?, impulseActualRevenue = ?, impulseExpectedProfit = ?, impulseActualProfit = ?,
          totalExpectedProfit = ?, totalRevenue = ?, updatedAt = datetime('now')
        WHERE year = ? AND month = ?
      `).run(
        totalAccounts, cushionAmount, goalsAmount,
        personalExpenses, businessExpenses,
        agencyExpectedRevenue, agencyActualRevenue, agencyExpectedProfit, agencyActualProfit,
        impulseExpectedRevenue, impulseActualRevenue, impulseExpectedProfit, impulseActualProfit,
        totalProfit, totalRevenue, year, month
      )
    } else {
      const id = `hist_${year}_${month}`
      db.prepare(`
        INSERT INTO monthly_history (
          id, year, month, totalAccounts, cushionAmount, goalsAmount,
          personalExpenses, businessExpenses,
          agencyExpectedRevenue, agencyActualRevenue, agencyExpectedProfit, agencyActualProfit,
          impulseExpectedRevenue, impulseActualRevenue, impulseExpectedProfit, impulseActualProfit,
          totalExpectedProfit, totalRevenue, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(
        id, year, month, totalAccounts, cushionAmount, goalsAmount,
        personalExpenses, businessExpenses,
        agencyExpectedRevenue, agencyActualRevenue, agencyExpectedProfit, agencyActualProfit,
        impulseExpectedRevenue, impulseActualRevenue, impulseExpectedProfit, impulseActualProfit,
        totalProfit, totalRevenue
      )
    }
    
    db.close()
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving month history:', error)
    return NextResponse.json({ error: 'Failed to save month history' }, { status: 500 })
  }
}
