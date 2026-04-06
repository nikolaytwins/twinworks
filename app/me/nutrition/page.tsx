'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface NutritionLog {
  id: string
  createdAt: string
  rawText: string
  protein: number
}

interface NutritionSummary {
  dateKey: string
  proteinTotal: number
  proteinTarget: number
  remaining: number
  percent: number
  logs: NutritionLog[]
}

export default function NutritionPage() {
  const [summary, setSummary] = useState<NutritionSummary | null>(null)
  const [logs, setLogs] = useState<NutritionLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [todayRes, logsRes] = await Promise.all([
        fetch('/api/nutrition/today', { cache: 'no-store' }),
        fetch('/api/nutrition/logs', { cache: 'no-store' }),
      ])

      if (todayRes.status === 403 || logsRes.status === 403) {
        setError('Модуль питания отключён (NUTRITION_ENABLED=false).')
        setSummary(null)
        setLogs([])
        return
      }

      if (!todayRes.ok || !logsRes.ok) {
        setError('Не удалось загрузить данные по питанию.')
        return
      }

      const todayJson = await todayRes.json()
      const logsJson = await logsRes.json()
      setSummary(todayJson)
      setLogs(logsJson.logs || [])
    } catch (e) {
      console.error('Error loading nutrition data:', e)
      setError('Ошибка загрузки данных по питанию.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleUndo = async () => {
    try {
      const res = await fetch('/api/nutrition/undo', { method: 'POST' })
      if (res.status === 403) {
        setError('Модуль питания отключён.')
        return
      }
      if (!res.ok) {
        setError('Не удалось отменить последнюю запись.')
        return
      }
      await loadData()
    } catch (e) {
      console.error('Error undo nutrition log:', e)
      setError('Ошибка при отмене записи.')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <Link href="/me/dashboard" className="text-sm text-gray-500 hover:text-gray-700 mb-1 block">
              ← Назад к дашборду
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Питание / Белок</h1>
            <p className="text-sm text-gray-600 mt-1">
              Модуль в тестовом режиме. Сейчас поддерживается формат сообщений в Telegram вида
              <span className="font-mono bg-gray-100 px-1 py-0.5 rounded ml-1">protein 30</span>.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-gray-500 text-sm">Загрузка...</div>
        ) : summary ? (
          <>
            {/* Итог за сегодня */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-semibold text-gray-700">
                  Сегодня ({summary.dateKey}): белок {summary.proteinTotal.toFixed(0)} /{' '}
                  {summary.proteinTarget.toFixed(0)} г
                </div>
                <button
                  onClick={loadData}
                  className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
                >
                  Обновить
                </button>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-3 rounded-full ${
                    summary.percent >= 100 ? 'bg-green-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${summary.percent}%` }}
                />
              </div>
              <div className="mt-2 text-xs text-gray-600">
                Осталось примерно {summary.remaining.toFixed(0)} г белка.
              </div>
              <div className="mt-3">
                <button
                  onClick={handleUndo}
                  className="text-xs px-3 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  Undo last
                </button>
              </div>
            </div>

            {/* Логи за сегодня */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-800">Записи за сегодня</h2>
                <span className="text-xs text-gray-500">
                  Всего записей: {logs.length}
                </span>
              </div>
              {logs.length === 0 ? (
                <div className="text-sm text-gray-500">
                  Пока нет записей. Напиши боту в Telegram, например:{' '}
                  <span className="font-mono bg-gray-100 px-1 py-0.5 rounded">protein 30</span>.
                </div>
              ) : (
                <div className="space-y-2">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-start justify-between px-3 py-2 rounded-lg border border-gray-100 bg-gray-50"
                    >
                      <div className="flex-1">
                        <div className="text-xs text-gray-500">
                          {new Date(log.createdAt).toLocaleTimeString('ru-RU', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                        <div className="text-sm text-gray-900 whitespace-pre-wrap">
                          {log.rawText}
                        </div>
                      </div>
                      <div className="ml-3 text-sm font-semibold text-blue-700 whitespace-nowrap">
                        +{log.protein.toFixed(0)} г
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Подсказки */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <h2 className="text-sm font-semibold text-gray-800 mb-2">
                Как сейчас писать в Telegram
              </h2>
              <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1">
                <li>
                  Формат итерации 0:&nbsp;
                  <span className="font-mono bg-gray-100 px-1 py-0.5 rounded">
                    protein 30
                  </span>{' '}
                  — добавит 30 г белка.
                </li>
                <li>
                  Команда{' '}
                  <span className="font-mono bg-gray-100 px-1 py-0.5 rounded">
                    /today
                  </span>{' '}
                  — покажет итог за сегодня в чате.
                </li>
                <li>
                  Команда{' '}
                  <span className="font-mono bg-gray-100 px-1 py-0.5 rounded">
                    /undo
                  </span>{' '}
                  пока не активна, используй кнопку Undo здесь.
                </li>
              </ul>
            </div>
          </>
        ) : (
          <div className="text-sm text-gray-500">
            Данные по питанию недоступны. Проверь, что NUTRITION_ENABLED=true и модуль настроен.
          </div>
        )}
      </div>
    </div>
  )
}

