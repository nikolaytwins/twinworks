import { NextRequest, NextResponse } from 'next/server'
import { getLogsForDate, getDateKeyForNow, getTimezone } from '@/lib/nutrition/service'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  if (process.env.NUTRITION_ENABLED !== 'true') {
    return NextResponse.json({ error: 'nutrition disabled' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const tz = await getTimezone()
    const dateKey = searchParams.get('date') || getDateKeyForNow(tz)
    const logs = await getLogsForDate(dateKey)
    return NextResponse.json({ dateKey, logs })
  } catch (error) {
    console.error('Error in GET /api/nutrition/logs:', error)
    return NextResponse.json({ error: 'Failed to load nutrition logs' }, { status: 500 })
  }
}

