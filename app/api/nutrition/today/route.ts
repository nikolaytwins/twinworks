import { NextRequest, NextResponse } from 'next/server'
import { getTodaySummary } from '@/lib/nutrition/service'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(_req: NextRequest) {
  if (process.env.NUTRITION_ENABLED !== 'true') {
    return NextResponse.json({ error: 'nutrition disabled' }, { status: 403 })
  }

  try {
    const summary = await getTodaySummary()
    return NextResponse.json(summary)
  } catch (error) {
    console.error('Error in GET /api/nutrition/today:', error)
    return NextResponse.json({ error: 'Failed to load nutrition summary' }, { status: 500 })
  }
}

