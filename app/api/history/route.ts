import { NextRequest, NextResponse } from 'next/server'
import Database from 'better-sqlite3'
import path from 'path'

const dbPath = path.join(process.cwd(), 'prisma', 'dev.db')

function getDb() {
  return new Database(dbPath)
}

// Та же логика фильтра по месяцу и расчёта, что на странице агентства (agency/page.tsx)
function computeAgencyMetricsForMonth(
  year: number,
  month: number,
  projects: any[],
  generalExpenses: any[]
) {
  const monthStart = new Date(year, month - 1, 1)
  const monthEnd = new Date(year, month, 0, 23, 59, 59)

  const filteredProjects = projects.filter((p: any) => {
    const projectDate = new Date(p.createdAt)
    return projectDate >= monthStart && projectDate <= monthEnd
  })

  const filteredGeneral = generalExpenses.filter((e: any) => {
    const expenseDate = new Date(e.createdAt)
    return expenseDate >= monthStart && expenseDate <= monthEnd
  })

  const projectsWithCorrectedPaid = filteredProjects.map((p: any) => {
    let correctedPaidAmount = p.paidAmount
    if (p.status === 'paid' && p.paidAmount !== p.totalAmount) correctedPaidAmount = p.totalAmount
    else if (p.status === 'not_paid' && p.paidAmount !== 0) correctedPaidAmount = 0
    return { ...p, paidAmount: correctedPaidAmount }
  })

  const actualRevenue = projectsWithCorrectedPaid.reduce((sum: number, p: any) => sum + (p.paidAmount || 0), 0)
  const projectExpenses = projectsWithCorrectedPaid.reduce((sum: number, p: any) => sum + (p.totalExpenses || 0), 0)
  const generalExpensesTotal = filteredGeneral.reduce((sum: number, e: any) => sum + (e.amount || 0), 0)
  const accountRevenue = projectsWithCorrectedPaid
    .filter((p: any) => p.paymentMethod === 'account' && p.status === 'paid')
    .reduce((sum: number, p: any) => sum + (p.paidAmount || 0), 0)
  const taxAmount = 6916 + (accountRevenue * 0.01)
  const totalExpenses = projectExpenses + generalExpensesTotal + taxAmount
  const actualProfit = actualRevenue - totalExpenses

  return { agencyActualRevenue: actualRevenue, agencyActualProfit: actualProfit }
}

// Та же логика фильтра по месяцу и расчёта, что на странице импульса (impulse/page.tsx)
function computeImpulseMetricsForMonth(
  year: number,
  month: number,
  students: any[],
  generalExpenses: any[]
) {
  const monthStart = new Date(year, month - 1, 1)
  const monthEnd = new Date(year, month, 0, 23, 59, 59)

  const filteredStudents = students.filter((s: any) => {
    const studentDate = new Date(s.createdAt)
    return studentDate >= monthStart && studentDate <= monthEnd
  })

  const filteredGeneral = generalExpenses.filter((e: any) => {
    const expenseDate = new Date(e.createdAt)
    return expenseDate >= monthStart && expenseDate <= monthEnd
  })

  const studentsWithCorrectedPaid = filteredStudents.map((s: any) => {
    let correctedPaidAmount = s.paidAmount
    if (s.status === 'paid' && s.paidAmount !== s.totalAmount) correctedPaidAmount = s.totalAmount
    else if (s.status === 'not_paid' && s.paidAmount !== 0) correctedPaidAmount = 0
    return { ...s, paidAmount: correctedPaidAmount }
  })

  const actualRevenue = studentsWithCorrectedPaid.reduce((sum: number, s: any) => sum + (s.paidAmount || 0), 0)
  const studentExpenses = studentsWithCorrectedPaid.reduce((sum: number, s: any) => sum + (s.totalExpenses || 0), 0)
  const generalExpensesTotal = filteredGeneral.reduce((sum: number, e: any) => sum + (e.amount || 0), 0)
  const totalExpenses = studentExpenses + generalExpensesTotal
  const actualProfit = actualRevenue - totalExpenses

  return { impulseActualRevenue: actualRevenue, impulseActualProfit: actualProfit }
}

