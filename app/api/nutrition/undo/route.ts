import { NextRequest, NextResponse } from 'next/server'
import { undoLastLogForToday } from '@/lib/nutrition/service'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(_request: NextRequest) {
  if (process.env.NUTRITION_ENABLED !== 'true') {
    return NextResponse.json({ error: 'nutrition disabled' }, { status: 403 })
  }

  try {
    const summary = await undoLastLogForToday()
    return NextResponse.json({ success: true, summary })
  } catch (error) {
    console.error('Error in POST /api/nutrition/undo:', error)
    return NextResponse.json({ error: 'Failed to undo nutrition log' }, { status: 500 })
  }
}

