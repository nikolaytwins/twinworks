import { NextRequest, NextResponse } from 'next/server'
import { addProteinLogFromTelegram } from '@/lib/nutrition/service'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(request: NextRequest) {
  if (process.env.NUTRITION_ENABLED !== 'true') {
    return NextResponse.json({ error: 'nutrition disabled' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const rawText: string = body.rawText
    const protein: number = Number(body.protein)
    const telegramUpdateId: string | undefined = body.telegramUpdateId

    if (!rawText || !Number.isFinite(protein) || protein <= 0) {
      return NextResponse.json({ error: 'rawText and positive protein are required' }, { status: 400 })
    }

    const summary = addProteinLogFromTelegram({ rawText, protein, telegramUpdateId })
    return NextResponse.json({ success: true, summary })
  } catch (error) {
    console.error('Error in POST /api/nutrition/log:', error)
    return NextResponse.json({ error: 'Failed to add nutrition log' }, { status: 500 })
  }
}

