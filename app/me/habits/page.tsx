'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface HabitDefinition {
  id: string
  name: string
  type: 'weekly' | 'monthly'
  slotsCount: number
  order: number
  isMain: boolean
}

export default function HabitsPage() {
  const [habits, setHabits] = useState<HabitDefinition[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<'weekly' | 'monthly'>('weekly')
  const [newSlotsCount, setNewSlotsCount] = useState(4)
  const [newIsMain, setNewIsMain] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editType, setEditType] = useState<'weekly' | 'monthly'>('weekly')
  const [editSlotsCount, setEditSlotsCount] = useState(7)
  const [editIsMain, setEditIsMain] = useState(false)

  const fetchHabits = async () => {
    try {
      const res = await fetch('/api/habits', { cache: 'no-store' })
      const data = await res.json()
      setHabits(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error(e)
      setHabits([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHabits()
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    try {
      const res = await fetch('/api/habits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          type: newType,
          slotsCount: newType === 'weekly' ? 7 : newSlotsCount,
          isMain: newIsMain,
        }),
      })
      if (res.ok) {
        setNewName('')
        setNewType('weekly')
        setNewSlotsCount(4)
        setNewIsMain(false)
        fetchHabits()
      } else {
        const err = await res.json().catch(() => ({}))
        alert(err.error || 'Ошибка создания')
      }
    } catch (e) {
      console.error(e)
      alert('Ошибка создания привычки')
    }
  }

  const startEdit = (h: HabitDefinition) => {
    setEditingId(h.id)
    setEditName(h.name)
    setEditType(h.type)
    setEditSlotsCount(h.slotsCount)
    setEditIsMain(h.isMain)
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingId || !editName.trim()) return
    try {
      const res = await fetch(`/api/habits/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          type: editType,
          slotsCount: editType === 'weekly' ? 7 : editSlotsCount,
          isMain: editIsMain,
        }),
      })
      if (res.ok) {
        setEditingId(null)
        fetchHabits()
      } else {
        const err = await res.json().catch(() => ({}))
        alert(err.error || 'Ошибка сохранения')
      }
    } catch (e) {
      console.error(e)
      alert('Ошибка сохранения')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить привычку? Прогресс по ней в календаре останется в базе.')) return
    try {
      const res = await fetch(`/api/habits/${id}`, { method: 'DELETE' })
      if (res.ok) fetchHabits()
      else alert('Ошибка удаления')
    } catch (e) {
      console.error(e)
      alert('Ошибка удаления')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="text-gray-500">Загрузка...</span>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/me/dashboard" className="text-sm text-blue-600 hover:text-blue-800">
            ← Дашборд
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">Мои привычки</h1>
          <p className="text-sm text-gray-500 mt-1">
            Создавайте привычки — они появятся в блоке «Главные привычки», в календаре и в «Привычки на сегодня» на дашборде и в трекере.
          </p>
        </div>
      </div>

      {/* Добавить привычку */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Добавить привычку</h2>
        <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-4">
          <div className="min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Название</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Например: Чтение"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Тип</label>
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as 'weekly' | 'monthly')}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500"
            >
              <option value="weekly">Недельная (7 дней)</option>
              <option value="monthly">Месячная (N слотов)</option>
            </select>
          </div>
          {newType === 'monthly' && (
            <div className="w-24">
              <label className="block text-sm font-medium text-gray-700 mb-1">Слотов</label>
              <input
                type="number"
                min={1}
                max={31}
                value={newSlotsCount}
                onChange={(e) => setNewSlotsCount(Math.max(1, Math.min(31, parseInt(e.target.value, 10) || 4)))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          )}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={newIsMain}
              onChange={(e) => setNewIsMain(e.target.checked)}
              className="w-4 h-4 text-violet-600 rounded border-gray-300 focus:ring-violet-500"
            />
            <span className="text-sm text-gray-700">В блоке «Главные привычки»</span>
          </label>
          <button
            type="submit"
            disabled={!newName.trim()}
            className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Добавить
          </button>
        </form>
      </div>

      {/* Список привычек */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <h2 className="text-lg font-semibold text-gray-900 px-6 py-4 border-b border-gray-200">Список привычек</h2>
        <ul className="divide-y divide-gray-200">
          {habits.length === 0 && (
            <li className="px-6 py-8 text-center text-gray-500">Пока нет привычек. Добавьте первую выше.</li>
          )}
          {habits.map((h) => (
            <li key={h.id} className="px-6 py-4 flex items-center justify-between gap-4">
              {editingId === h.id ? (
                <form onSubmit={handleUpdate} className="flex flex-wrap items-center gap-3 flex-1">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 min-w-[160px] px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value as 'weekly' | 'monthly')}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="weekly">Недельная</option>
                    <option value="monthly">Месячная</option>
                  </select>
                  {editType === 'monthly' && (
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={editSlotsCount}
                      onChange={(e) => setEditSlotsCount(Math.max(1, Math.min(31, parseInt(e.target.value, 10) || 4)))}
                      className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  )}
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={editIsMain}
                      onChange={(e) => setEditIsMain(e.target.checked)}
                      className="w-4 h-4 text-violet-600 rounded"
                    />
                    <span className="text-xs text-gray-600">Главная</span>
                  </label>
                  <button type="submit" className="px-3 py-1.5 bg-violet-600 text-white rounded-lg text-sm">
                    Сохранить
                  </button>
                  <button type="button" onClick={() => setEditingId(null)} className="px-3 py-1.5 text-gray-600 hover:text-gray-800 text-sm">
                    Отмена
                  </button>
                </form>
              ) : (
                <>
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="font-medium text-gray-900 truncate">{h.name}</span>
                    <span className="text-xs text-gray-500 shrink-0">
                      {h.type === 'weekly' ? '7 дней' : `${h.slotsCount} слотов`}
                      {h.isMain && ' · Главная'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => startEdit(h)}
                      className="text-sm text-violet-600 hover:text-violet-800"
                    >
                      Изменить
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(h.id)}
                      className="text-sm text-red-600 hover:text-red-800"
                    >
                      Удалить
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
