'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Category {
  id: string
  name: string
  type: string
}

interface Account {
  id: string
  name: string
}

function AccountSelector({ accounts }: { accounts: Account[] }) {
  const [type, setType] = useState('expense')

  useEffect(() => {
    const typeSelect = document.getElementById('type') as HTMLSelectElement
    if (typeSelect) {
      setType(typeSelect.value)
      typeSelect.addEventListener('change', (e) => {
        setType((e.target as HTMLSelectElement).value)
      })
    }
  }, [])

  if (type === 'transfer') {
    return (
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="fromAccountId" className="block text-sm font-medium text-gray-700 mb-1">
            С какого счёта *
          </label>
          <select
            id="fromAccountId"
            name="fromAccountId"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Выберите счёт</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>{acc.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="toAccountId" className="block text-sm font-medium text-gray-700 mb-1">
            На какой счёт *
          </label>
          <select
            id="toAccountId"
            name="toAccountId"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Выберите счёт</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>{acc.name}</option>
            ))}
          </select>
        </div>
      </div>
    )
  }

  return (
    <div>
      <label htmlFor={type === 'expense' ? 'fromAccountId' : 'toAccountId'} className="block text-sm font-medium text-gray-700 mb-1">
        {type === 'expense' ? 'Счёт списания *' : 'Счёт зачисления *'}
      </label>
      <select
        id={type === 'expense' ? 'fromAccountId' : 'toAccountId'}
        name={type === 'expense' ? 'fromAccountId' : 'toAccountId'}
        required
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
      >
        <option value="">Выберите счёт</option>
        {accounts.map((acc) => (
          <option key={acc.id} value={acc.id}>{acc.name}</option>
        ))}
      </select>
    </div>
  )
}

export default function NewTransactionPage() {
  const router = useRouter()
  const [categories, setCategories] = useState<Category[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [categorySearch, setCategorySearch] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [cats, accs] = await Promise.all([
        fetch('/api/categories').then(r => r.json()),
        fetch('/api/accounts').then(r => r.json()),
      ])
      setCategories(Array.isArray(cats) ? cats : [])
      setAccounts(Array.isArray(accs) ? accs : [])
    } catch {
      setCategories([])
      setAccounts([])
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const formData = new FormData(e.currentTarget)
    const type = formData.get('type') as string
    const data = {
      date: formData.get('date'),
      type,
      amount: parseFloat(formData.get('amount') as string),
      currency: formData.get('currency') || 'RUB',
      category: formData.get('category') || null,
      description: formData.get('description') || null,
      fromAccountId: type === 'expense' || type === 'transfer' ? formData.get('fromAccountId') || null : null,
      toAccountId: type === 'income' || type === 'transfer' ? formData.get('toAccountId') || null : null,
    }

    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (res.ok) {
        router.push('/me/transactions')
        router.refresh()
      } else {
        const errorData = await res.json()
        setError(errorData.error || 'Ошибка при создании транзакции')
      }
    } catch (err) {
      setError('Ошибка при создании транзакции')
    } finally {
      setLoading(false)
    }
  }

  const personalCategories = Array.isArray(categories) ? categories.filter(c => c.type === 'personal') : []
  const businessCategories = Array.isArray(categories) ? categories.filter(c => c.type === 'business') : []

  return (
    <div>
      <div className="mb-6">
        <Link href="/me/transactions" className="text-blue-600 hover:text-blue-800 text-sm">
          ← Назад к транзакциям
        </Link>
      </div>

      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Новая транзакция</h1>

        <div className="bg-white shadow-sm rounded-lg p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-1">
                Тип *
              </label>
              <select
                id="type"
                name="type"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="income">Доход</option>
                <option value="expense">Расход</option>
                <option value="transfer">Перевод</option>
              </select>
            </div>

            <div>
              <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
                Дата *
              </label>
              <input
                id="date"
                name="date"
                type="date"
                required
                defaultValue={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">
                Сумма *
              </label>
              <input
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div id="categorySection">
              <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
                Категория
              </label>
              <div className="space-y-2">
                <input
                  type="text"
                  list="categoryList"
                  value={categorySearch}
                  onChange={(e) => setCategorySearch(e.target.value)}
                  onInput={(e) => {
                    // При вводе обновляем скрытое поле
                    const hiddenInput = document.getElementById('categoryHidden') as HTMLInputElement
                    if (hiddenInput) {
                      const allCategories = [...personalCategories, ...businessCategories]
                      const exactMatch = allCategories.find(cat => cat.name.toLowerCase() === (e.target as HTMLInputElement).value.toLowerCase())
                      hiddenInput.value = exactMatch ? exactMatch.name : (e.target as HTMLInputElement).value
                    }
                  }}
                  placeholder="Начните вводить название категории..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
                <datalist id="categoryList">
                  {personalCategories.map((cat) => (
                    <option key={cat.id} value={cat.name} />
                  ))}
                  {businessCategories.map((cat) => (
                    <option key={cat.id} value={cat.name} />
                  ))}
                </datalist>
                <input
                  type="hidden"
                  id="categoryHidden"
                  name="category"
                  value={categorySearch}
                />
                <details className="text-sm">
                  <summary className="cursor-pointer text-gray-600 hover:text-gray-900 py-1">
                    Или выберите из списка
                  </summary>
                  <div className="mt-2 space-y-3 max-h-60 overflow-y-auto border border-gray-200 rounded p-3 bg-gray-50">
                    <div>
                      <div className="text-xs font-semibold text-gray-700 mb-2">Личные расходы</div>
                      <div className="grid grid-cols-2 gap-1">
                        {personalCategories.map((cat) => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => {
                              setCategorySearch(cat.name)
                              const hiddenInput = document.getElementById('categoryHidden') as HTMLInputElement
                              if (hiddenInput) hiddenInput.value = cat.name
                            }}
                            className="text-left px-2 py-1.5 text-sm hover:bg-blue-100 rounded border border-transparent hover:border-blue-300"
                          >
                            {cat.name}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-gray-700 mb-2">Бизнес расходы</div>
                      <div className="grid grid-cols-2 gap-1">
                        {businessCategories.map((cat) => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => {
                              setCategorySearch(cat.name)
                              const hiddenInput = document.getElementById('categoryHidden') as HTMLInputElement
                              if (hiddenInput) hiddenInput.value = cat.name
                            }}
                            className="text-left px-2 py-1.5 text-sm hover:bg-blue-100 rounded border border-transparent hover:border-blue-300"
                          >
                            {cat.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </details>
              </div>
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Описание
              </label>
              <input
                id="description"
                name="description"
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div id="accountSection">
              <AccountSelector accounts={accounts} />
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Link
                href="/me/transactions"
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Отмена
              </Link>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Создание...' : 'Создать транзакцию'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
