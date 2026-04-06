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
    const year = searchParams.get('year')
    const month = searchParams.get('month')

    if (!year || !month) {
      return NextResponse.json({ error: 'Year and month are required' }, { status: 400 })
    }

    const db = getDb()
    
    // Фильтруем проекты по месяцу
    const monthStart = new Date(Number(year), Number(month) - 1, 1)
    const monthEnd = new Date(Number(year), Number(month), 0, 23, 59, 59)
    
    const agencyProjects = db.prepare(`
      SELECT p.*, COALESCE(SUM(e.amount), 0) as totalExpenses
      FROM AgencyProject p
      LEFT JOIN AgencyExpense e ON p.id = e.projectId
      WHERE date(p.createdAt) >= date(?) AND date(p.createdAt) <= date(?)
      GROUP BY p.id
    `).all(monthStart.toISOString().split('T')[0], monthEnd.toISOString().split('T')[0]) as any[]
    
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
    
    // Используем ту же логику, что на странице агентства
    // actualRevenue = projects.reduce((sum, p) => sum + p.paidAmount, 0)
    const expectedRevenue = agencyProjects.reduce((sum: number, p: any) => sum + (p.totalAmount || 0), 0)
    const actualRevenue = agencyProjects.reduce((sum: number, p: any) => sum + (p.paidAmount || 0), 0)
    const projectExpenses = agencyProjects.reduce((sum: number, p: any) => sum + (p.totalExpenses || 0), 0)
    const generalExpensesTotal = agencyGeneralExpenses.reduce((sum: number, e: any) => sum + (e.amount || 0), 0)
    
    // Расчет налогов: 6916 руб/месяц + 1% от суммы на расчетный счет
    const accountRevenue = agencyProjects
      .filter((p: any) => p.paymentMethod === 'account' && p.status === 'paid')
      .reduce((sum: number, p: any) => sum + (p.paidAmount || 0), 0)
    const taxAmount = 6916 + (accountRevenue * 0.01)
    
    const totalExpenses = projectExpenses + generalExpensesTotal + taxAmount
    const expectedProfit = expectedRevenue - totalExpenses
    const actualProfit = actualRevenue - totalExpenses
    
    db.close()
    
    return NextResponse.json({
      expectedRevenue,
      actualRevenue,
      totalExpenses,
      expectedProfit,
      actualProfit
    })
  } catch (error) {
    console.error('Error calculating agency profit:', error)
    return NextResponse.json({ error: 'Failed to calculate agency profit' }, { status: 500 })
  }
}
