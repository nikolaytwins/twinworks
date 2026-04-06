// Утилиты для работы с датами и периодами

export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

export function getWeekKey(date: Date): string {
  const year = date.getFullYear()
  const weekNumber = getWeekNumber(date)
  return `${year}-W${String(weekNumber).padStart(2, '0')}`
}

export function getMonthKey(date: Date): string {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  return `${year}-${String(month).padStart(2, '0')}`
}

export function getQuarterKey(date: Date): string {
  const year = date.getFullYear()
  const quarter = Math.floor(date.getMonth() / 3) + 1
  return `${year}-Q${quarter}`
}

export function getTodayDateString(): string {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getDateString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Получить все недели месяца
export function getWeeksInMonth(year: number, month: number): string[] {
  const weeks: string[] = []
  const firstDay = new Date(year, month - 1, 1)
  const lastDay = new Date(year, month, 0)
  
  // Находим первую неделю месяца
  let currentDate = new Date(firstDay)
  const firstWeek = getWeekKey(currentDate)
  weeks.push(firstWeek)
  
  // Идем по неделям до конца месяца
  while (currentDate <= lastDay) {
    const weekKey = getWeekKey(currentDate)
    if (!weeks.includes(weekKey)) {
      weeks.push(weekKey)
    }
    currentDate.setDate(currentDate.getDate() + 7)
  }
  
  return weeks
}

// Получить все даты месяца
export function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = []
  const firstDay = new Date(year, month - 1, 1)
  const lastDay = new Date(year, month, 0)
  
  for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d))
  }
  
  return days
}

// Получить день недели (1 = понедельник, 7 = воскресенье)
export function getDayOfWeek(date: Date): number {
  const day = date.getDay()
  return day === 0 ? 7 : day
}

// Индекс дня в неделе для слотов (0 = понедельник, 6 = воскресенье)
export function getDayIndex(date: Date): number {
  const day = date.getDay()
  return day === 0 ? 6 : day - 1
}

/** 42 даты для heatmap-календаря месяца: 6 недель × 7 дней, начиная с понедельника недели, в которую попадает 1-е число */
export function getCalendarGridDates(year: number, month: number): Date[] {
  const first = new Date(year, month - 1, 1)
  const dow = getDayOfWeek(first)
  const mondayOffset = dow - 1
  const start = new Date(year, month - 1, 1 - mondayOffset)
  const out: Date[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    out.push(d)
  }
  return out
}

/** Количество дней в году Фев–Дек (январь не участвует). 334 или 335 в високосный */
export function getDaysInYearFebDec(year: number): number {
  let days = 0
  for (let m = 2; m <= 12; m++) {
    days += new Date(year, m, 0).getDate()
  }
  return days
}

/** Все даты периода 1 фев — 31 дек выбранного года (334 или 335 дней) */
export function getYearFebDecDates(year: number): Date[] {
  const out: Date[] = []
  for (let m = 2; m <= 12; m++) {
    const lastDay = new Date(year, m, 0).getDate()
    for (let d = 1; d <= lastDay; d++) {
      out.push(new Date(year, m - 1, d))
    }
  }
  return out
}

/** Границы месяцев для подписей/разделителей: startIndex — индекс первого дня месяца в массиве из getYearFebDecDates */
export function getYearFebDecMonthBoundaries(year: number): { monthIndex: number; label: string; startIndex: number }[] {
  const labels = ['Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']
  const out: { monthIndex: number; label: string; startIndex: number }[] = []
  let idx = 0
  for (let m = 2; m <= 12; m++) {
    out.push({ monthIndex: m, label: labels[m - 2], startIndex: idx })
    idx += new Date(year, m, 0).getDate()
  }
  return out
}

// Получить название недели по датам (например, "1-7 января")
export function getWeekLabel(weekKey: string): string {
  // weekKey формат: YYYY-WNN
  const [year, weekNum] = weekKey.split('-W')
  const yearNum = parseInt(year)
  const weekNumber = parseInt(weekNum)
  
  // Используем ISO недели - первая неделя года содержит 4 января
  // Находим 4 января нужного года
  const jan4 = new Date(yearNum, 0, 4)
  const jan4Day = jan4.getDay() || 7 // 1 = понедельник, 7 = воскресенье
  
  // Находим понедельник недели, содержащей 4 января
  const jan4Monday = new Date(jan4)
  jan4Monday.setDate(jan4.getDate() - (jan4Day - 1))
  
  // Находим понедельник нужной недели
  const firstDay = new Date(jan4Monday)
  firstDay.setDate(jan4Monday.getDate() + (weekNumber - 1) * 7)
  
  // Находим воскресенье (последний день недели)
  const lastDay = new Date(firstDay)
  lastDay.setDate(firstDay.getDate() + 6)
  
  const monthNames = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
  
  if (firstDay.getMonth() === lastDay.getMonth()) {
    // Одна неделя в одном месяце
    return `${firstDay.getDate()}-${lastDay.getDate()} ${monthNames[firstDay.getMonth()]}`
  } else {
    // Неделя на границе месяцев
    return `${firstDay.getDate()} ${monthNames[firstDay.getMonth()]} - ${lastDay.getDate()} ${monthNames[lastDay.getMonth()]}`
  }
}
