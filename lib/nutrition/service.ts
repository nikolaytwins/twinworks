import { prisma } from '@/lib/prisma'

export interface NutritionSummary {
  dateKey: string
  proteinTotal: number
  proteinTarget: number
  remaining: number
  percent: number
  logs: {
    id: string
    createdAt: string
    rawText: string
    protein: number
  }[]
}

function getTimezoneFromSettingsRow(row: { timezone?: string | null } | null): string {
  if (!row || !row.timezone) return 'Europe/Brussels'
  return row.timezone
}

export async function getTimezone(): Promise<string> {
  try {
    const settings = await prisma.nutritionSettings.findFirst()
    return getTimezoneFromSettingsRow(settings)
  } catch {
    return 'Europe/Brussels'
  }
}

export function getDateKeyForNow(tz?: string): string {
  const timeZone = tz || 'Europe/Brussels'
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  // en-CA gives YYYY-MM-DD
  return formatter.format(new Date())
}

export function getDateKeyForDate(date: Date, tz?: string): string {
  const timeZone = tz || 'Europe/Brussels'
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatter.format(date)
}

async function getOrCreateSettings() {
  let settings = await prisma.nutritionSettings.findFirst()
  if (!settings) {
    settings = await prisma.nutritionSettings.create({
      data: {
        id: 'nutrition_settings_default',
        telegramChatId: null,
        timezone: 'Europe/Brussels',
        proteinTargetDefault: 140,
      },
    })
  }
  return settings
}

export async function addProteinLogFromTelegram(opts: {
  rawText: string
  protein: number
  telegramUpdateId?: string | null
}): Promise<NutritionSummary> {
  const { rawText, protein, telegramUpdateId } = opts
  const settings = await getOrCreateSettings()
  const tz = getTimezoneFromSettingsRow(settings)
  const dateKey = getDateKeyForNow(tz)

  // защита от дублей по telegramUpdateId
  if (telegramUpdateId) {
    const existing = await prisma.nutritionFoodLog.findUnique({
      where: { telegramUpdateId },
    })
    if (existing) {
      // уже есть — возвращаем текущий summary без дублирования
      return await getSummaryForDate(dateKey, settings)
    }
  }

  await prisma.nutritionFoodLog.create({
    data: {
      id: `food_${Date.now()}`,
      dateKey,
      rawText,
      parsedJson: null,
      protein,
      fat: 0,
      carbs: 0,
      kcal: 0,
      confidence: null,
      source: 'manual_protein_only',
      telegramUpdateId: telegramUpdateId || null,
    },
  })

  await recalcDailyNutrition(dateKey, settings)
  return await getSummaryForDate(dateKey, settings)
}

export async function undoLastLogForToday(): Promise<NutritionSummary> {
  const settings = await getOrCreateSettings()
  const tz = getTimezoneFromSettingsRow(settings)
  const dateKey = getDateKeyForNow(tz)

  const last = await prisma.nutritionFoodLog.findFirst({
    where: { dateKey },
    orderBy: { createdAt: 'desc' },
  })

  if (last) {
    await prisma.nutritionFoodLog.delete({ where: { id: last.id } })
    await recalcDailyNutrition(dateKey, settings)
  }

  return await getSummaryForDate(dateKey, settings)
}

export async function getTodaySummary(): Promise<NutritionSummary> {
  const settings = await getOrCreateSettings()
  const tz = getTimezoneFromSettingsRow(settings)
  const dateKey = getDateKeyForNow(tz)
  return await getSummaryForDate(dateKey, settings)
}

export async function getLogsForDate(dateKey: string): Promise<NutritionSummary['logs']> {
  const rows = await prisma.nutritionFoodLog.findMany({
    where: { dateKey },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  return rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt.toISOString(),
    rawText: r.rawText,
    protein: Number(r.protein || 0),
  }))
}

async function recalcDailyNutrition(
  dateKey: string,
  settings: { proteinTargetDefault: number }
) {
  const totals = await prisma.nutritionFoodLog.aggregate({
    where: { dateKey },
    _sum: {
      protein: true,
      fat: true,
      carbs: true,
      kcal: true,
    },
  })

  const proteinTotal = totals._sum.protein || 0
  const fatTotal = totals._sum.fat || 0
  const carbsTotal = totals._sum.carbs || 0
  const kcalTotal = totals._sum.kcal || 0
  const proteinTargetDefault = settings?.proteinTargetDefault ?? 140

  const existing = await prisma.dailyNutrition.findUnique({
    where: { dateKey },
  })

  if (existing) {
    await prisma.dailyNutrition.update({
      where: { id: existing.id },
      data: {
        proteinTotal,
        fatTotal,
        carbsTotal,
        kcalTotal,
      },
    })
  } else {
    await prisma.dailyNutrition.create({
      data: {
        id: `daily_${dateKey}`,
        dateKey,
        proteinTotal,
        fatTotal,
        carbsTotal,
        kcalTotal,
        proteinTarget: proteinTargetDefault,
      },
    })
  }
}

async function getSummaryForDate(
  dateKey: string,
  settingsOpt?: { proteinTargetDefault: number }
): Promise<NutritionSummary> {
  const settings = settingsOpt || (await getOrCreateSettings())
  const proteinTargetDefault = settings?.proteinTargetDefault ?? 140

  const daily = await prisma.dailyNutrition.findUnique({
    where: { dateKey },
  })

  const proteinTarget = daily?.proteinTarget ?? proteinTargetDefault
  const proteinTotal = daily?.proteinTotal ?? 0
  const remaining = Math.max(0, proteinTarget - proteinTotal)
  const percent = proteinTarget > 0 ? Math.min(100, (proteinTotal / proteinTarget) * 100) : 0

  const logsRows = await prisma.nutritionFoodLog.findMany({
    where: { dateKey },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  const logs = logsRows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt.toISOString(),
    rawText: r.rawText,
    protein: Number(r.protein || 0),
  }))

  return {
    dateKey,
    proteinTotal,
    proteinTarget,
    remaining,
    percent,
    logs,
  }
}