export async function GET() {
  try {
    const db = getDb()
    let history: any[] = []
    try {
      history = db.prepare('SELECT * FROM monthly_history ORDER BY year DESC, month DESC').all() as any[]
    } catch (e) {
      history = []
    }

    if (history.length === 0) {
      db.close()
      return NextResponse.json(history)
    }

    let agencyProjects: any[] = []
    let agencyGeneralExpenses: any[] = []
    let impulseStudents: any[] = []
    let impulseGeneralExpenses: any[] = []

    try {
      agencyProjects = db.prepare(`
        SELECT p.*, COALESCE(SUM(e.amount), 0) as totalExpenses
        FROM AgencyProject p
        LEFT JOIN AgencyExpense e ON p.id = e.projectId
        GROUP BY p.id
      `).all() as any[]
    } catch (_) {}
    try {
      agencyGeneralExpenses = db.prepare('SELECT * FROM AgencyGeneralExpense').all() as any[]
    } catch (_) {}
    try {
      impulseStudents = db.prepare(`
        SELECT s.*, COALESCE(SUM(e.amount), 0) as totalExpenses
        FROM ImpulseStudent s
        LEFT JOIN ImpulseExpense e ON s.id = e.studentId
        GROUP BY s.id
      `).all() as any[]
    } catch (_) {}
    try {
      impulseGeneralExpenses = db.prepare('SELECT * FROM ImpulseGeneralExpense').all() as any[]
    } catch (_) {}

    db.close()

    // 2026 и позже: выручка и прибыль считаются по формуле (из проектов агентства и учеников импульса по месяцу).
    // 2024 и 2025: исключение — используем только сохранённые в БД значения (не перезаписываем формулой).
    const cutoffYear = 2026
    history = history.map((row: any) => {
      if (row.year >= cutoffYear) {
        const agency = computeAgencyMetricsForMonth(row.year, row.month, agencyProjects, agencyGeneralExpenses)
        const impulse = computeImpulseMetricsForMonth(row.year, row.month, impulseStudents, impulseGeneralExpenses)
        return {
          ...row,
          agencyActualRevenue: agency.agencyActualRevenue,
          agencyActualProfit: agency.agencyActualProfit,
          impulseActualRevenue: impulse.impulseActualRevenue,
          impulseActualProfit: impulse.impulseActualProfit,
          totalRevenue: agency.agencyActualRevenue + impulse.impulseActualRevenue,
        }
      }
      // 2024, 2025: оставляем как в БД (agencyActualRevenue, agencyActualProfit, impulseActualRevenue, impulseActualProfit, totalRevenue)
      return { ...row }
    })

    return NextResponse.json(history)
  } catch (error) {
    console.error('Error fetching monthly history:', error)
    return NextResponse.json({ error: 'Failed to fetch monthly history' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      year,
      month,
      totalAccounts,
      cushionAmount,
      goalsAmount,
      agencyExpectedRevenue,
      agencyActualRevenue,
      agencyExpectedProfit,
      agencyActualProfit,
      impulseExpectedRevenue,
      impulseActualRevenue,
      impulseExpectedProfit,
      impulseActualProfit,
      totalExpectedProfit,
      totalRevenue,
    } = body

    const db = getDb()
    const id = `hist_${year}_${month}`

    // Check if exists
    const existing = db.prepare('SELECT id FROM monthly_history WHERE year = ? AND month = ?').get(year, month)

    if (existing) {
      // Update
      db.prepare(`
        UPDATE monthly_history SET
          totalAccounts = ?, cushionAmount = ?, goalsAmount = ?,
          agencyExpectedRevenue = ?, agencyActualRevenue = ?, agencyExpectedProfit = ?, agencyActualProfit = ?,
          impulseExpectedRevenue = ?, impulseActualRevenue = ?, impulseExpectedProfit = ?, impulseActualProfit = ?,
          totalExpectedProfit = ?, totalRevenue = ?, updatedAt = datetime('now')
        WHERE year = ? AND month = ?
      `).run(
        totalAccounts || 0,
        cushionAmount || 0,
        goalsAmount || 0,
        agencyExpectedRevenue || 0,
        agencyActualRevenue || 0,
        agencyExpectedProfit || 0,
        agencyActualProfit || 0,
        impulseExpectedRevenue || 0,
        impulseActualRevenue || 0,
        impulseExpectedProfit || 0,
        impulseActualProfit || 0,
        totalExpectedProfit || 0,
        totalRevenue || 0,
        year,
        month
      )
    } else {
      // Insert
      db.prepare(`
        INSERT INTO monthly_history (
          id, year, month, totalAccounts, cushionAmount, goalsAmount,
          agencyExpectedRevenue, agencyActualRevenue, agencyExpectedProfit, agencyActualProfit,
          impulseExpectedRevenue, impulseActualRevenue, impulseExpectedProfit, impulseActualProfit,
          totalExpectedProfit, totalRevenue, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(
        id,
        year,
        month,
        totalAccounts || 0,
        cushionAmount || 0,
        goalsAmount || 0,
        agencyExpectedRevenue || 0,
        agencyActualRevenue || 0,
        agencyExpectedProfit || 0,
        agencyActualProfit || 0,
        impulseExpectedRevenue || 0,
        impulseActualRevenue || 0,
        impulseExpectedProfit || 0,
        impulseActualProfit || 0,
        totalExpectedProfit || 0,
        totalRevenue || 0
      )
    }

    db.close()
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving monthly history:', error)
    return NextResponse.json({ error: 'Failed to save monthly history' }, { status: 500 })
  }
}
