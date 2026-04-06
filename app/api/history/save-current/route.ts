import { NextResponse } from 'next/server'
import Database from 'better-sqlite3'
import path from 'path'

const dbPath = path.join(process.cwd(), 'prisma', 'dev.db')

function getDb() {
  return new Database(dbPath)
}

export async function POST() {
  try {
    const db = getDb()
    const today = new Date()
    const year = today.getFullYear()
    const month = today.getMonth() + 1
    
    // Get current metrics
    const accounts = db.prepare('SELECT * FROM PersonalAccount').all() as any[]
    const totalAccounts = accounts.reduce((sum: number, acc: any) => sum + acc.balance, 0)
    const cushionAccounts = accounts.filter((a: any) => a.name.toLowerCase().includes('подушка'))
    const cushionAmount = cushionAccounts.reduce((sum: number, acc: any) => sum + acc.balance, 0)
    const goalAccounts = accounts.filter((a: any) => a.name.toLowerCase().includes('цель'))
    const goalsAmount = goalAccounts.reduce((sum: number, acc: any) => sum + acc.balance, 0)
    
    // Agency metrics
    let agencyProjects: any[] = []
    try {
      agencyProjects = db.prepare(`
        SELECT p.*, COALESCE(SUM(e.amount), 0) as totalExpenses
        FROM AgencyProject p
        LEFT JOIN AgencyExpense e ON p.id = e.projectId
        GROUP BY p.id
      `).all() as any[]
    } catch (e) {
      agencyProjects = []
    }
    
    const agencyExpectedRevenue = agencyProjects.reduce((sum: number, p: any) => sum + (p.totalAmount || 0), 0)
    const agencyActualRevenue = agencyProjects.reduce((sum: number, p: any) => sum + (p.paidAmount || 0), 0)
    const agencyTotalExpenses = agencyProjects.reduce((sum: number, p: any) => sum + (p.totalExpenses || 0), 0)
    const agencyExpectedProfit = agencyExpectedRevenue - agencyTotalExpenses
    const agencyActualProfit = agencyActualRevenue - agencyTotalExpenses
    
    // Impulse metrics
    let impulseStudents: any[] = []
    try {
      impulseStudents = db.prepare(`
        SELECT s.*, COALESCE(SUM(e.amount), 0) as totalExpenses
        FROM ImpulseStudent s
        LEFT JOIN ImpulseExpense e ON s.id = e.studentId
        GROUP BY s.id
      `).all() as any[]
    } catch (e) {
      impulseStudents = []
    }
    
    const impulseExpectedRevenue = impulseStudents.reduce((sum: number, s: any) => sum + (s.totalAmount || 0), 0)
    const impulseActualRevenue = impulseStudents.reduce((sum: number, s: any) => sum + (s.paidAmount || 0), 0)
    const impulseTotalExpenses = impulseStudents.reduce((sum: number, s: any) => sum + (s.totalExpenses || 0), 0)
    const impulseExpectedProfit = impulseExpectedRevenue - impulseTotalExpenses
    const impulseActualProfit = impulseActualRevenue - impulseTotalExpenses
    
    const totalExpectedProfit = agencyExpectedProfit + impulseExpectedProfit
    
    // Общая выручка = ожидаемая выручка агентства + ожидаемая выручка импульса
    const totalRevenue = agencyExpectedRevenue + impulseExpectedRevenue
    
    // Calculate personal and business expenses for current month
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
        totalExpectedProfit, totalRevenue, year, month
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
        totalExpectedProfit, totalRevenue
      )
    }
    
    db.close()
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving history:', error)
    return NextResponse.json({ error: 'Failed to save history' }, { status: 500 })
  }
}
