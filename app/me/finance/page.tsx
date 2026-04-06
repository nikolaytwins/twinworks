'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { useRouter } from 'next/navigation'

interface Account {
  id: string
  name: string
  type: string
  currency: string
  balance: number
  notes?: string | null
  order?: number
}

interface Transaction {
  id: string
  date: string
  type: string
  amount: number
  category: string | null
  description: string | null
  fromAccountId: string | null
  toAccountId: string | null
  fromAccountName: string | null
  toAccountName: string | null
  currency: string
}

export default function FinancePage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [goals, setGoals] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [balance, setBalance] = useState<number>(0)
  const [balanceAtMonthStart, setBalanceAtMonthStart] = useState<number | null>(null)
  const [balanceAtLastMonthEnd, setBalanceAtLastMonthEnd] = useState<number | null>(null)
  const [initialStartBalance, setInitialStartBalance] = useState<number | null>(null)
  const [isEditingMonthStartBalance, setIsEditingMonthStartBalance] = useState(false)
  const [tempMonthStartBalance, setTempMonthStartBalance] = useState<string>('')
  const [projectedExpenses, setProjectedExpenses] = useState<number>(0)
  const [dailyExpenseLimit, setDailyExpenseLimit] = useState<number>(3500)
  const [oneTimeExpenses, setOneTimeExpenses] = useState<number>(0)
  const [newMonthEndForecast, setNewMonthEndForecast] = useState<number | null>(null)
  const [unpaidProjectsRevenue, setUnpaidProjectsRevenue] = useState<number>(0)
  const [estimatedTotalAccountsNow, setEstimatedTotalAccountsNow] = useState<number | null>(null)
  const [lastConfirmedTotalAccounts, setLastConfirmedTotalAccounts] = useState<number | null>(null)
  const [lastConfirmedTotalAccountsDate, setLastConfirmedTotalAccountsDate] = useState<string | null>(null)
  const [daysSinceConfirmed, setDaysSinceConfirmed] = useState<number | null>(null)
  const [confirmedDayLabel, setConfirmedDayLabel] = useState<string | null>(null)
  const [serverNowIso, setServerNowIso] = useState<string | null>(null)
  const [showCalculationDetails, setShowCalculationDetails] = useState<boolean>(false)
  const [calculationDetails, setCalculationDetails] = useState<{
    totalAccounts: number
    oneTimeExpensesUnpaidTotal: number
    dailyExpenseLimit: number
    daysRemaining: number
    unpaidAgencyProjects: number
    unpaidImpulseStudents: number
    taxAmount: number
    debug?: {
      totalAccounts: number
      lastConfirmedTotalAccounts: number | null
      dailyExpenseLimit: number
      daysSinceConfirmed: number | null
      estimatedBeforeClamp: number | null
      estimatedAfterClamp: number
    }
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'accounts' | 'transactions' | 'goals' | 'history'>('accounts')
  const [draggedAccount, setDraggedAccount] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [ipTaxReserveInput, setIpTaxReserveInput] = useState<string>(() => {
    if (typeof window === 'undefined') return ''
    const v = localStorage.getItem('finance_ip_tax_reserve')
    if (v === null || v === '') return ''
    const n = Number(v)
    if (isNaN(n) || n === 0) return ''
    return String(n)
  })
  const [ipTaxReserveUpdatedAt, setIpTaxReserveUpdatedAt] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('finance_ip_tax_reserve_updated_at')
  })
  const [spentByBudgetCategoryFromApi, setSpentByBudgetCategoryFromApi] = useState<Record<string, number> | null>(null)
  const router = useRouter()

  const ipTaxReserve = parseFloat(ipTaxReserveInput) || 0

  // Нормализация названий категорий для аналитики:
  // объединяем "Лера" и "На Леру" в одну категорию "На Леру"
  const normalizeCategoryName = (name: string | null | undefined): string => {
    const raw = (name || 'Без категории').trim()
    const lower = raw.toLowerCase()
    if (lower === 'лера' || lower === 'на леру') return 'На Леру'
    return raw || 'Без категории'
  }

  const saveIpTaxReserve = (value: string) => {
    setIpTaxReserveInput(value)
    if (typeof window !== 'undefined') {
      localStorage.setItem('finance_ip_tax_reserve', value === '' ? '0' : value)
      const now = new Date().toISOString()
      localStorage.setItem('finance_ip_tax_reserve_updated_at', now)
      setIpTaxReserveUpdatedAt(now)
    }
  }

  const formatIpTaxReserveUpdatedAt = (iso: string | null) => {
    if (!iso) return null
    const d = new Date(iso)
    if (isNaN(d.getTime())) return null
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  useEffect(() => {
    fetchData()
    
    // Обновляем данные при возврате на страницу (когда вкладка становится видимой)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchData(true) // preserveScroll = true, чтобы не терять позицию скролла
        // Восстанавливаем ИП на налоги из localStorage (не сбрасывается при смене месяца)
        const stored = typeof window !== 'undefined' ? localStorage.getItem('finance_ip_tax_reserve') : null
        if (stored !== null && stored !== '') setIpTaxReserveInput(stored)
      }
    }
    
    // Обновляем данные при фокусе на окне
    const handleFocus = () => {
      fetchData(true)
      const stored = typeof window !== 'undefined' ? localStorage.getItem('finance_ip_tax_reserve') : null
      if (stored !== null && stored !== '') setIpTaxReserveInput(stored)
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [])

  const fetchData = async (preserveScroll: boolean = false) => {
    let scrollPosition = 0
    if (preserveScroll) {
      scrollPosition = window.scrollY || document.documentElement.scrollTop
    }
    
    try {
      // Добавляем timestamp для предотвращения кэширования
      const timestamp = Date.now()
      const [accountsRes, transactionsRes, dashboardRes, categoriesRes] = await Promise.all([
        fetch(`/api/accounts?t=${timestamp}`, { cache: 'no-store' }).then(r => r.json()),
        fetch(`/api/transactions?t=${timestamp}`, { cache: 'no-store' }).then(r => r.json()),
        fetch(`/api/dashboard?t=${timestamp}&ipTaxReserve=${encodeURIComponent(ipTaxReserve)}`, { cache: 'no-store' }).then(r => r.json()),
        fetch(`/api/categories?t=${timestamp}`, { cache: 'no-store' }).then(r => r.json()).catch(() => []),
      ])
      
      // Логирование для отладки
      console.log('📊 Обновление данных финансов:', {
        oneTimeExpensesUnpaidTotal: dashboardRes.metrics?.oneTimeExpensesUnpaidTotal,
        newMonthEndForecast: dashboardRes.metrics?.newMonthEndForecast,
        timestamp: new Date().toISOString()
      })
      setAccounts(accountsRes)
      setTransactions(transactionsRes)
      setGoals(Array.isArray(dashboardRes.goals) ? dashboardRes.goals : [])
      setCategories(Array.isArray(categoriesRes) ? categoriesRes : [])
      
      // Получаем сальдо и баланс на начало месяца из dashboard
      const totalAccounts = accountsRes.reduce((sum: number, acc: Account) => sum + acc.balance, 0)
      
      if (dashboardRes.metrics) {
        const metrics = dashboardRes.metrics
        console.log('📊 Получены метрики из API:', {
          oneTimeExpensesUnpaidTotal: metrics.oneTimeExpensesUnpaidTotal,
          newMonthEndForecast: metrics.newMonthEndForecast,
          unpaidAgencyProjects: metrics.unpaidAgencyProjects,
          unpaidImpulseStudents: metrics.unpaidImpulseStudents,
        })
        
        setBalance(metrics.balance || 0)
        setProjectedExpenses(metrics.projectedExpenses || 0)
        setDailyExpenseLimit(metrics.dailyExpenseLimit || 3500)
        setUnpaidProjectsRevenue(metrics.unpaidProjectsRevenue || 0)
        setEstimatedTotalAccountsNow(metrics.estimatedTotalAccountsNow ?? null)
        setLastConfirmedTotalAccounts(metrics.lastConfirmedTotalAccounts ?? null)
        setLastConfirmedTotalAccountsDate(metrics.lastConfirmedTotalAccountsDate ?? null)
        setDaysSinceConfirmed(metrics.daysSinceConfirmed !== undefined && metrics.daysSinceConfirmed !== null ? metrics.daysSinceConfirmed : null)
        setConfirmedDayLabel(metrics.confirmedDayLabel ?? null)
        setServerNowIso(dashboardRes.calculationDebug?.now ?? null)
        if (dashboardRes.metrics?.spentByBudgetCategory) {
          setSpentByBudgetCategoryFromApi(dashboardRes.metrics.spentByBudgetCategory)
        }
        
        // Сохраняем детали для отображения
        const details: typeof calculationDetails = {
          totalAccounts: metrics.totalAccounts || 0,
          oneTimeExpensesUnpaidTotal: metrics.oneTimeExpensesUnpaidTotal || 0,
          dailyExpenseLimit: metrics.dailyExpenseLimit || 3500,
          daysRemaining: metrics.daysRemaining || 0,
          unpaidAgencyProjects: metrics.unpaidAgencyProjects || 0,
          unpaidImpulseStudents: metrics.unpaidImpulseStudents || 0,
          taxAmount: metrics.taxAmount || 0,
          debug: dashboardRes.calculationDebug ? {
            totalAccounts: dashboardRes.calculationDebug.totalAccounts,
            lastConfirmedTotalAccounts: dashboardRes.calculationDebug.lastConfirmedTotalAccounts ?? null,
            dailyExpenseLimit: dashboardRes.calculationDebug.dailyExpenseLimit,
            daysSinceConfirmed: dashboardRes.calculationDebug.daysSinceConfirmed ?? null,
            estimatedBeforeClamp: dashboardRes.calculationDebug.estimatedBeforeClamp ?? null,
            estimatedAfterClamp: dashboardRes.calculationDebug.estimatedAfterClamp,
          } : undefined,
        }
        console.log('📋 Детали расчета (сохраняем в state):', details)
        console.log('📋 Новый прогноз на конец месяца:', metrics.newMonthEndForecast)
        console.debug('📊 Обновлённое состояние капитала после fetchData', {
          totalAccounts,
          estimatedTotalAccountsNow: metrics.estimatedTotalAccountsNow,
          lastConfirmedTotalAccounts: metrics.lastConfirmedTotalAccounts,
          daysSinceConfirmed: metrics.daysSinceConfirmed,
        })
        
        setCalculationDetails(details)
        setNewMonthEndForecast(metrics.newMonthEndForecast ?? null)
        
        console.log('✅ State обновлен. Новый прогноз:', metrics.newMonthEndForecast)
      }
      
      // Получаем разовые расходы (только личные для прогноза личных расходов)
      try {
        const expenseSettingsRes = await fetch('/api/expense-settings')
        const expenseSettings = await expenseSettingsRes.json()
        if (expenseSettings.oneTimeExpenses) {
          // Фильтруем только личные расходы (type='personal' или type отсутствует/null)
          const personalOneTimeExpenses = expenseSettings.oneTimeExpenses.filter(
            (e: any) => !e.type || e.type === 'personal' || e.type === null
          )
          const oneTimeTotal = personalOneTimeExpenses.reduce((sum: number, e: any) => sum + (e.amount || 0), 0)
          setOneTimeExpenses(oneTimeTotal)
        }
      } catch (e) {
        // Ignore
      }
      
      // Получаем баланс на 1 число месяца и на конец прошлого месяца из истории
      const today = new Date()
      const currentYear = today.getFullYear()
      const currentMonth = today.getMonth() + 1
      
      // Вычисляем прошлый месяц
      const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1
      const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear
      
      try {
        // Пытаемся получить историю
        const historyRes = await fetch('/api/history')
        const historyData = await historyRes.json()
        const historyArray = Array.isArray(historyData) ? historyData : []
        
        // История за текущий месяц (баланс на 1 число)
        const currentMonthHistory = historyArray.find((h: any) => h.year === currentYear && h.month === currentMonth)
        let monthStartBalance = totalAccounts
        if (currentMonthHistory && currentMonthHistory.totalAccounts) {
          monthStartBalance = currentMonthHistory.totalAccounts
          setBalanceAtMonthStart(monthStartBalance)
        } else {
          // Если истории нет, вычисляем: текущий баланс минус сальдо
          const balance = dashboardRes.metrics?.balance || 0
          const calculatedStart = totalAccounts - balance
          monthStartBalance = calculatedStart > 0 ? calculatedStart : totalAccounts
          setBalanceAtMonthStart(monthStartBalance)
        }
        
        // История за прошлый месяц (баланс на конец прошлого месяца)
        const prevMonthHistory = historyArray.find((h: any) => h.year === prevYear && h.month === prevMonth)
        if (prevMonthHistory && prevMonthHistory.totalAccounts) {
          setBalanceAtLastMonthEnd(prevMonthHistory.totalAccounts)
        } else {
          // Если истории за прошлый месяц нет, используем баланс на начало текущего месяца
          setBalanceAtLastMonthEnd(monthStartBalance)
        }
        
        // Находим самую первую запись в истории (стартовая сумма)
        if (historyArray.length > 0) {
          // Сортируем по году и месяцу (от старых к новым) и берем первую
          const sortedHistory = [...historyArray].sort((a: any, b: any) => {
            if (a.year !== b.year) return a.year - b.year
            return a.month - b.month
          })
          const firstHistory = sortedHistory[0]
          if (firstHistory && firstHistory.totalAccounts) {
            setInitialStartBalance(firstHistory.totalAccounts)
          }
        }
      } catch (e) {
        // При ошибке используем текущий баланс
        setBalanceAtMonthStart(totalAccounts)
        setBalanceAtLastMonthEnd(totalAccounts)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
      // Восстанавливаем позицию скролла после обновления DOM
      if (preserveScroll && scrollPosition > 0) {
        // Используем двойной requestAnimationFrame для надежного восстановления после рендера
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            window.scrollTo(0, scrollPosition)
          })
        })
      }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Загрузка...</div>
      </div>
    )
  }

  const handleDragStart = (e: React.DragEvent, accountId: string) => {
    setDraggedAccount(accountId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, accountId: string) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    if (draggedAccount && draggedAccount !== accountId) {
      setDragOverId(accountId)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOverId(null)
  }

  const handleDrop = async (e: React.DragEvent, targetAccountId: string) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (!draggedAccount || draggedAccount === targetAccountId) {
      setDraggedAccount(null)
      setDragOverId(null)
      return
    }

    const draggedIndex = accounts.findIndex(acc => acc.id === draggedAccount)
    const targetIndex = accounts.findIndex(acc => acc.id === targetAccountId)

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedAccount(null)
      setDragOverId(null)
      return
    }

    // Создаем новый массив со сменой позиций
    const newAccounts = [...accounts]
    const [removed] = newAccounts.splice(draggedIndex, 1)
    // Вставляем перед целевым элементом
    newAccounts.splice(targetIndex, 0, removed)

    // Обновляем порядок начиная с 1
    const accountOrders = newAccounts.map((acc, index) => ({
      id: acc.id,
      order: index + 1
    }))

    // Оптимистичное обновление - не перезагружаем данные после успеха
    setAccounts(newAccounts)

    try {
      const res = await fetch('/api/accounts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountOrders }),
      })

      const responseData = await res.json().catch(() => null)

      if (!res.ok || !responseData?.success) {
        // Если ошибка, перезагружаем данные из сервера
        console.error('Error updating account order:', responseData || { status: res.status, statusText: res.statusText })
        fetchData()
      }
      // Если успешно - не перезагружаем, остаемся с оптимистичным обновлением
    } catch (error) {
      console.error('Error updating account order:', error)
      // При ошибке перезагружаем данные из сервера
      fetchData()
    } finally {
      setDraggedAccount(null)
      setDragOverId(null)
    }
  }

  // Категоризация счетов
  // Сначала выделяем резервы (исключения - подушка, цели, резервы)
  const reserveAccountIds = accounts
    .filter(acc => {
      const nameLower = acc.name.toLowerCase()
      return nameLower.includes('подушка') || 
             nameLower.includes('цель') ||
             nameLower.includes('резерв')
    })
    .map(acc => acc.id)

  // Замороженные активы - тип "other"
  const frozenAccounts = accounts.filter(acc => acc.type === 'other')
  const frozenAccountIds = frozenAccounts.map(acc => acc.id)

  // Резервы и цели - счета с соответствующими названиями (любого типа)
  const reserveAccounts = accounts.filter(acc => reserveAccountIds.includes(acc.id))

  // Доступные деньги - card, cash, bank, но НЕ резервы и НЕ замороженные активы
  const availableAccounts = accounts.filter(acc => 
    (acc.type === 'card' || acc.type === 'cash' || acc.type === 'bank') &&
    !reserveAccountIds.includes(acc.id) &&
    !frozenAccountIds.includes(acc.id)
  )

  // Суммы: доступные = сумма доступных счетов минус «из них на налоги»
  const availableRaw = availableAccounts.reduce((sum, acc) => sum + acc.balance, 0)
  const availableNow = Math.max(0, availableRaw - ipTaxReserve)
  const frozenAmount = frozenAccounts.reduce((sum, acc) => sum + acc.balance, 0)
  const reserveAmount = reserveAccounts.reduce((sum, acc) => sum + acc.balance, 0)
  
  // Общий капитал = доступные деньги + замороженные активы
  const totalCapital = availableNow + frozenAmount

  
  // Суммы расходов за текущий месяц (для плашек)
  const today = new Date()
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59)
  
  const currentMonthExpenses = transactions.filter(t => 
    t.type === 'expense' &&
    new Date(t.date) >= monthStart &&
    new Date(t.date) <= monthEnd
  )
  
  const categoryStatsForCards: Record<string, number> = {}
  currentMonthExpenses.forEach(t => {
    const cat = normalizeCategoryName(t.category)
    categoryStatsForCards[cat] = (categoryStatsForCards[cat] || 0) + t.amount
  })
  
  const personalCategoriesForCards = categories.filter(c => c.type === 'personal')
  const businessCategoriesForCards = categories.filter(c => c.type === 'business')
  
  const personalExpensesTotal = personalCategoriesForCards.reduce((sum, cat) => sum + (categoryStatsForCards[cat.name] || 0), 0)
  const businessExpensesTotal = businessCategoriesForCards.reduce((sum, cat) => sum + (categoryStatsForCards[cat.name] || 0), 0)

  // Лимиты по категориям личных расходов (для прогресс-баров)
  const BUDGET_CATEGORIES: { key: string; label: string; limit: number; transactionCategory: string }[] = [
    { key: 'household', label: 'Бытовые расходы', limit: 35000, transactionCategory: 'Бытовые расходы' },
    { key: 'work', label: 'Рабочие расходы', limit: 13000, transactionCategory: 'Рабочие расходы' },
    { key: 'self', label: 'На себя', limit: 20000, transactionCategory: 'На себя' },
    { key: 'lera', label: 'На леру', limit: 10000, transactionCategory: 'На Леру' },
    { key: 'together', label: 'Совместное время', limit: 35000, transactionCategory: 'Совместное время с Лерой' },
    { key: 'gifts', label: 'Подарки', limit: 15000, transactionCategory: 'Подарки' },
  ]
  const spentByBudgetCategoryLocal: Record<string, number> = {}
  BUDGET_CATEGORIES.forEach(bc => {
    spentByBudgetCategoryLocal[bc.key] = categoryStatsForCards[bc.transactionCategory] || 0
  })
  const spentByBudgetCategory = spentByBudgetCategoryFromApi ?? spentByBudgetCategoryLocal

  const typeLabels: Record<string, string> = {
    card: 'Карта',
    cash: 'Наличные',
    bank: 'Банк',
    crypto: 'Крипто',
    other: 'Другое',
  }

  // Компонент TransactionsTab для отображения транзакций
  function TransactionsTab({
    transactions,
    accounts,
    onUpdate,
    onTransactionAdded,
  }: {
    transactions: Transaction[]
    accounts: Account[]
    onUpdate: (preserveScroll?: boolean) => void
    onTransactionAdded?: (transaction: Transaction) => void
  }) {
    const [editingId, setEditingId] = useState<string | null>(null)
    const [categories, setCategories] = useState<any[]>([])
    const [quickAdd, setQuickAdd] = useState({
      type: 'expense' as 'income' | 'expense',
      category: '',
      amount: '',
      description: '',
      date: new Date().toISOString().split('T')[0],
      fromAccountId: accounts.find(a => a.type === 'card' || a.type === 'cash')?.id || accounts[0]?.id || '',
      toAccountId: accounts.find(a => a.type === 'card' || a.type === 'cash')?.id || accounts[0]?.id || '',
    })
    const [quickAddLoading, setQuickAddLoading] = useState(false)
    const [lastCategory, setLastCategory] = useState<string>('')
    
    // Месяц для фильтрации
    const today = new Date()
    const [selectedYear, setSelectedYear] = useState(today.getFullYear())
    const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1)
    
    useEffect(() => {
      fetch('/api/categories')
        .then(r => r.json())
        .then(data => setCategories(Array.isArray(data) ? data : []))
        .catch(() => setCategories([]))
    }, [])

    // Фокус на поле суммы при монтировании (без autoFocus — он вызывает скролл при re-render)
    useEffect(() => {
      const el = document.getElementById('quick-add-amount') as HTMLInputElement
      if (el) el.focus({ preventScroll: true })
    }, [])
    
    // Фильтруем транзакции по выбранному месяцу
    const monthStart = new Date(selectedYear, selectedMonth - 1, 1)
    const monthEnd = new Date(selectedYear, selectedMonth, 0, 23, 59, 59)
    const filteredTransactions = transactions.filter(t => {
      const transactionDate = new Date(t.date)
      return transactionDate >= monthStart && transactionDate <= monthEnd
    })

    const handleQuickAdd = async (e?: React.FormEvent) => {
      if (e) e.preventDefault()
      if (!quickAdd.amount || parseFloat(quickAdd.amount) <= 0) return
      
      setQuickAddLoading(true)
      try {
        const data = {
          date: quickAdd.date || new Date().toISOString().split('T')[0], // Используем дату из формы или сегодняшнюю
          type: quickAdd.type,
          amount: parseFloat(quickAdd.amount),
          currency: 'RUB',
          category: quickAdd.category && quickAdd.category.trim() ? quickAdd.category.trim() : null,
          description: quickAdd.description && quickAdd.description.trim() ? quickAdd.description.trim() : null,
          fromAccountId: null, // Не сохраняем счёт в быстрой форме
          toAccountId: null,
        }

        const res = await fetch('/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })

        if (res.ok) {
          const responseData = await res.json().catch(() => ({}))
          const newTransaction = responseData.transaction
          // Оптимистичное обновление — добавляем транзакцию в state без refetch, чтобы не было скролла
          if (onTransactionAdded && newTransaction) {
            const t = newTransaction as any
            onTransactionAdded({
              id: t.id,
              date: t.date,
              type: t.type,
              amount: t.amount,
              category: t.category ?? null,
              description: t.description ?? null,
              fromAccountId: t.fromAccountId ?? null,
              toAccountId: t.toAccountId ?? null,
              fromAccountName: t.fromAccountName ?? null,
              toAccountName: t.toAccountName ?? null,
              currency: t.currency ?? 'RUB',
            })
          } else {
            onUpdate(true)
          }
          if (quickAdd.category) {
            setLastCategory(quickAdd.category)
          }
          setQuickAdd({
            type: 'expense',
            category: quickAdd.category,
            amount: '',
            description: '',
            date: new Date().toISOString().split('T')[0],
            fromAccountId: '',
            toAccountId: '',
          })
        } else {
          const errorData = await res.json().catch(() => ({}))
          console.error('Error creating transaction:', errorData, 'Sent data:', data)
        }
      } catch (error) {
        console.error('Error creating transaction:', error)
      } finally {
        setQuickAddLoading(false)
      }
    }

    const handleDelete = async (id: string) => {
      if (!confirm('Удалить транзакцию?')) return
      
      try {
        const res = await fetch(`/api/transactions/${id}`, {
          method: 'DELETE',
        })

        if (res.ok) {
          await onUpdate(true)
        }
      } catch (error) {
        console.error('Error deleting transaction:', error)
      }
    }

    const handleUpdate = async (id: string, field: string, value: any) => {
      try {
        const transaction = transactions.find(t => t.id === id)
        if (!transaction) return

        const updatedTransaction = { ...transaction, [field]: value }
        
        const res = await fetch(`/api/transactions/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedTransaction),
        })

        if (res.ok) {
          onUpdate()
          setEditingId(null)
        }
      } catch (error) {
        console.error('Error updating transaction:', error)
      }
    }

    // Статистика по расходам по категориям (используем выбранный месяц)
    const currentMonthExpenses = filteredTransactions.filter(t => t.type === 'expense')

    const categoryStats: Record<string, number> = {}
    currentMonthExpenses.forEach(t => {
      const cat = t.category || 'Без категории'
      categoryStats[cat] = (categoryStats[cat] || 0) + t.amount
    })

    const totalExpenses = Object.values(categoryStats).reduce((sum, val) => sum + val, 0)
    const totalIncome = filteredTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0)

    // Группировка категорий по типам (личные/бизнес)
    const personalCategories = categories.filter(c => c.type === 'personal')
    const businessCategories = categories.filter(c => c.type === 'business')
    
    // Расчет расходов по категориям с разбивкой по месяцам (используем все транзакции для сравнения)
    const expensesByCategoryAndMonth: Record<string, Record<string, number>> = {}
    const monthLabels: string[] = []
    
    transactions.filter(t => t.type === 'expense').forEach(t => {
      const date = new Date(t.date)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const monthLabel = `${date.toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' })}`
      
      if (!monthLabels.includes(monthLabel)) {
        monthLabels.push(monthLabel)
      }
      
      const cat = normalizeCategoryName(t.category)
      if (!expensesByCategoryAndMonth[cat]) {
        expensesByCategoryAndMonth[cat] = {}
      }
      if (!expensesByCategoryAndMonth[cat][monthKey]) {
        expensesByCategoryAndMonth[cat][monthKey] = 0
      }
      expensesByCategoryAndMonth[cat][monthKey] += t.amount
    })
    
    // Сортируем месяцы по дате
    const sortedMonths = Array.from(new Set(
      transactions
        .filter(t => t.type === 'expense')
        .map(t => {
          const date = new Date(t.date)
          return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        })
    )).sort()
    
    const monthLabelsMap: Record<string, string> = {}
    sortedMonths.forEach(monthKey => {
      const [year, month] = monthKey.split('-')
      const date = new Date(parseInt(year), parseInt(month) - 1, 1)
      monthLabelsMap[monthKey] = date.toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' })
    })

    const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
    const currentYear = new Date().getFullYear()
    const yearOptions = Array.from({ length: 3 }, (_, i) => currentYear - i)

    return (
      <div className="space-y-6">
        {/* Селектор месяца */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700">Фильтр по месяцу</h3>
            <div className="flex items-center space-x-2">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="px-2 py-1 border border-gray-300 rounded text-sm"
              >
                {yearOptions.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="px-2 py-1 border border-gray-300 rounded text-sm"
              >
                {monthNames.map((name, index) => (
                  <option key={index + 1} value={index + 1}>{name}</option>
                ))}
              </select>
              {selectedYear !== today.getFullYear() || selectedMonth !== today.getMonth() + 1 ? (
                <button
                  onClick={() => {
                    setSelectedYear(today.getFullYear())
                    setSelectedMonth(today.getMonth() + 1)
                  }}
                  className="px-2 py-1 text-xs text-blue-600 hover:text-blue-800"
                  title="Вернуться к текущему месяцу"
                >
                  Сегодня
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {/* Сравнение расходов по категориям с разбивкой по месяцам */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Расходы по категориям по месяцам</h2>
            <p className="text-sm text-gray-500 mt-1">Сравнение расходов по категориям в разные месяцы</p>
          </div>
          <div className="p-6 overflow-x-auto">
            {sortedMonths.length === 0 ? (
              <div className="text-center text-gray-500 py-8">Нет данных о расходах</div>
            ) : (
              <div className="space-y-6">
                {/* Итоги по типам расходов */}
                <div className="border-b pb-4 mb-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">Итоги по месяцам</h3>
                  <div className="space-y-4">
                    {/* Итоги личных расходов */}
                    <div className="border-b pb-3 last:border-0">
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-sm font-medium text-gray-900">Личные расходы (всего)</div>
                        <div className="text-xs text-gray-500">
                          Среднее: {(() => {
                            const personalTotalByMonth: Record<string, number> = {}
                            sortedMonths.forEach(monthKey => {
                              personalTotalByMonth[monthKey] = personalCategories.reduce((sum, cat) => {
                                const categoryExpenses = expensesByCategoryAndMonth[cat.name] || {}
                                return sum + (categoryExpenses[monthKey] || 0)
                              }, 0)
                            })
                            const monthsWithData = Object.values(personalTotalByMonth).filter(v => v > 0).length
                            const total = Object.values(personalTotalByMonth).reduce((sum, val) => sum + val, 0)
                            return monthsWithData > 0 ? (total / monthsWithData).toLocaleString('ru-RU', { maximumFractionDigits: 0 }) : '0'
                          })()} ₽
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        {sortedMonths.map(monthKey => {
                          const total = personalCategories.reduce((sum, cat) => {
                            const categoryExpenses = expensesByCategoryAndMonth[cat.name] || {}
                            return sum + (categoryExpenses[monthKey] || 0)
                          }, 0)
                          if (total === 0) return null
                          return (
                            <div key={`personal-total-${monthKey}`} className="bg-blue-50 rounded-lg p-3 border border-blue-200 min-w-[140px]">
                              <div className="text-sm font-semibold text-blue-700 mb-1">{monthLabelsMap[monthKey]}</div>
                              <div className="text-base font-bold text-blue-900">
                                {total.toLocaleString('ru-RU')} ₽
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                    {/* Итоги бизнес расходов */}
                    <div className="border-b pb-3 last:border-0">
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-sm font-medium text-gray-900">Бизнес расходы (всего)</div>
                        <div className="text-xs text-gray-500">
                          Среднее: {(() => {
                            const businessTotalByMonth: Record<string, number> = {}
                            sortedMonths.forEach(monthKey => {
                              businessTotalByMonth[monthKey] = businessCategories.reduce((sum, cat) => {
                                const categoryExpenses = expensesByCategoryAndMonth[cat.name] || {}
                                return sum + (categoryExpenses[monthKey] || 0)
                              }, 0)
                            })
                            const monthsWithData = Object.values(businessTotalByMonth).filter(v => v > 0).length
                            const total = Object.values(businessTotalByMonth).reduce((sum, val) => sum + val, 0)
                            return monthsWithData > 0 ? (total / monthsWithData).toLocaleString('ru-RU', { maximumFractionDigits: 0 }) : '0'
                          })()} ₽
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        {sortedMonths.map(monthKey => {
                          const total = businessCategories.reduce((sum, cat) => {
                            const categoryExpenses = expensesByCategoryAndMonth[cat.name] || {}
                            return sum + (categoryExpenses[monthKey] || 0)
                          }, 0)
                          if (total === 0) return null
                          return (
                            <div key={`business-total-${monthKey}`} className="bg-purple-50 rounded-lg p-3 border border-purple-200 min-w-[140px]">
                              <div className="text-sm font-semibold text-purple-700 mb-1">{monthLabelsMap[monthKey]}</div>
                              <div className="text-base font-bold text-purple-900">
                                {total.toLocaleString('ru-RU')} ₽
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Личные расходы */}
                {personalCategories.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-4">Личные расходы</h3>
                    <div className="space-y-4">
                      {personalCategories.map((cat) => {
                        const categoryExpenses = expensesByCategoryAndMonth[cat.name] || {}
                        const monthsWithData = sortedMonths.filter(monthKey => (categoryExpenses[monthKey] || 0) > 0)
                        const total = Object.values(categoryExpenses).reduce((sum, val) => sum + val, 0)
                        const avg = monthsWithData.length > 0 
                          ? total / monthsWithData.length 
                          : 0
                        
                        if (monthsWithData.length === 0) return null
                        
                        return (
                          <div key={cat.id} className="border-b pb-4 last:border-0 last:pb-0">
                            <div className="flex items-center justify-between mb-3">
                              <div className="text-sm font-medium text-gray-900">{cat.name}</div>
                              <div className="text-xs text-gray-500">
                                Среднее: {avg.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-3">
                              {sortedMonths.map(monthKey => {
                                const amount = categoryExpenses[monthKey] || 0
                                if (amount === 0) return null
                                return (
                                  <div key={`${cat.id}-${monthKey}`} className="bg-gray-50 rounded-lg p-3 border border-gray-200 min-w-[140px]">
                                    <div className="text-sm font-semibold text-gray-700 mb-1">{monthLabelsMap[monthKey]}</div>
                                    <div className="text-base font-bold text-gray-900">
                                      {amount.toLocaleString('ru-RU')} ₽
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Бизнес расходы */}
                {businessCategories.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-sm font-semibold text-gray-700 mb-4">Бизнес расходы</h3>
                    <div className="space-y-4">
                      {businessCategories.map((cat) => {
                        const categoryExpenses = expensesByCategoryAndMonth[cat.name] || {}
                        const monthsWithData = sortedMonths.filter(monthKey => (categoryExpenses[monthKey] || 0) > 0)
                        const total = Object.values(categoryExpenses).reduce((sum, val) => sum + val, 0)
                        const avg = monthsWithData.length > 0 
                          ? total / monthsWithData.length 
                          : 0
                        
                        if (monthsWithData.length === 0) return null
                        
                        return (
                          <div key={cat.id} className="border-b pb-4 last:border-0 last:pb-0">
                            <div className="flex items-center justify-between mb-3">
                              <div className="text-sm font-medium text-gray-900">{cat.name}</div>
                              <div className="text-xs text-gray-500">
                                Среднее: {avg.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-3">
                              {sortedMonths.map(monthKey => {
                                const amount = categoryExpenses[monthKey] || 0
                                if (amount === 0) return null
                                return (
                                  <div key={`${cat.id}-${monthKey}`} className="bg-gray-50 rounded-lg p-3 border border-gray-200 min-w-[140px]">
                                    <div className="text-sm font-semibold text-gray-700 mb-1">{monthLabelsMap[monthKey]}</div>
                                    <div className="text-base font-bold text-gray-900">
                                      {amount.toLocaleString('ru-RU')} ₽
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Таблица транзакций */}
        <div className="bg-white shadow-sm rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Дата</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Сумма</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Категория</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Описание</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Тип</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Действия</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {/* Быстрое добавление - первая строка */}
              <tr className="bg-blue-50 border-t-2 border-blue-300">
                <td className="px-6 py-2">
                  <input
                    type="date"
                    value={quickAdd.date}
                    onChange={(e) => setQuickAdd({ ...quickAdd, date: e.target.value })}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </td>
                <td className="px-6 py-2">
                  <input
                    id="quick-add-amount"
                    type="number"
                    step="0.01"
                    value={quickAdd.amount}
                    onChange={(e) => setQuickAdd({ ...quickAdd, amount: e.target.value })}
                    placeholder="0.00"
                    className="w-24 px-2 py-1 text-sm text-right border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleQuickAdd()
                      }
                    }}
                  />
                </td>
                <td className="px-6 py-2">
                  <select
                    value={quickAdd.category}
                    onChange={(e) => setQuickAdd({ ...quickAdd, category: e.target.value })}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">—</option>
                    {categories
                      .filter(c => c.type === 'personal' || (quickAdd.type === 'expense' && c.type === 'business'))
                      .map(cat => (
                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                      ))}
                  </select>
                </td>
                <td className="px-6 py-2">
                  <input
                    type="text"
                    value={quickAdd.description}
                    onChange={(e) => setQuickAdd({ ...quickAdd, description: e.target.value })}
                    placeholder="Описание (необязательно)"
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleQuickAdd()
                      }
                    }}
                  />
                </td>
                <td className="px-6 py-2">
                  <select
                    value={quickAdd.type}
                    onChange={(e) => setQuickAdd({ ...quickAdd, type: e.target.value as 'income' | 'expense' })}
                    className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="expense">Расход</option>
                    <option value="income">Доход</option>
                  </select>
                </td>
                <td className="px-6 py-2 text-right">
                  <button
                    onClick={() => handleQuickAdd()}
                    disabled={quickAddLoading || !quickAdd.amount || parseFloat(quickAdd.amount) <= 0}
                    className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {quickAddLoading ? '...' : '✓'}
                  </button>
                </td>
              </tr>
              {[...filteredTransactions].sort((a, b) => {
                // Сначала сортируем по дате (убывание - новые сверху)
                const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime()
                if (dateDiff !== 0) return dateDiff
                // Если даты одинаковые, сортируем по ID (убывание) для новых транзакций сверху
                // ID содержит timestamp (t_1234567890), извлекаем числовую часть
                const aTimestamp = parseInt(a.id.replace('t_', '')) || 0
                const bTimestamp = parseInt(b.id.replace('t_', '')) || 0
                return bTimestamp - aTimestamp
              }).map((transaction) => (
                <TransactionRow
                  key={transaction.id}
                  transaction={transaction}
                  accounts={accounts}
                  categories={categories}
                  editingId={editingId}
                  setEditingId={setEditingId}
                  onUpdate={handleUpdate}
                  onDelete={handleDelete}
                />
              ))}
              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                    Нет транзакций. <Link href="/me/transactions/new" className="text-blue-600 hover:underline">Добавить первую транзакцию</Link>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // Компонент строки транзакции
  function TransactionRow({
    transaction,
    accounts,
    categories,
    editingId,
    setEditingId,
    onUpdate,
    onDelete,
  }: {
    transaction: Transaction
    accounts: Account[]
    categories: any[]
    editingId: string | null
    setEditingId: (id: string | null) => void
    onUpdate: (id: string, field: string, value: any) => void
    onDelete: (id: string) => void
  }) {
    const [editingField, setEditingField] = useState<string | null>(null)
    const [tempValue, setTempValue] = useState('')

    const handleStartEdit = (field: string, currentValue: any) => {
      setEditingId(transaction.id)
      setEditingField(field)
      setTempValue(currentValue?.toString() || '')
    }

    const handleSave = (field: string, directValue?: any) => {
      let value: any = directValue !== undefined ? directValue : tempValue
      if (field === 'amount') {
        value = parseFloat(value?.toString() || tempValue) || 0
      } else if (field === 'date') {
        value = directValue !== undefined ? directValue : tempValue
      }
      onUpdate(transaction.id, field, value)
      setEditingField(null)
      setEditingId(null)
    }

    const handleCancel = () => {
      setEditingField(null)
      setEditingId(null)
      setTempValue('')
    }

    const isEditing = editingId === transaction.id

    return (
      <tr className={isEditing ? 'bg-blue-50' : ''}>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          {editingField === 'date' ? (
            <input
              type="date"
              value={tempValue}
              onChange={(e) => setTempValue(e.target.value)}
              onBlur={() => handleSave('date')}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave('date')
                if (e.key === 'Escape') handleCancel()
              }}
              autoFocus
              className="w-full px-2 py-1 border border-blue-500 rounded text-sm"
            />
          ) : (
            <button
              onClick={() => handleStartEdit('date', transaction.date.split('T')[0])}
              className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded"
            >
              {formatDate(new Date(transaction.date))}
            </button>
          )}
        </td>
        <td className={`px-6 py-4 whitespace-nowrap text-left text-sm font-medium ${
          transaction.type === 'income' ? 'text-green-600' :
          transaction.type === 'expense' ? 'text-red-600' : 'text-gray-900'
        }`}>
          {editingField === 'amount' ? (
            <input
              type="number"
              step="0.01"
              value={tempValue}
              onChange={(e) => setTempValue(e.target.value)}
              onBlur={() => handleSave('amount')}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave('amount')
                if (e.key === 'Escape') handleCancel()
              }}
              autoFocus
              className="w-24 px-2 py-1 border border-blue-500 rounded text-sm text-right"
            />
          ) : (
            <button
              onClick={() => handleStartEdit('amount', transaction.amount)}
              className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded text-left"
            >
              {transaction.type === 'expense' ? '-' : '+'}
              {transaction.amount.toLocaleString('ru-RU')} {transaction.currency}
            </button>
          )}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          {editingField === 'category' ? (
            <select
              value={tempValue}
              onChange={(e) => {
                const newValue = e.target.value
                setTempValue(newValue)
                handleSave('category', newValue)
              }}
              onBlur={() => handleSave('category')}
              autoFocus
              className="w-full px-2 py-1 border border-blue-500 rounded text-sm"
            >
              <option value="">Без категории</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.name}>{cat.name}</option>
              ))}
            </select>
          ) : (
            <button
              onClick={() => handleStartEdit('category', transaction.category || '')}
              className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded"
            >
              {transaction.category || '—'}
            </button>
          )}
        </td>
        <td className="px-6 py-4 text-sm text-gray-900">
          {editingField === 'description' ? (
            <input
              type="text"
              value={tempValue}
              onChange={(e) => setTempValue(e.target.value)}
              onBlur={() => handleSave('description')}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave('description')
                if (e.key === 'Escape') handleCancel()
              }}
              autoFocus
              className="w-full px-2 py-1 border border-blue-500 rounded text-sm"
            />
          ) : (
            <button
              onClick={() => handleStartEdit('description', transaction.description || '')}
              className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded text-left w-full"
            >
              {transaction.description || '—'}
            </button>
          )}
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
            transaction.type === 'income' ? 'bg-green-100 text-green-800' :
            transaction.type === 'expense' ? 'bg-red-100 text-red-800' :
            'bg-blue-100 text-blue-800'
          }`}>
            {transaction.type === 'income' ? 'Доход' :
             transaction.type === 'expense' ? 'Расход' : 'Перевод'}
          </span>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
          <button
            onClick={() => onDelete(transaction.id)}
            className="text-red-600 hover:text-red-900 mr-3"
          >
            Удалить
          </button>
        </td>
      </tr>
    )
  }

  // Компонент строки счета для переиспользования
  function AccountRow({
    account,
    typeLabels,
    draggedAccount,
    dragOverId,
    onDragStart,
    onDragOver,
    onDragLeave,
    onDrop,
    onBalanceUpdate,
  }: {
    account: Account
    typeLabels: Record<string, string>
    draggedAccount: string | null
    dragOverId: string | null
    onDragStart: (e: React.DragEvent, accountId: string) => void
    onDragOver: (e: React.DragEvent, accountId: string) => void
    onDragLeave: (e: React.DragEvent) => void
    onDrop: (e: React.DragEvent, accountId: string) => void
    onBalanceUpdate: () => void
  }) {
    const [isEditingBalance, setIsEditingBalance] = useState(false)
    const [balanceValue, setBalanceValue] = useState(account.balance.toString())
    const [isSaving, setIsSaving] = useState(false)

    useEffect(() => {
      setBalanceValue(account.balance.toString())
    }, [account.balance])

    const handleBalanceClick = (e: React.MouseEvent) => {
      e.stopPropagation()
      setIsEditingBalance(true)
      // Фокус и выделение текста после небольшой задержки, чтобы состояние обновилось
      setTimeout(() => {
        const input = document.querySelector(`input[data-account-id="${account.id}"]`) as HTMLInputElement
        if (input) {
          input.focus({ preventScroll: true })
          input.select()
        }
      }, 0)
    }

    const handleBalanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setBalanceValue(e.target.value)
    }

    const saveBalance = async () => {
      const newBalance = parseFloat(balanceValue.replace(/\s/g, '').replace(',', '.'))
      if (isNaN(newBalance) || newBalance === account.balance) {
        setBalanceValue(account.balance.toString())
        setIsEditingBalance(false)
        return
      }

      setIsSaving(true)
      try {
        const res = await fetch(`/api/accounts/${account.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: account.name,
            type: account.type,
            currency: account.currency,
            balance: newBalance,
            notes: account.notes,
          }),
        })

        if (res.ok) {
          setIsEditingBalance(false)
          // Принудительно обновляем все данные после изменения баланса
          onBalanceUpdate() // Обновляем данные
          // Дополнительно обновляем через небольшую задержку для надежности
          setTimeout(() => {
            onBalanceUpdate()
          }, 500)
        } else {
          // В случае ошибки возвращаем старое значение
          setBalanceValue(account.balance.toString())
          setIsEditingBalance(false)
        }
      } catch (error) {
        console.error('Error updating balance:', error)
        setBalanceValue(account.balance.toString())
        setIsEditingBalance(false)
      } finally {
        setIsSaving(false)
      }
    }

    const handleBalanceKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        saveBalance()
      } else if (e.key === 'Escape') {
        setBalanceValue(account.balance.toString())
        setIsEditingBalance(false)
      }
    }

    const handleBalanceBlur = () => {
      saveBalance()
    }

    return (
      <tr
        draggable
        onDragStart={(e) => onDragStart(e, account.id)}
        onDragOver={(e) => onDragOver(e, account.id)}
        onDragLeave={onDragLeave}
        onDrop={(e) => onDrop(e, account.id)}
        className={`cursor-move transition-colors ${
          draggedAccount === account.id
            ? 'opacity-50 bg-blue-50'
            : dragOverId === account.id
            ? 'bg-blue-100'
            : 'hover:bg-gray-50'
        }`}
      >
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex items-center space-x-2">
            <svg
              className="w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 8h16M4 16h16"
              />
            </svg>
            <div className="text-sm font-medium text-gray-900">{account.name}</div>
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
            {typeLabels[account.type] || account.type}
          </span>
        </td>
        <td className="px-6 py-4">
          <div className="text-sm text-gray-600">
            {account.notes || (account.type === 'other' ? '—' : '')}
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-right">
          {isEditingBalance ? (
            <div className="flex items-center justify-end space-x-2">
              <input
                type="text"
                data-account-id={account.id}
                value={balanceValue}
                onChange={handleBalanceChange}
                onKeyDown={handleBalanceKeyDown}
                onBlur={handleBalanceBlur}
                autoFocus
                disabled={isSaving}
                className="text-sm font-medium text-gray-900 w-32 px-2 py-1 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                onClick={(e) => e.stopPropagation()}
                onFocus={(e) => e.target.select()}
              />
              <span className="text-sm text-gray-500">{account.currency}</span>
            </div>
          ) : (
            <div
              className="text-sm font-medium text-gray-900 cursor-pointer hover:text-blue-600 transition-colors"
              onClick={handleBalanceClick}
              title="Нажмите, чтобы изменить баланс"
            >
            {account.balance.toLocaleString('ru-RU')} {account.currency}
          </div>
          )}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
          <Link
            href={`/me/accounts/${account.id}/edit`}
            className="text-blue-600 hover:text-blue-900"
            onClick={(e) => e.stopPropagation()}
          >
            Редактировать
          </Link>
        </td>
      </tr>
    )
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Финансы</h1>
        <div className="flex space-x-2">
          <button
            onClick={async () => {
              console.log('🔄 Кнопка обновления нажата')
              setLoading(true)
              // Принудительно обновляем данные с новым timestamp
              const timestamp = Date.now()
              try {
                const [accountsRes, transactionsRes, dashboardRes, categoriesRes] = await Promise.all([
                  fetch(`/api/accounts?t=${timestamp}`, { cache: 'no-store' }).then(r => r.json()),
                  fetch(`/api/transactions?t=${timestamp}`, { cache: 'no-store' }).then(r => r.json()),
                  fetch(`/api/dashboard?t=${timestamp}&ipTaxReserve=${encodeURIComponent(ipTaxReserve)}`, { cache: 'no-store' }).then(r => r.json()),
                  fetch(`/api/categories?t=${timestamp}`, { cache: 'no-store' }).then(r => r.json()).catch(() => []),
                ])
                
                console.log('📊 Обновленные данные:', {
                  newMonthEndForecast: dashboardRes.metrics?.newMonthEndForecast,
                  estimatedTotalAccountsNow: dashboardRes.metrics?.estimatedTotalAccountsNow,
                  totalAccounts: dashboardRes.metrics?.totalAccounts,
                })
                
                await fetchData(true)
              } catch (error) {
                console.error('Ошибка при обновлении:', error)
              } finally {
                setLoading(false)
              }
            }}
            disabled={loading}
            className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Обновить данные"
          >
            {loading ? '⏳ Обновление...' : '🔄 Обновить'}
          </button>
          <Link
            href="/me/finance/expense-settings"
            className="px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-md hover:bg-gray-700"
          >
            Настройки расходов
          </Link>
          {activeTab === 'accounts' && (
            <Link
              href="/me/accounts/new"
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
            >
              + Новый счёт
            </Link>
          )}
          {activeTab === 'transactions' && (
            <Link
              href="/me/transactions/new"
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
            >
              + Новая транзакция
            </Link>
          )}
          {activeTab === 'goals' && (
            <Link
              href="/me/goals/new"
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
            >
              + Новая цель
            </Link>
          )}
        </div>
      </div>

      {/* Прогресс-бары лимитов по категориям расходов — под заголовком, над плашками */}
      <div className="mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {BUDGET_CATEGORIES.map(bc => {
            const spent = spentByBudgetCategory[bc.key] || 0
            const over = spent > bc.limit
            const pct = bc.limit > 0 ? Math.min(100, (spent / bc.limit) * 100) : 0
            return (
              <div
                key={bc.key}
                className={`rounded-xl p-4 border min-h-[88px] ${
                  over ? 'bg-red-50 border-red-300' : 'bg-white border-gray-200'
                } shadow-sm`}
              >
                <div className="flex justify-between items-baseline mb-2">
                  <span className={`text-base font-medium ${over ? 'text-red-800' : 'text-gray-700'}`}>
                    {bc.label}
                  </span>
                  <span className={`text-base tabular-nums ${over ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>
                    {spent.toLocaleString('ru-RU')} / {bc.limit.toLocaleString('ru-RU')} ₽
                  </span>
                </div>
                <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      over ? 'bg-red-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
                <div className="text-sm mt-1.5 font-medium">
                  {over ? (
                    <span className="text-red-600">
                      Перерасход {(spent - bc.limit).toLocaleString('ru-RU')} ₽
                    </span>
                  ) : (
                    <span className="text-green-600">
                      Осталось {(bc.limit - spent).toLocaleString('ru-RU')} ₽
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Панель ключевых показателей - фиксирована над вкладками */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Прогноз на конец месяца */}
        {newMonthEndForecast !== null && (
          <div className="bg-white rounded-lg p-4 border border-blue-300 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-blue-600 font-medium uppercase tracking-wide">Прогноз на конец месяца</div>
              {(() => {
                if (confirmedDayLabel === null || daysSinceConfirmed === null) {
                  // Капитал не подтвержден
                  return (
                    <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                      Капитал не подтверждён
                    </span>
                  )
                }

                // Основываемся только на label, который уже посчитал backend
                if (confirmedDayLabel === 'today') {
                  return (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                      Капитал подтверждён сегодня
                    </span>
                  )
                }
                if (confirmedDayLabel === 'yesterday') {
                  return (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                      Капитал подтверждён вчера
                    </span>
                  )
                }

                // Остальные случаи: N_days
                return (
                  <span className={`text-xs px-2 py-1 rounded ${
                    daysSinceConfirmed <= 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                  }`}>
                    Капитал подтверждён {daysSinceConfirmed} дней назад
                  </span>
                )
              })()}
            </div>
            <div className={`text-2xl font-bold mb-1 ${
              newMonthEndForecast >= 0 ? 'text-gray-900' : 'text-red-600'
            }`}>
              {newMonthEndForecast.toLocaleString('ru-RU')} ₽
            </div>
            <div className="text-xs text-gray-500 mb-2">
              Оценочный капитал − ожидаемые расходы + ожидаемые поступления
            </div>
            
            {/* Информация о капитале */}
            {estimatedTotalAccountsNow !== null && calculationDetails && (
              <div className="mb-3 pb-3 border-b border-gray-200 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600">Ручной капитал:</span>
                  <span className="font-mono">{calculationDetails.totalAccounts.toLocaleString('ru-RU')} ₽</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Оценочный капитал:</span>
                  <span className={`font-mono ${estimatedTotalAccountsNow !== calculationDetails.totalAccounts ? 'text-orange-600' : 'text-gray-900'}`}>
                    {estimatedTotalAccountsNow.toLocaleString('ru-RU')} ₽
                  </span>
                </div>
                {estimatedTotalAccountsNow !== calculationDetails.totalAccounts && (
                  <div className="flex justify-between text-orange-600">
                    <span>Разница:</span>
                    <span className="font-mono">
                      {(estimatedTotalAccountsNow - calculationDetails.totalAccounts).toLocaleString('ru-RU')} ₽
                    </span>
                  </div>
                )}
                {lastConfirmedTotalAccounts !== null && (
                  <div className="flex justify-between text-gray-500">
                    <span>Подтверждённый капитал:</span>
                    <span className="font-mono">{lastConfirmedTotalAccounts.toLocaleString('ru-RU')} ₽</span>
                  </div>
                )}
              </div>
            )}
            
            {/* Кнопка подтверждения капитала */}
            <div className="mb-3">
              <button
                onClick={async () => {
                  try {
                    const res = await fetch('/api/dashboard/confirm-capital', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ ipTaxReserve }),
                    })
                    if (res.ok) {
                      const data = await res.json()
                      console.debug('✅ /api/dashboard/confirm-capital response', data)
                      
                      // Мгновенно обновляем локальное состояние, чтобы UI сразу отразил новое подтверждение
                      if (typeof data.lastConfirmedTotalAccounts === 'number') {
                        setLastConfirmedTotalAccounts(data.lastConfirmedTotalAccounts)
                        setEstimatedTotalAccountsNow(data.lastConfirmedTotalAccounts)
                      }
                      if (typeof data.lastConfirmedTotalAccountsDate === 'string') {
                        setLastConfirmedTotalAccountsDate(data.lastConfirmedTotalAccountsDate)
                      }
                      setDaysSinceConfirmed(0)
                      setConfirmedDayLabel('today')
                      
                      // И затем принудительно перезагружаем все метрики с сервера
                      fetchData(true)
                    } else {
                      alert('Ошибка при подтверждении капитала')
                    }
                  } catch (error) {
                    console.error('Error confirming capital:', error)
                    alert('Ошибка при подтверждении капитала')
                  }
                }}
                className="w-full px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
              >
                <span>✅</span>
                <span>Подтвердить капитал</span>
              </button>
            </div>
            
            {/* Сравнение с началом месяца */}
            {(() => {
              // Используем баланс на начало текущего месяца (1-е число)
              const startBalance = balanceAtMonthStart
              return startBalance !== null ? (
                <div className="mb-3 pb-3 border-b border-gray-200">
                  <div className="text-xs text-gray-600 mb-1">Сравнение с началом месяца (1-е число):</div>
                  <div className="flex items-center space-x-2 mb-2">
                    {isEditingMonthStartBalance ? (
                      <>
                        <input
                          type="number"
                          value={tempMonthStartBalance}
                          onChange={(e) => setTempMonthStartBalance(e.target.value)}
                          className="text-xs px-2 py-1 border border-blue-500 rounded w-32"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              const newValue = parseFloat(tempMonthStartBalance.replace(/\s/g, '').replace(',', '.'))
                              if (!isNaN(newValue) && newValue > 0) {
                                // Получаем ID записи истории для текущего месяца
                                const today = new Date()
                                const currentYear = today.getFullYear()
                                const currentMonth = today.getMonth() + 1
                                
                                // Сначала получаем историю, чтобы найти ID записи
                                fetch('/api/history')
                                  .then(r => r.json())
                                  .then((history: any[]) => {
                                    const currentMonthHistory = history.find((h: any) => h.year === currentYear && h.month === currentMonth)
                                    if (currentMonthHistory && currentMonthHistory.id) {
                                      // Обновляем только поле totalAccounts через PUT endpoint
                                      return fetch(`/api/history/${currentMonthHistory.id}`, {
                                        method: 'PUT',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                          field: 'totalAccounts',
                                          value: newValue
                                        }),
                                      })
                                    } else {
                                      // Если записи нет, создаем новую через POST
                                      return fetch('/api/history', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                          year: currentYear,
                                          month: currentMonth,
                                          totalAccounts: newValue,
                                          cushionAmount: 0,
                                          goalsAmount: 0,
                                          agencyExpectedRevenue: 0,
                                          agencyActualRevenue: 0,
                                          agencyExpectedProfit: 0,
                                          agencyActualProfit: 0,
                                          impulseExpectedRevenue: 0,
                                          impulseActualRevenue: 0,
                                          impulseExpectedProfit: 0,
                                          impulseActualProfit: 0,
                                          totalExpectedProfit: 0,
                                          totalRevenue: 0,
                                        }),
                                      })
                                    }
                                  })
                                  .then((res) => {
                                    if (res.ok) {
                                      setBalanceAtMonthStart(newValue)
                                      setIsEditingMonthStartBalance(false)
                                      fetchData()
                                    } else {
                                      throw new Error('Failed to update')
                                    }
                                  })
                                  .catch((error) => {
                                    console.error('Error updating history:', error)
                                    alert('Ошибка при обновлении значения')
                                    setIsEditingMonthStartBalance(false)
                                  })
                              } else {
                                setIsEditingMonthStartBalance(false)
                              }
                            } else if (e.key === 'Escape') {
                              setIsEditingMonthStartBalance(false)
                            }
                          }}
                          onBlur={() => {
                            const newValue = parseFloat(tempMonthStartBalance.replace(/\s/g, '').replace(',', '.'))
                            if (!isNaN(newValue) && newValue > 0) {
                              const today = new Date()
                              const currentYear = today.getFullYear()
                              const currentMonth = today.getMonth() + 1
                              
                              // Получаем историю, чтобы найти ID записи
                              fetch('/api/history')
                                .then(r => r.json())
                                .then((history: any[]) => {
                                  const currentMonthHistory = history.find((h: any) => h.year === currentYear && h.month === currentMonth)
                                  if (currentMonthHistory && currentMonthHistory.id) {
                                    // Обновляем только поле totalAccounts
                                    return fetch(`/api/history/${currentMonthHistory.id}`, {
                                      method: 'PUT',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({
                                        field: 'totalAccounts',
                                        value: newValue
                                      }),
                                    })
                                  } else {
                                    // Если записи нет, создаем новую
                                    return fetch('/api/history', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({
                                        year: currentYear,
                                        month: currentMonth,
                                        totalAccounts: newValue,
                                        cushionAmount: 0,
                                        goalsAmount: 0,
                                        agencyExpectedRevenue: 0,
                                        agencyActualRevenue: 0,
                                        agencyExpectedProfit: 0,
                                        agencyActualProfit: 0,
                                        impulseExpectedRevenue: 0,
                                        impulseActualRevenue: 0,
                                        impulseExpectedProfit: 0,
                                        impulseActualProfit: 0,
                                        totalExpectedProfit: 0,
                                        totalRevenue: 0,
                                      }),
                                    })
                                  }
                                })
                                .then((res) => {
                                  if (res.ok) {
                                    setBalanceAtMonthStart(newValue)
                                    setIsEditingMonthStartBalance(false)
                                    fetchData()
                                  }
                                })
                                .catch((error) => {
                                  console.error('Error updating history:', error)
                                  setIsEditingMonthStartBalance(false)
                                })
                            } else {
                              setIsEditingMonthStartBalance(false)
                            }
                          }}
                        />
                        <span className="text-xs text-gray-500">₽</span>
                      </>
                    ) : (
                      <>
                        <div className="text-xs text-gray-500">
                          Капитал на 1-е число: <span className="font-mono">{startBalance.toLocaleString('ru-RU')} ₽</span>
                        </div>
                        <button
                          onClick={() => {
                            setTempMonthStartBalance(startBalance.toString())
                            setIsEditingMonthStartBalance(true)
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800 ml-2"
                          title="Изменить значение"
                        >
                          ✏️
                        </button>
                      </>
                    )}
                  </div>
                  {(() => {
                    const delta = newMonthEndForecast - startBalance
                    const isPositive = delta >= 0
                    return (
                      <div className="flex items-center space-x-2">
                        <span className={`text-sm font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                          {isPositive ? '↑' : '↓'} {Math.abs(delta).toLocaleString('ru-RU')} ₽
                        </span>
                        <span className="text-xs text-gray-500">
                          ({isPositive ? 'больше' : 'меньше'})
                        </span>
                      </div>
                    )
                  })()}
                </div>
              ) : null
            })()}
            
            {/* Детальный расчет - гармошка */}
            {calculationDetails && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <button
                  onClick={() => setShowCalculationDetails(!showCalculationDetails)}
                  className="w-full flex items-center justify-between text-xs text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <span className="font-medium">Подробный расчет</span>
                  <span className={`transform transition-transform ${showCalculationDetails ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                </button>
                {showCalculationDetails && (
                  <div className="mt-3 text-xs space-y-1 text-gray-600">
                    <div><strong>Расчет:</strong></div>
                    <div>1. Оценочный капитал: <span className="font-mono">{estimatedTotalAccountsNow !== null ? estimatedTotalAccountsNow.toLocaleString('ru-RU') : calculationDetails.totalAccounts.toLocaleString('ru-RU')} ₽</span></div>
                    <div>2. Неоплаченные разовые расходы: <span className="font-mono">{calculationDetails.oneTimeExpensesUnpaidTotal.toLocaleString('ru-RU')} ₽</span></div>
                    <div>3. Ежедневный лимит × остаток дней ({calculationDetails.dailyExpenseLimit.toLocaleString('ru-RU')} × {calculationDetails.daysRemaining}): <span className="font-mono">{(calculationDetails.dailyExpenseLimit * calculationDetails.daysRemaining).toLocaleString('ru-RU')} ₽</span></div>
                    <div>4. Налоги агентства: <span className="font-mono">{calculationDetails.taxAmount.toLocaleString('ru-RU')} ₽</span></div>
                    <div>5. Ожидаемые расходы (2 + 3 + 4): <span className="font-mono text-red-600">{(calculationDetails.oneTimeExpensesUnpaidTotal + (calculationDetails.dailyExpenseLimit * calculationDetails.daysRemaining) + calculationDetails.taxAmount).toLocaleString('ru-RU')} ₽</span></div>
                    <div>6. Неоплаченные проекты агентства: <span className="font-mono">{calculationDetails.unpaidAgencyProjects.toLocaleString('ru-RU')} ₽</span></div>
                    <div>7. Неоплаченные студенты импульса: <span className="font-mono">{calculationDetails.unpaidImpulseStudents.toLocaleString('ru-RU')} ₽</span></div>
                    <div>8. Ожидаемые поступления (6 + 7): <span className="font-mono text-green-600">{(calculationDetails.unpaidAgencyProjects + calculationDetails.unpaidImpulseStudents).toLocaleString('ru-RU')} ₽</span></div>
                    <div className="pt-2 border-t border-gray-200 font-medium">
                      Итого: {estimatedTotalAccountsNow !== null ? estimatedTotalAccountsNow.toLocaleString('ru-RU') : calculationDetails.totalAccounts.toLocaleString('ru-RU')} − {(calculationDetails.oneTimeExpensesUnpaidTotal + (calculationDetails.dailyExpenseLimit * calculationDetails.daysRemaining) + calculationDetails.taxAmount).toLocaleString('ru-RU')} + {(calculationDetails.unpaidAgencyProjects + calculationDetails.unpaidImpulseStudents).toLocaleString('ru-RU')} = <span className="font-bold">{newMonthEndForecast.toLocaleString('ru-RU')} ₽</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Доступно сейчас */}
        <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm h-full flex flex-col">
          <div className="text-xs text-gray-600 mb-1 font-medium uppercase tracking-wide">Доступно сейчас</div>
          <div className="text-2xl font-bold text-gray-900 mb-1">
            {availableNow.toLocaleString('ru-RU')} ₽
          </div>
          <div className="text-xs text-gray-500">Можно тратить</div>
        </div>

        {/* Общий капитал */}
        <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm h-full flex flex-col">
          <div className="text-xs text-gray-600 mb-1 font-medium uppercase tracking-wide">Общий капитал</div>
          <div className="text-2xl font-bold text-gray-900 mb-1">
            {totalCapital.toLocaleString('ru-RU')} ₽
          </div>
          <div className="text-xs text-gray-500">Все активы</div>
        </div>

        {/* Личные расходы */}
        <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm h-full flex flex-col">
          <div className="text-xs text-gray-600 mb-1 font-medium uppercase tracking-wide">Личные расходы</div>
          <div className="text-2xl font-bold text-gray-900 mb-1">
            {personalExpensesTotal.toLocaleString('ru-RU')} ₽
          </div>
          <div className="text-xs text-gray-500">
            За текущий месяц
            {(() => {
              const today = new Date()
              const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
              const dailyProjected = dailyExpenseLimit * daysInMonth
              const totalProjected = dailyProjected + oneTimeExpenses
              if (totalProjected > 0) {
                return (
                  <div className="mt-1 pt-1 border-t border-gray-100">
                    Прогноз: {totalProjected.toLocaleString('ru-RU')} ₽
                    <div className="text-xs text-gray-400 mt-0.5">
                      ({dailyExpenseLimit.toLocaleString('ru-RU')} ₽/день × {daysInMonth} дней + {oneTimeExpenses.toLocaleString('ru-RU')} ₽ фикс.)
                    </div>
                  </div>
                )
              }
              return null
            })()}
          </div>
        </div>
      </div>

      {/* Правила распределения — под плашками с деньгами */}
      <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl shadow-sm">
        <div className="text-sm font-semibold text-amber-900 mb-2">Правила распределения</div>
        <ul className="text-sm text-amber-800 space-y-1 list-disc list-inside">
          <li>10% от любого дохода — в подушку безопасности</li>
          <li>Всё, что осталось сверху после расходов: 70% на машину, 30% на путешествия</li>
        </ul>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('accounts')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'accounts'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Счета
          </button>
          <button
            onClick={() => setActiveTab('transactions')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'transactions'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Транзакции
          </button>
          <button
            onClick={() => setActiveTab('goals')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'goals'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Финансовые цели
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'history'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            История
          </button>
        </nav>
      </div>

      {/* Accounts Tab */}
      {activeTab === 'accounts' && (
        <div>

          {/* Блок 1: Доступные деньги (ИП) */}
          <div className="mb-6 bg-white rounded-xl shadow-sm border-2 border-green-200 overflow-hidden">
            <div className="bg-green-50 px-6 py-4 border-b border-green-200">
              <div className="flex items-center space-x-2">
                <span className="text-xl">🟢</span>
                <h2 className="text-lg font-semibold text-gray-900">Доступные деньги</h2>
                <span className="text-sm text-gray-600">({availableNow.toLocaleString('ru-RU')} ₽)</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">Карты, наличные, операционные счета — можно тратить</p>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <span className="text-sm text-gray-600">ИП, из них на налоги:</span>
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={ipTaxReserveInput}
                  onChange={(e) => {
                    const v = e.target.value
                    setIpTaxReserveInput(v)
                    // Сохраняем сразу, чтобы не сбрасывалось при смене месяца или перезагрузке
                    if (v === '' || isNaN(parseFloat(v))) saveIpTaxReserve('')
                    else saveIpTaxReserve(v)
                  }}
                  onBlur={() => {
                    const n = parseFloat(ipTaxReserveInput)
                    if (ipTaxReserveInput === '' || isNaN(n)) saveIpTaxReserve('')
                    else if (n >= 0) saveIpTaxReserve(String(n))
                  }}
                  className="w-28 px-2 py-1 text-sm border border-green-300 rounded focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="0"
                />
                <span className="text-sm text-gray-500">₽</span>
                {formatIpTaxReserveUpdatedAt(ipTaxReserveUpdatedAt) && (
                  <span className="text-xs text-gray-500">
                    обновлено в последний раз {formatIpTaxReserveUpdatedAt(ipTaxReserveUpdatedAt)}
                  </span>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Название</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Тип</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Комментарий</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Баланс</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Действия</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {availableAccounts.map((account) => (
                    <AccountRow
                      key={account.id}
                      account={account}
                      typeLabels={typeLabels}
                      draggedAccount={draggedAccount}
                      dragOverId={dragOverId}
                      onDragStart={handleDragStart}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onBalanceUpdate={fetchData}
                    />
                  ))}
                  {availableAccounts.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                        Нет доступных счетов
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Блок 2: Замороженные активы */}
          {frozenAccounts.length > 0 && (
            <div className="mb-6 bg-white rounded-xl shadow-sm border-2 border-gray-300 overflow-hidden">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-300">
                <div className="flex items-center space-x-2">
                  <span className="text-xl">🧊</span>
                  <h2 className="text-lg font-semibold text-gray-900">Замороженные активы</h2>
                  <span className="text-sm text-gray-600">({frozenAmount.toLocaleString('ru-RU')} ₽)</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">Недоступно для трат — залоги, ценности</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Название</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Тип</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Баланс</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {frozenAccounts.map((account) => (
                      <AccountRow
                        key={account.id}
                        account={account}
                        typeLabels={typeLabels}
                        draggedAccount={draggedAccount}
                        dragOverId={dragOverId}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onBalanceUpdate={fetchData}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Блок 3: Резервы и цели */}
          {reserveAccounts.length > 0 && (
            <div className="mb-6 bg-white rounded-xl shadow-sm border-2 border-blue-200 overflow-hidden">
              <div className="bg-blue-50 px-6 py-4 border-b border-blue-200">
                <div className="flex items-center space-x-2">
                  <span className="text-xl">🎯</span>
                  <h2 className="text-lg font-semibold text-gray-900">Резервы и цели</h2>
                  <span className="text-sm text-gray-600">({reserveAmount.toLocaleString('ru-RU')} ₽)</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">Подушка безопасности, финансовые цели</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Название</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Тип</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Баланс</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {reserveAccounts.map((account) => (
                      <AccountRow
                        key={account.id}
                        account={account}
                        typeLabels={typeLabels}
                        draggedAccount={draggedAccount}
                        dragOverId={dragOverId}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onBalanceUpdate={fetchData}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Transactions Tab */}
      {activeTab === 'transactions' && (
        <TransactionsTab 
          transactions={transactions}
          accounts={accounts}
          onUpdate={fetchData}
          onTransactionAdded={(t) => setTransactions(prev => [t, ...prev])}
        />
      )}

      {/* Goals Tab */}
      {activeTab === 'goals' && (
        <div>
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Финансовые цели</h2>
            <p className="text-sm text-gray-600 mt-1">Отслеживание прогресса по финансовым целям</p>
          </div>

          <div className="space-y-4">
            {goals.map((goal) => {
              const currentAmount = goal.linkedAccountBalance !== null 
                ? goal.linkedAccountBalance 
                : goal.currentAmount || 0
              const progress = goal.targetAmount > 0 ? (currentAmount / goal.targetAmount) * 100 : 0
              
              return (
                <div key={goal.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h3 className="text-base font-semibold text-gray-900 mb-1">{goal.name}</h3>
                      {goal.linkedAccountName && (
                        <p className="text-sm text-gray-500">
                          Привязан к счёту: {goal.linkedAccountName}
                        </p>
                      )}
                    </div>
                    <Link
                      href={`/me/goals/${goal.id}/edit`}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      Редактировать
                    </Link>
                  </div>
                  <div className="mb-2">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Прогресс</span>
                      <span className="font-medium text-gray-900">
                        {currentAmount.toLocaleString('ru-RU')} / {goal.targetAmount.toLocaleString('ru-RU')} ₽
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-blue-600 h-3 rounded-full transition-all"
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      {progress.toFixed(1)}% выполнено
                    </div>
                  </div>
                  {goal.notes && (
                    <p className="text-sm text-gray-600 mt-2">{goal.notes}</p>
                  )}
                </div>
              )
            })}
            {goals.length === 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
                <p className="text-gray-500 mb-4">Нет финансовых целей</p>
                <Link
                  href="/me/goals/new"
                  className="inline-block px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
                >
                  Создать первую цель
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div>
          <HistoryTab />
        </div>
      )}
    </div>
  )
}

// Компонент редактируемой ячейки
function EditableCell({
  value,
  recordId,
  field,
  onUpdate,
  className = '',
}: {
  value: number
  recordId: string
  field: string
  onUpdate: () => void
  className?: string
}) {
  const [editing, setEditing] = useState(false)
  const [tempValue, setTempValue] = useState(value.toString())
  const [savedFeedback, setSavedFeedback] = useState(false)

  useEffect(() => {
    if (!editing) setTempValue(value.toString())
  }, [value, editing])

  useEffect(() => {
    if (!savedFeedback) return
    const t = setTimeout(() => setSavedFeedback(false), 1500)
    return () => clearTimeout(t)
  }, [savedFeedback])

  const handleSubmit = async () => {
    const numValue = parseFloat(tempValue.replace(/\s/g, '').replace(',', '.')) || 0
    
    try {
      const res = await fetch(`/api/history/${recordId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field, value: numValue })
      })

      if (res.ok) {
        setEditing(false)
        setSavedFeedback(true)
        onUpdate()
      } else {
        alert('Ошибка при сохранении')
        setTempValue(value.toString())
        setEditing(false)
      }
    } catch (error) {
      console.error('Error updating:', error)
      alert('Ошибка при сохранении')
      setTempValue(value.toString())
      setEditing(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit()
    } else if (e.key === 'Escape') {
      setTempValue(value.toString())
      setEditing(false)
    }
  }

  if (editing) {
    return (
      <input
        type="text"
        value={tempValue}
        onChange={(e) => setTempValue(e.target.value)}
        onBlur={handleSubmit}
        onKeyDown={handleKeyDown}
        autoFocus
        className={`w-32 px-2 py-1 border border-blue-500 rounded text-sm text-right ${className}`}
      />
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className={`cursor-pointer hover:bg-gray-100 px-2 py-1 rounded text-right ${className}`}
      title="Нажмите для редактирования"
    >
      {savedFeedback ? (
        <span className="text-green-600 text-xs font-medium">✓ Сохранено</span>
      ) : (
        <>{value.toLocaleString('ru-RU')} ₽</>
      )}
    </button>
  )
}

// Компонент истории (вынесен из отдельной страницы)
function HistoryTab() {
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [addingMonth, setAddingMonth] = useState(false)
  const [newMonthYear, setNewMonthYear] = useState(new Date().getFullYear())
  const [newMonthMonth, setNewMonthMonth] = useState(new Date().getMonth() + 1)

  useEffect(() => {
    fetchHistory()
    autoAddMissingMonths()
  }, [])

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/history', { cache: 'no-store' })
      const data = await res.json()
      setHistory(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error fetching history:', error)
    } finally {
      setLoading(false)
    }
  }

  const autoAddMissingMonths = async () => {
    try {
      const res = await fetch('/api/history', { cache: 'no-store' })
      const currentHistory = await res.json()
      const historyArray = Array.isArray(currentHistory) ? currentHistory : []

      // Добавляем только текущий месяц, если его ещё нет (наступил март — появится март)
      const now = new Date()
      const currentYear = now.getFullYear()
      const currentMonth = now.getMonth() + 1
      const exists = historyArray.some((h: any) => h.year === currentYear && h.month === currentMonth)
      if (!exists) {
        await fetch('/api/history/save-month', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ year: currentYear, month: currentMonth })
        })
        await fetchHistory()
      }
    } catch (error) {
      console.error('Error auto-adding months:', error)
    }
  }

  const handleAddMonth = async () => {
    if (!newMonthYear || !newMonthMonth) return

    setAddingMonth(true)
    try {
      const res = await fetch('/api/history/save-month', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: newMonthYear, month: newMonthMonth })
      })

      if (res.ok) {
        await fetchHistory()
        setNewMonthYear(new Date().getFullYear())
        setNewMonthMonth(new Date().getMonth() + 1)
      } else {
        alert('Ошибка при добавлении месяца')
      }
    } catch (error) {
      console.error('Error adding month:', error)
      alert('Ошибка при добавлении месяца')
    } finally {
      setAddingMonth(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Загрузка...</div>
      </div>
    )
  }

  const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
  const today = new Date()
  const isFirstOfMonth = today.getDate() === 1
  const prevMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const prevMonthName = monthNames[prevMonthDate.getMonth()]
  const prevMonthYear = prevMonthDate.getFullYear()

  const getPrevMonthRecord = (record: any) => {
    const prevMonth = record.month === 1 ? 12 : record.month - 1
    const prevYear = record.month === 1 ? record.year - 1 : record.year
    return history.find((h: any) => h.year === prevYear && h.month === prevMonth)
  }

  const groupedByYear = history.reduce((acc, record) => {
    if (!acc[record.year]) {
      acc[record.year] = []
    }
    acc[record.year].push(record)
    return acc
  }, {} as Record<number, any[]>)

  const years = Object.keys(groupedByYear).map(Number).sort((a, b) => b - a)
  const currentYear = new Date().getFullYear()
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i)

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">История по месяцам</h2>
        <div className="flex space-x-3">
          <div className="flex items-center space-x-2 border border-gray-300 rounded-md px-3 py-2">
            <select
              value={newMonthYear}
              onChange={(e) => setNewMonthYear(Number(e.target.value))}
              className="px-2 py-1 border border-gray-300 rounded text-sm"
            >
              {yearOptions.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            <select
              value={newMonthMonth}
              onChange={(e) => setNewMonthMonth(Number(e.target.value))}
              className="px-2 py-1 border border-gray-300 rounded text-sm"
            >
              {monthNames.map((name, index) => (
                <option key={index + 1} value={index + 1}>{name}</option>
              ))}
            </select>
            <button
              onClick={handleAddMonth}
              disabled={addingMonth}
              className="px-3 py-1 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {addingMonth ? 'Добавление...' : 'Добавить месяц'}
            </button>
          </div>
          <button
            onClick={async () => {
              await fetch('/api/history/save-current', { method: 'POST' })
              fetchHistory()
            }}
            className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700"
          >
            Сохранить текущий месяц
          </button>
        </div>
      </div>

      {isFirstOfMonth && (
        <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-amber-800">
          <span className="text-amber-600" aria-hidden>⚠</span>
          <span className="font-medium">
            Сегодня 1-е число — не забудьте обновить показатели за {prevMonthName} {prevMonthYear}.
          </span>
        </div>
      )}

      {years.map((year) => {
        const yearRecords = groupedByYear[year].sort((a: any, b: any) => b.month - a.month)
        const yearCapitalDynamics = yearRecords.reduce((sum: number, record: any) => {
          const prev = getPrevMonthRecord(record)
          if (!prev) return sum
          return sum + ((record.totalAccounts || 0) - (prev.totalAccounts || 0))
        }, 0)
        const yearDynamicsPositive = yearCapitalDynamics >= 0
        return (
          <div key={year} className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-3 flex-wrap">
              <span>{year} год</span>
              <span className={`text-sm font-normal ${yearDynamicsPositive ? 'text-green-600' : 'text-red-600'}`}>
                Динамика за год: {yearDynamicsPositive ? '+' : ''}{yearCapitalDynamics.toLocaleString('ru-RU')} ₽
              </span>
            </h3>
            
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Месяц</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Всего на счетах</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Динамика капитала</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Общая выручка</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Прибыль</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Выручка агентства</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Прибыль агентства</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Выручка Импульс</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Прибыль Импульс</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {yearRecords.map((record: any) => (
                    <tr key={record.id}>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {monthNames[record.month - 1]}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                        <EditableCell
                          value={record.totalAccounts}
                          recordId={record.id}
                          field="totalAccounts"
                          onUpdate={fetchHistory}
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                        {(() => {
                          const prev = getPrevMonthRecord(record)
                          if (!prev) return <span className="text-gray-400 font-bold">—</span>
                          const diff = (record.totalAccounts || 0) - (prev.totalAccounts || 0)
                          const isPositive = diff >= 0
                          return (
                            <span className={`font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                              {isPositive ? '+' : ''}{(diff).toLocaleString('ru-RU')} ₽
                            </span>
                          )
                        })()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-gray-900">
                        <EditableCell
                          value={record.totalRevenue || 0}
                          recordId={record.id}
                          field="totalRevenue"
                          onUpdate={fetchHistory}
                        />
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-bold ${(record.agencyActualProfit + record.impulseActualProfit) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {(record.agencyActualProfit + record.impulseActualProfit).toLocaleString('ru-RU')} ₽
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                        <EditableCell
                          value={record.agencyActualRevenue}
                          recordId={record.id}
                          field="agencyActualRevenue"
                          onUpdate={fetchHistory}
                        />
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${record.agencyActualProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        <EditableCell
                          value={record.agencyActualProfit}
                          recordId={record.id}
                          field="agencyActualProfit"
                          onUpdate={fetchHistory}
                          className={record.agencyActualProfit >= 0 ? 'text-green-600' : 'text-red-600'}
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                        <EditableCell
                          value={record.impulseActualRevenue}
                          recordId={record.id}
                          field="impulseActualRevenue"
                          onUpdate={fetchHistory}
                        />
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${record.impulseActualProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        <EditableCell
                          value={record.impulseActualProfit}
                          recordId={record.id}
                          field="impulseActualProfit"
                          onUpdate={fetchHistory}
                          className={record.impulseActualProfit >= 0 ? 'text-green-600' : 'text-red-600'}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}

      {history.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-500 mb-4">Нет данных истории.</div>
          <button
            onClick={async () => {
              await fetch('/api/history/save-current', { method: 'POST' })
              fetchHistory()
            }}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
          >
            Сохранить текущий месяц
          </button>
        </div>
      )}
    </div>
  )
}
