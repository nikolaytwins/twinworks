import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function POST() {
  if (process.env.SEED_ENABLED !== 'true') {
    return NextResponse.json(
      { success: false, error: 'Seeding is disabled on this environment' },
      { status: 403 }
    )
  }

  try {
    console.log('🌱 Seeding database...')

    // Clear existing data
    await prisma.personalSettings.deleteMany()
    await prisma.personalGoal.deleteMany()
    await prisma.personalTransaction.deleteMany()
    await prisma.personalAccount.deleteMany()

    const today = new Date()
    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    const quarterEnd = new Date(
      today.getFullYear(),
      Math.floor(today.getMonth() / 3) * 3 + 3,
      0
    )

    // Personal Accounts
    const account1 = await prisma.personalAccount.create({
      data: {
        name: 'Основная карта',
        type: 'card',
        currency: 'RUB',
        balance: 450000,
      },
    })

    await prisma.personalAccount.create({
      data: {
        name: 'Касса',
        type: 'cash',
        currency: 'RUB',
        balance: 50000,
      },
    })

    await prisma.personalAccount.create({
      data: {
        name: 'Подушка безопасности',
        type: 'bank',
        currency: 'RUB',
        balance: 500000,
      },
    })

    const account4 = await prisma.personalAccount.create({
      data: {
        name: 'Цель: квартира',
        type: 'bank',
        currency: 'RUB',
        balance: 2000000,
      },
    })

    // Personal Transactions
    await prisma.personalTransaction.createMany({
      data: [
        {
          date: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000),
          type: 'expense',
          amount: 15000,
          currency: 'RUB',
          category: 'Продукты',
          description: 'Продукты на неделю',
          fromAccountId: account1.id,
        },
        {
          date: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000),
          type: 'expense',
          amount: 35000,
          currency: 'RUB',
          category: 'Аренда',
          description: 'Аренда офиса',
          fromAccountId: account1.id,
        },
        {
          date: new Date(today.getTime() - 10 * 24 * 60 * 60 * 1000),
          type: 'income',
          amount: 400000,
          currency: 'RUB',
          category: 'Зарплата',
          description: 'Выручка за месяц',
          toAccountId: account1.id,
        },
        {
          date: thisMonthStart,
          type: 'expense',
          amount: 20000,
          currency: 'RUB',
          category: 'Развлечения',
          description: 'Ресторан',
          fromAccountId: account1.id,
        },
        {
          date: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000),
          type: 'expense',
          amount: 12000,
          currency: 'RUB',
          category: 'Транспорт',
          description: 'Такси и метро',
          fromAccountId: account1.id,
        },
        {
          date: new Date(today.getTime() - 15 * 24 * 60 * 60 * 1000),
          type: 'income',
          amount: 50000,
          currency: 'RUB',
          category: 'Фриланс',
          description: 'Дополнительный проект',
          toAccountId: account1.id,
        },
      ],
    })

    // Personal Goals
    await prisma.personalGoal.createMany({
      data: [
        {
          period: 'month',
          name: 'Накопить на отпуск',
          targetAmount: 100000,
          currentAmount: 60000,
          deadline: monthEnd,
        },
        {
          period: 'quarter',
          name: 'Квартира',
          targetAmount: 5000000,
          currentAmount: 2000000,
          deadline: quarterEnd,
          linkedAccountId: account4.id,
        },
        {
          period: 'month',
          name: 'Новый ноутбук',
          targetAmount: 150000,
          currentAmount: 80000,
          deadline: monthEnd,
        },
      ],
    })

    // Personal Settings
    await prisma.personalSettings.create({
      data: {
        expectedMonthlyExpenses: 109000,
      },
    })

    return NextResponse.json({ success: true, message: '✅ Seeding completed!' })
  } catch (error) {
    console.error('Seeding error:', error)
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}
