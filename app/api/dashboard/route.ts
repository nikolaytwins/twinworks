import { NextResponse } from 'next/server'
import Database from 'better-sqlite3'
import path from 'path'

const dbPath = path.join(process.cwd(), 'prisma', 'dev.db')

function getDb() {
  return new Database(dbPath)
}

// Отключаем кэширование для этого API route
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: Request) {
  try {
    const db = getDb()
    const url = new URL(request.url)
    const ipTaxReserveParam = url.searchParams.get('ipTaxReserve')
    const ipTaxReserve = ipTaxReserveParam !== null && ipTaxReserveParam !== '' ? Math.max(0, parseFloat(ipTaxReserveParam) || 0) : 0

    // Get accounts
    const accounts = db.prepare('SELECT * FROM PersonalAccount ORDER BY name ASC').all() as any[]
    
    // Get transactions for current month
    const today = new Date()
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59)
    
    const transactions = db.prepare(`
      SELECT * FROM PersonalTransaction 
      WHERE date >= ? AND date <= ?
      ORDER BY date DESC
    `).all(monthStart.toISOString(), monthEnd.toISOString()) as any[]
    
    // Get goals
    const goals = db.prepare(`
      SELECT g.*, a.balance as linkedAccountBalance
      FROM PersonalGoal g
      LEFT JOIN PersonalAccount a ON g.linkedAccountId = a.id
      ORDER BY g.deadline ASC
    `).all() as any[]
    
    // Get settings
    const settings = db.prepare('SELECT * FROM personal_settings LIMIT 1').get() as any
    
    // Calculate agency metrics
    let agencyProjects: any[] = []
    let agencyGeneralExpenses: any[] = []
    try {
      agencyProjects = db.prepare(`
        SELECT p.*, 
          COALESCE(SUM(e.amount), 0) as totalExpenses
        FROM AgencyProject p
        LEFT JOIN AgencyExpense e ON p.id = e.projectId
        GROUP BY p.id
      `).all() as any[]
      
      try {
        agencyGeneralExpenses = db.prepare('SELECT * FROM AgencyGeneralExpense').all() as any[]
      } catch (e) {
        agencyGeneralExpenses = []
      }
    } catch (e) {
      // Table might not exist yet
      agencyProjects = []
      agencyGeneralExpenses = []
    }

    // Текущий месяц: выручка и прибыль считаются только по проектам/ученикам этого месяца
    const currentMonthAgencyProjects = agencyProjects.filter((p: any) => {
      const d = new Date(p.createdAt)
      return d >= monthStart && d <= monthEnd
    })
    const currentMonthAgencyGeneralExpenses = agencyGeneralExpenses.filter((e: any) => {
      const d = new Date(e.createdAt)
      return d >= monthStart && d <= monthEnd
    })
    
    const agencyExpectedRevenue = currentMonthAgencyProjects.reduce((sum: number, p: any) => sum + (p.totalAmount || 0), 0)
    const agencyActualRevenue = currentMonthAgencyProjects.reduce((sum: number, p: any) => sum + (p.paidAmount || 0), 0)
    const agencyProjectExpenses = currentMonthAgencyProjects.reduce((sum: number, p: any) => sum + (p.totalExpenses || 0), 0)
    const agencyGeneralExpensesTotal = currentMonthAgencyGeneralExpenses.reduce((sum: number, e: any) => sum + (e.amount || 0), 0)
    const agencyTotalExpenses = agencyProjectExpenses + agencyGeneralExpensesTotal
    const agencyExpectedProfit = agencyExpectedRevenue - agencyTotalExpenses
    const agencyActualProfit = agencyActualRevenue - agencyTotalExpenses
    
    // Calculate impulse metrics
    let impulseStudents: any[] = []
    let impulseGeneralExpenses: any[] = []
    try {
      impulseStudents = db.prepare(`
        SELECT s.*, 
          COALESCE(SUM(e.amount), 0) as totalExpenses
        FROM ImpulseStudent s
        LEFT JOIN ImpulseExpense e ON s.id = e.studentId
        GROUP BY s.id
      `).all() as any[]
      
      try {
        impulseGeneralExpenses = db.prepare('SELECT * FROM ImpulseGeneralExpense').all() as any[]
      } catch (e) {
        impulseGeneralExpenses = []
      }
    } catch (e) {
      // Table might not exist yet
      impulseStudents = []
      impulseGeneralExpenses = []
    }

    // Текущий месяц: только ученики и общие расходы этого месяца
    const currentMonthImpulseStudents = impulseStudents.filter((s: any) => {
      const d = new Date(s.createdAt)
      return d >= monthStart && d <= monthEnd
    })
    const currentMonthImpulseGeneralExpenses = impulseGeneralExpenses.filter((e: any) => {
      const d = new Date(e.createdAt)
      return d >= monthStart && d <= monthEnd
    })
    
    const impulseExpectedRevenue = currentMonthImpulseStudents.reduce((sum: number, s: any) => sum + (s.totalAmount || 0), 0)
    const impulseActualRevenue = currentMonthImpulseStudents.reduce((sum: number, s: any) => sum + (s.paidAmount || 0), 0)
    const impulseStudentExpenses = currentMonthImpulseStudents.reduce((sum: number, s: any) => sum + (s.totalExpenses || 0), 0)
    const impulseGeneralExpensesTotal = currentMonthImpulseGeneralExpenses.reduce((sum: number, e: any) => sum + (e.amount || 0), 0)
    const impulseTotalExpenses = impulseStudentExpenses + impulseGeneralExpensesTotal
    const impulseExpectedProfit = impulseExpectedRevenue - impulseTotalExpenses
    const impulseActualProfit = impulseActualRevenue - impulseTotalExpenses
    
    // Total expected profit
    const totalExpectedProfit = agencyExpectedProfit + impulseExpectedProfit
    
    // Calculate total revenue (all projects)
    const totalRevenue = agencyExpectedRevenue + impulseExpectedRevenue
    
    // Calculate total expected expenses from categories
    let totalExpectedExpenses = 0
    try {
      const categories = db.prepare('SELECT expectedMonthly FROM expense_categories').all() as any[]
      totalExpectedExpenses = categories.reduce((sum: number, c: any) => sum + (c.expectedMonthly || 0), 0)
    } catch (e) {
      // Categories table might not exist
      totalExpectedExpenses = 0
    }
    
    // Calculate projected expenses for the rest of the month
    let dailyExpenseLimit = 3500
    try {
      const expenseSettings = db.prepare('SELECT dailyExpenseLimit FROM expense_settings LIMIT 1').get() as any
      if (expenseSettings) {
        dailyExpenseLimit = expenseSettings.dailyExpenseLimit || 3500
      }
    } catch (e) {
      // Settings table might not exist
    }
    
    const currentYear = today.getFullYear()
    const currentMonth = today.getMonth() + 1
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate()
    const daysRemaining = daysInMonth - today.getDate() + 1 // +1 to include today
    
    // Get one-time expenses for current month
    // Для месячного прогноза: все ЛИЧНЫЕ расходы (оплаченные + неоплаченные)
    // Неоплаченные разовые: ВСЕ типы (личные + рабочие), как на странице /me/finance/expense-settings
    let oneTimeExpensesTotal = 0 // Все личные расходы для месячного прогноза
    let oneTimeExpensesUnpaidTotal = 0 // Неоплаченные разовые (все типы) — совпадает с суммой на expense-settings
    try {
      const oneTimeExpensesPersonal = db.prepare(`
        SELECT amount, paid, type FROM one_time_expenses
        WHERE year = ? AND month = ? AND (type = 'personal' OR type IS NULL)
      `).all(currentYear, currentMonth) as any[]
      
      oneTimeExpensesTotal = oneTimeExpensesPersonal.reduce((sum: number, e: any) => sum + (e.amount || 0), 0)
      
      // Неоплаченные разовые: берём ВСЕ расходы месяца (как на expense-settings), фильтруем по paid
      const oneTimeExpensesAll = db.prepare(`
        SELECT amount, paid FROM one_time_expenses
        WHERE year = ? AND month = ?
      `).all(currentYear, currentMonth) as any[]
      
      const isPaid = (paid: any) => paid === 1 || paid === true || paid === '1' || paid === 'true'
      const unpaidExpenses = oneTimeExpensesAll.filter((e: any) => !isPaid(e.paid))
      oneTimeExpensesUnpaidTotal = unpaidExpenses.reduce((sum: number, e: any) => sum + (e.amount || 0), 0)
    } catch (e) {
      console.error('❌ Ошибка при получении разовых расходов:', e)
    }
    
    // Месячный прогноз: все ЛИЧНЫЕ расходы (оплаченные + неоплаченные)
    const projectedExpenses = (dailyExpenseLimit * daysInMonth) + oneTimeExpensesTotal
    // Прогноз на конец месяца (для сальдо): только неоплаченные ЛИЧНЫЕ расходы
    const projectedExpensesForMonthEnd = (dailyExpenseLimit * daysRemaining) + oneTimeExpensesUnpaidTotal
    
    // Get personal categories to filter actual expenses
    let personalCategoryNames: string[] = []
    try {
      const categories = db.prepare("SELECT name FROM expense_categories WHERE type = 'personal'").all() as any[]
      personalCategoryNames = categories.map((c: any) => c.name)
    } catch (e) {
      // Categories table might not exist
    }
    
    // Calculate actual PERSONAL expenses for current month from transactions
    // Сальдо = прибыль - факт личных расходов - прогноз оставшихся личных расходов
    const actualPersonalExpenses = transactions
      .filter(t => t.type === 'expense' && t.category && personalCategoryNames.includes(t.category))
      .reduce((sum: number, t: any) => sum + (t.amount || 0), 0)

    // Суммы по бюджетным категориям для прогресс-баров
    // Бытовые расходы = Бытовые расходы + Рестораны по необходимости + Транспорт
    // Поиск категорий без учёта регистра (рабочие расходы / Рабочие расходы)
    const categoryStatsForCards: Record<string, number> = {}
    transactions
      .filter((t: any) => t.type === 'expense')
      .forEach((t: any) => {
        const raw = (t.category || 'Без категории') as string
        const name = raw.trim()
        const lower = name.toLowerCase()
        // Объединяем "Лера" и "На Леру" в одну категорию "На Леру"
        const normalized =
          lower === 'лера' || lower === 'на леру' ? 'На Леру' : (name || 'Без категории')
        categoryStatsForCards[normalized] = (categoryStatsForCards[normalized] || 0) + (t.amount || 0)
      })
    const getSumByCategory = (name: string) => {
      let sum = 0
      const nameLower = name.toLowerCase()
      for (const [cat, amount] of Object.entries(categoryStatsForCards)) {
        if ((cat || '').toLowerCase() === nameLower) sum += amount
      }
      return sum
    }
    const BUDGET_CATEGORY_KEYS = ['household', 'work', 'self', 'lera', 'together', 'gifts'] as const
    const BUDGET_TRANSACTION_CATEGORIES: Record<string, string> = {
      household: 'Бытовые расходы',
      work: 'Рабочие расходы',
      self: 'На себя',
      lera: 'На Леру',
      together: 'Совместное время с Лерой',
      gifts: 'Подарки',
    }
    const spentByBudgetCategory: Record<string, number> = {}
    for (const key of BUDGET_CATEGORY_KEYS) {
      let sum = getSumByCategory(BUDGET_TRANSACTION_CATEGORIES[key])
      if (key === 'household') {
        sum += getSumByCategory('Рестораны по необходимости')
        sum += getSumByCategory('Транспорт')
      }
      spentByBudgetCategory[key] = sum
    }
    
    // Calculate balance (total EXPECTED PROFIT - actual PERSONAL expenses - projected PERSONAL expenses for month end)
    // Сальдо: прибыль всех проектов - факт личных расходов - прогноз оставшихся личных расходов
    const balance = totalExpectedProfit - actualPersonalExpenses - projectedExpensesForMonthEnd
    
    // Calculate account totals
    // Резервы - счета с названиями, содержащими "резерв", "подушка", "цель" (case insensitive)
    const reserveKeywords = ['резерв', 'подушка', 'цель']
    const reserveAccounts = accounts.filter((a: any) => 
      reserveKeywords.some(keyword => a.name.toLowerCase().includes(keyword.toLowerCase()))
    )
    const reserveAccountIds = reserveAccounts.map(a => a.id)
    
    // Замороженные активы - счета с типом "other" (как в finance page)
    const frozenAccounts = accounts.filter((a: any) => a.type === 'other')
    const frozenAccountIds = frozenAccounts.map(a => a.id)
    
    // Доступные деньги - card, cash, bank, но НЕ резервы и НЕ замороженные активы
    const availableAccounts = accounts.filter((a: any) => 
      (a.type === 'card' || a.type === 'cash' || a.type === 'bank') &&
      !reserveAccountIds.includes(a.id) &&
      !frozenAccountIds.includes(a.id)
    )
    
    // Общий капитал = доступные деньги + замороженные активы (БЕЗ резервов)
    // ИП на налоги вычитаем из доступных (если передан ipTaxReserve в query)
    const availableRaw = availableAccounts.reduce((sum: number, acc: any) => sum + acc.balance, 0)
    const availableNow = Math.max(0, availableRaw - ipTaxReserve)
    const frozenAmount = frozenAccounts.reduce((sum: number, acc: any) => sum + acc.balance, 0)
    const totalAccounts = availableNow + frozenAmount
    
    const cushionAccounts = accounts.filter((a: any) => a.name.toLowerCase().includes('подушка'))
    const cushionAmount = cushionAccounts.reduce((sum: number, acc: any) => sum + acc.balance, 0)
    const goalAccounts = accounts.filter((a: any) => a.name.toLowerCase().includes('цель'))
    const goalsAmount = goalAccounts.reduce((sum: number, acc: any) => sum + acc.balance, 0)
    
    // Calculate unpaid projects revenue (for new month end forecast formula)
    // Не оплачено: not_paid = вся сумма, prepaid = (сумма − оплачено), paid = 0
    const unpaidAgencyProjects = currentMonthAgencyProjects.reduce((sum: number, p: any) => {
      const total = p.totalAmount || 0
      const paid = p.paidAmount || 0
      if (p.status === 'not_paid') return sum + total
      if (p.status === 'prepaid') return sum + Math.max(0, total - paid)
      return sum
    }, 0)
    const unpaidImpulseStudents = currentMonthImpulseStudents.reduce((sum: number, s: any) => {
      const total = s.totalAmount || 0
      const paid = s.paidAmount || 0
      if (s.status === 'not_paid') return sum + total
      if (s.status === 'prepaid') return sum + Math.max(0, total - paid)
      return sum
    }, 0)
    const unpaidProjectsRevenue = unpaidAgencyProjects + unpaidImpulseStudents
    
    // Расчет налогов агентства для текущего месяца
    // Налоги: 6916 руб/месяц + 1% от суммы на расчетный счет (оплаченные проекты с paymentMethod === 'account')
    const accountRevenue = currentMonthAgencyProjects
      .filter((p: any) => p.paymentMethod === 'account' && p.status === 'paid')
      .reduce((sum: number, p: any) => sum + (p.paidAmount || 0), 0)
    const taxAmount = 6916 + (accountRevenue * 0.01)
    
    // Получаем подтвержденный капитал и дату подтверждения
    let lastConfirmedTotalAccounts: number | null = null
    let lastConfirmedTotalAccountsDate: Date | null = null
    try {
      const settings = db.prepare('SELECT lastConfirmedTotalAccounts, lastConfirmedTotalAccountsDate FROM personal_settings LIMIT 1').get() as any
      if (settings) {
        lastConfirmedTotalAccounts = settings.lastConfirmedTotalAccounts || null
        if (settings.lastConfirmedTotalAccountsDate) {
          lastConfirmedTotalAccountsDate = new Date(settings.lastConfirmedTotalAccountsDate)
        }
      }
    } catch (e) {
      // Settings might not have these fields yet
    }
    
    // Рассчитываем оценочный капитал сейчас
    let estimatedTotalAccountsNow = totalAccounts
    let estimatedBeforeClamp: number | null = null
    let daysSinceConfirmed: number | null = null // null означает, что капитал не подтвержден
    let confirmedDayLabel: string | null = null
    
    if (lastConfirmedTotalAccounts !== null && lastConfirmedTotalAccountsDate !== null) {
      const now = new Date()
      const confirmedDate = new Date(lastConfirmedTotalAccountsDate)
      
      // Проверяем, что дата подтверждения не в будущем
      if (confirmedDate > now) {
        // Если дата в будущем, считаем что капитал не подтвержден
        daysSinceConfirmed = null
      } else {
        // Нормализуем даты до начала дня в локальном времени для точного расчета
        const nowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const confirmedStart = new Date(confirmedDate.getFullYear(), confirmedDate.getMonth(), confirmedDate.getDate())
        const diffTime = nowStart.getTime() - confirmedStart.getTime()
        daysSinceConfirmed = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)))
        
        // Единая текстовая метка по количеству календарных дней
        if (daysSinceConfirmed === 0) {
          confirmedDayLabel = 'today'
        } else if (daysSinceConfirmed === 1) {
          confirmedDayLabel = 'yesterday'
        } else {
          confirmedDayLabel = `${daysSinceConfirmed}_days`
        }
        
        // Вариант A: моделируем потери с даты подтверждения.
        // В день подтверждения оценка равна фактическому капиталу,
        // далее каждый день уменьшаем на dailyExpenseLimit.
        if (daysSinceConfirmed === 0) {
          estimatedBeforeClamp = totalAccounts
        } else {
          estimatedBeforeClamp = lastConfirmedTotalAccounts - (dailyExpenseLimit * daysSinceConfirmed)
        }
        
        // Оценочный капитал не может быть выше ручного:
        // если по моделируемой траектории получилось больше, чем totalAccounts,
        // считаем, что реальность "хуже" и берем минимум.
        if (estimatedBeforeClamp !== null) {
          estimatedTotalAccountsNow = Math.min(totalAccounts, estimatedBeforeClamp)
        }
      }
    } else {
      // Нет подтвержденного капитала — считаем, что оценочный равен ручному
      estimatedBeforeClamp = totalAccounts
      confirmedDayLabel = null
    }
    
    const isDev = process.env.NODE_ENV !== 'production'
    const calculationDebug = isDev ? {
      totalAccounts,
      accountsCount: accounts.length,
      accountsSample: accounts.slice(0, 3).map((a: any) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        balance: a.balance,
      })),
      lastConfirmedTotalAccounts,
      lastConfirmedTotalAccountsDate: lastConfirmedTotalAccountsDate ? lastConfirmedTotalAccountsDate.toISOString() : null,
      now: new Date().toISOString(),
      dailyExpenseLimit,
      daysSinceConfirmed,
      estimatedBeforeClamp,
      estimatedAfterClamp: estimatedTotalAccountsNow,
      confirmedDayLabel,
    } : undefined
    
    // Новая формула прогноза на конец месяца:
    // Оценочный капитал сейчас - ожидаемые расходы (неоплаченные разовые + ежедневный лимит × остаток дней + налоги) + ожидаемые поступления (неоплаченные проекты)
    const newMonthEndForecast = estimatedTotalAccountsNow 
      - (oneTimeExpensesUnpaidTotal + (dailyExpenseLimit * daysRemaining) + taxAmount)
      + unpaidProjectsRevenue
    
    // Пессимистичный прогноз (без ожидаемых поступлений)
    const pessimisticForecast = estimatedTotalAccountsNow 
      - (oneTimeExpensesUnpaidTotal + (dailyExpenseLimit * daysRemaining) + taxAmount)
    
    // Get history for comparison (последние 12 месяцев, исключая текущий месяц)
    let historyRecords: any[] = []
    try {
      // Сначала получаем все записи истории
      const allHistory = db.prepare(`
        SELECT * FROM monthly_history
        ORDER BY year DESC, month DESC
        LIMIT 13
      `).all() as any[]
      
      // Исключаем текущий месяц, если записей больше 1
      if (allHistory.length > 1) {
        historyRecords = allHistory.filter((h: any) => !(h.year === currentYear && h.month === currentMonth)).slice(0, 12)
      } else {
        // Если записей 1 или меньше, берем все (но это маловероятно, что поможет)
        historyRecords = allHistory.slice(0, 12)
      }
    } catch (e) {
      // Table might not exist yet
      historyRecords = []
    }
    
    // Calculate averages
    let avgAgencyRevenue = 0
    let avgAgencyProfit = 0
    let avgTotalRevenue = 0
    let avgTotalProfit = 0
    
    if (historyRecords.length > 0) {
      // Сортируем историю по дате (от новых к старым) и берем последние 12 месяцев
      const sortedHistory = [...historyRecords].sort((a: any, b: any) => {
        if (a.year !== b.year) return b.year - a.year
        return b.month - a.month
      })
      const last12Months = sortedHistory.slice(0, 12)
      
      // Фильтруем только месяцы с данными (используем ExpectedRevenue, как на дашборде)
      const monthsWithAgencyData = last12Months.filter((h: any) => {
        const revenue = h.agencyExpectedRevenue || 0
        return revenue > 0
      })
      
      // Используем новое поле totalRevenue из истории для расчета средней выручки
      const monthsWithTotalRevenue = last12Months.filter((h: any) => {
        const monthRevenue = h.totalRevenue || 0
        return monthRevenue > 0
      })
      
      // Для прибыли используем totalExpectedProfit или сумму agencyActualProfit + impulseActualProfit
      const monthsWithTotalProfit = last12Months.filter((h: any) => {
        const profit = h.totalExpectedProfit || ((h.agencyActualProfit || 0) + (h.impulseActualProfit || 0))
        return profit !== 0
      })
      
      const agencyMonthsCount = monthsWithAgencyData.length > 0 ? monthsWithAgencyData.length : 1
      const totalRevenueMonthsCount = monthsWithTotalRevenue.length > 0 ? monthsWithTotalRevenue.length : 1
      const totalProfitMonthsCount = monthsWithTotalProfit.length > 0 ? monthsWithTotalProfit.length : 1
      
      if (monthsWithAgencyData.length > 0) {
        avgAgencyRevenue = monthsWithAgencyData.reduce((sum: number, h: any) => sum + (h.agencyExpectedRevenue || 0), 0) / agencyMonthsCount
        avgAgencyProfit = monthsWithAgencyData.reduce((sum: number, h: any) => sum + (h.agencyExpectedProfit || 0), 0) / agencyMonthsCount
      }
      
      // Средняя выручка всех проектов (agency + impulse) за последние 12 месяцев - используем поле totalRevenue
      if (monthsWithTotalRevenue.length > 0) {
        avgTotalRevenue = monthsWithTotalRevenue.reduce((sum: number, h: any) => {
          return sum + (h.totalRevenue || 0)
        }, 0) / totalRevenueMonthsCount
      }
      
      // Средняя прибыль всех проектов за последние 12 месяцев
      if (monthsWithTotalProfit.length > 0) {
        avgTotalProfit = monthsWithTotalProfit.reduce((sum: number, h: any) => {
          // Используем totalExpectedProfit, если есть, иначе считаем сумму
          const profit = h.totalExpectedProfit || ((h.agencyActualProfit || 0) + (h.impulseActualProfit || 0))
          return sum + profit
        }, 0) / totalProfitMonthsCount
      }
    }
    
    // Get leads that need to be contacted (nextContactDate <= today)
    let leadsToContact: any[] = []
    let upcomingLeadsToContact: any[] = []
    try {
      const todayStr = today.toISOString().split('T')[0] // YYYY-MM-DD
      const in14Days = new Date(today)
      in14Days.setDate(in14Days.getDate() + 14)
      const in14DaysStr = in14Days.toISOString().split('T')[0]
      leadsToContact = db.prepare(`
        SELECT id, contact, source, status, nextContactDate
        FROM agency_leads
        WHERE nextContactDate IS NOT NULL 
          AND DATE(nextContactDate) <= DATE(?)
          AND status NOT IN ('paid', 'pause')
        ORDER BY nextContactDate ASC
      `).all(todayStr) as any[]
      // Ближайшие напоминания (дата в будущем, в течение 14 дней) — чтобы проверить автосозданные
      upcomingLeadsToContact = db.prepare(`
        SELECT id, contact, source, status, nextContactDate
        FROM agency_leads
        WHERE nextContactDate IS NOT NULL 
          AND DATE(nextContactDate) > DATE(?)
          AND DATE(nextContactDate) <= DATE(?)
          AND status NOT IN ('paid', 'pause')
        ORDER BY nextContactDate ASC
      `).all(todayStr, in14DaysStr) as any[]
    } catch (e) {
      leadsToContact = []
      upcomingLeadsToContact = []
    }
    
    db.close()
    
    return NextResponse.json({
      accounts,
      transactions,
      goals,
      settings,
      leadsToContact,
      upcomingLeadsToContact,
      metrics: {
        totalAccounts,
        cushionAmount,
        goalsAmount,
        agencyExpectedRevenue,
        agencyActualRevenue,
        agencyExpectedProfit,
        agencyActualProfit,
        agencyAvgRevenue: avgAgencyRevenue,
        agencyAvgProfit: avgAgencyProfit,
        avgTotalRevenue: avgTotalRevenue,
        avgTotalProfit: avgTotalProfit,
        impulseExpectedRevenue,
        impulseActualRevenue,
        impulseExpectedProfit,
        impulseActualProfit,
        totalExpectedProfit,
        totalRevenue,
        balance,
        totalExpectedExpenses,
        projectedExpenses, // Месячный прогноз (все расходы: оплаченные + неоплаченные)
        projectedExpensesForMonthEnd, // Прогноз на конец месяца для сальдо (только неоплаченные расходы)
        actualExpenses: actualPersonalExpenses, // Фактические личные расходы за месяц
        dailyExpenseLimit,
        daysRemaining,
        unpaidProjectsRevenue, // Сумма неоплаченных проектов (агентство + импульс)
        newMonthEndForecast, // Новая формула прогноза на конец месяца
        pessimisticForecast, // Пессимистичный прогноз (без ожидаемых поступлений)
        oneTimeExpensesUnpaidTotal, // Неоплаченные разовые расходы
        unpaidAgencyProjects, // Неоплаченные проекты агентства
        unpaidImpulseStudents, // Неоплаченные студенты импульса
        estimatedTotalAccountsNow, // Оценочный капитал сейчас
        lastConfirmedTotalAccounts, // Последний подтвержденный капитал
        lastConfirmedTotalAccountsDate: lastConfirmedTotalAccountsDate ? lastConfirmedTotalAccountsDate.toISOString() : null, // Дата подтверждения капитала
        daysSinceConfirmed: daysSinceConfirmed !== null ? daysSinceConfirmed : null, // Дней с последнего подтверждения (null если не подтвержден)
        confirmedDayLabel, // Текстовая метка (today / yesterday / N_days)
        taxAmount, // Налоги агентства за текущий месяц
        availableNow, // Доступно сейчас (для цели «Капитал» на дашборде)
        spentByBudgetCategory, // Суммы по бюджетным категориям (household = бытовые + рестораны)
      },
      calculationDebug,
    })
  } catch (error) {
    console.error('Error fetching dashboard data:', error)
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 })
  }
}
