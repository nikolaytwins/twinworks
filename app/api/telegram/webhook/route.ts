import { NextRequest, NextResponse } from 'next/server'
import { addProteinLogFromTelegram, getTodaySummary } from '@/lib/nutrition/service'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const TELEGRAM_API_BASE = 'https://api.telegram.org'

async function sendTelegramMessage(chatId: number | string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    console.warn('TELEGRAM_BOT_TOKEN is not set, cannot send message')
    return
  }
  try {
    await fetch(`${TELEGRAM_API_BASE}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
      }),
    })
  } catch (err) {
    console.error('Error sending Telegram message:', err)
  }
}

function parseSimpleProteinCommand(text: string): number | null {
  const match = text.match(/protein\s+(\d+(\.\d+)?)/i)
  if (!match) return null
  const value = Number(match[1])
  return Number.isFinite(value) && value > 0 ? value : null
}

export async function POST(request: NextRequest) {
  const enabled = process.env.NUTRITION_ENABLED === 'true'

  let update: any
  try {
    update = await request.json()
  } catch (error) {
    console.error('Invalid Telegram update payload:', error)
    return NextResponse.json({ ok: false })
  }

  const message = update?.message || update?.edited_message
  const chatId = message?.chat?.id
  const text: string | undefined = message?.text
  const updateId: string | undefined = typeof update?.update_id !== 'undefined'
    ? String(update.update_id)
    : undefined

  if (!chatId || !text) {
    // Ничего полезного
    return NextResponse.json({ ok: true })
  }

  if (!enabled) {
    await sendTelegramMessage(chatId, 'Модуль питания сейчас отключён (NUTRITION_ENABLED=false).')
    return NextResponse.json({ ok: true })
  }

  // Команда /today
  if (text.trim().toLowerCase().startsWith('/today')) {
    try {
      const summary = await getTodaySummary()
      const msg = `Сегодня: ${summary.proteinTotal.toFixed(0)}/${summary.proteinTarget.toFixed(
        0
      )} г белка\nОсталось: ${summary.remaining.toFixed(0)} г.`
      await sendTelegramMessage(chatId, msg)
    } catch (err) {
      console.error('Error handling /today:', err)
      await sendTelegramMessage(chatId, 'Не удалось получить данные за сегодня, попробуй позже.')
    }
    return NextResponse.json({ ok: true })
  }

  // Команда /undo обрабатывается через отдельный HTTP, итерация 0 можно пока не привязывать здесь
  if (text.trim().toLowerCase().startsWith('/undo')) {
    await sendTelegramMessage(
      chatId,
      'Команда /undo пока не привязана к Telegram. Используй /me/nutrition или кнопку Undo там.'
    )
    return NextResponse.json({ ok: true })
  }

  // Итерация 0: простой формат "protein 30"
  const protein = parseSimpleProteinCommand(text)
  if (!protein) {
    await sendTelegramMessage(
      chatId,
      'Сейчас модуль в тестовом режиме. Напиши, например: "protein 30" (без кавычек), чтобы добавить 30 г белка.'
    )
    return NextResponse.json({ ok: true })
  }

  try {
    const summary = await addProteinLogFromTelegram({
      rawText: text,
      protein,
      telegramUpdateId: updateId,
    })

    const msg = `Записал: +${protein.toFixed(0)} г белка.\nСегодня: ${summary.proteinTotal.toFixed(
      0
    )}/${summary.proteinTarget.toFixed(0)} г (осталось ${summary.remaining.toFixed(0)} г).`
    await sendTelegramMessage(chatId, msg)
  } catch (err) {
    console.error('Error handling nutrition log from Telegram:', err)
    await sendTelegramMessage(
      chatId,
      'Не смог сохранить запись, попробуй ещё раз немного позже.'
    )
  }

  return NextResponse.json({ ok: true })
}

