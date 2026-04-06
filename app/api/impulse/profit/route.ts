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
    
    // Фильтруем студентов по месяцу
    const monthStart = new Date(Number(year), Number(month) - 1, 1)
    const monthEnd = new Date(Number(year), Number(month), 0, 23, 59, 59)
    
    const impulseStudents = db.prepare(`
      SELECT s.*, COALESCE(SUM(e.amount), 0) as totalExpenses
      FROM ImpulseStudent s
      LEFT JOIN ImpulseExpense e ON s.id = e.studentId
      WHERE date(s.createdAt) >= date(?) AND date(s.createdAt) <= date(?)
      GROUP BY s.id
    `).all(monthStart.toISOString().split('T')[0], monthEnd.toISOString().split('T')[0]) as any[]
    
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
    
    const expectedRevenue = impulseStudents.reduce((sum: number, s: any) => sum + (s.totalAmount || 0), 0)
    const actualRevenue = impulseStudents.filter((s: any) => s.status === 'paid').reduce((sum: number, s: any) => sum + (s.paidAmount || 0), 0)
    const studentExpenses = impulseStudents.reduce((sum: number, s: any) => sum + (s.totalExpenses || 0), 0)
    const generalExpensesTotal = impulseGeneralExpenses.reduce((sum: number, e: any) => sum + (e.amount || 0), 0)
    
    const totalExpenses = studentExpenses + generalExpensesTotal
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
    console.error('Error calculating impulse profit:', error)
    return NextResponse.json({ error: 'Failed to calculate impulse profit' }, { status: 500 })
  }
}
