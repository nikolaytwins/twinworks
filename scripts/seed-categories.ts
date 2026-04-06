import Database from 'better-sqlite3'
import path from 'path'

const dbPath = path.join(process.cwd(), 'prisma', 'dev.db')
const db = new Database(dbPath)

const categories = [
  // Личное
  { name: 'продукты и быт', type: 'personal', expectedMonthly: 0 },
  { name: 'подписки и интернет', type: 'personal', expectedMonthly: 0 },
  { name: 'совместное с лерой (досуг)', type: 'personal', expectedMonthly: 0 },
  { name: 'лера', type: 'personal', expectedMonthly: 0 },
  { name: 'я', type: 'personal', expectedMonthly: 0 },
  { name: 'рабочие расходы', type: 'personal', expectedMonthly: 0 },
  { name: 'семейный отдых', type: 'personal', expectedMonthly: 0 },
  { name: 'подарки', type: 'personal', expectedMonthly: 0 },
  { name: 'другое', type: 'personal', expectedMonthly: 0 },
  // Бизнес
  { name: 'зарплаты', type: 'business', expectedMonthly: 0 },
  { name: 'подписки', type: 'business', expectedMonthly: 0 },
  { name: 'налоги', type: 'business', expectedMonthly: 0 },
  { name: 'реклама', type: 'business', expectedMonthly: 0 },
  { name: 'обучение', type: 'business', expectedMonthly: 0 },
]

console.log('Добавление категорий в базу данных...')

try {
  // Проверяем, существует ли таблица
  db.prepare(`
    CREATE TABLE IF NOT EXISTS expense_categories (
      id TEXT NOT NULL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL,
      expectedMonthly REAL NOT NULL DEFAULT 0,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run()

  // Создаём уникальный индекс если его нет
  try {
    db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS expense_categories_name_key ON expense_categories(name)').run()
  } catch (e) {
    // Индекс уже существует
  }

  let added = 0
  let skipped = 0

  for (const cat of categories) {
    const id = `cat_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
    try {
      db.prepare(`
        INSERT INTO expense_categories (id, name, type, expectedMonthly, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(id, cat.name, cat.type, cat.expectedMonthly)
      added++
      console.log(`✓ Добавлена: ${cat.name} (${cat.type})`)
    } catch (e: any) {
      if (e.message && e.message.includes('UNIQUE')) {
        skipped++
        console.log(`- Пропущена (уже существует): ${cat.name}`)
      } else {
        console.error(`✗ Ошибка при добавлении ${cat.name}:`, e.message)
      }
    }
  }

  console.log(`\nГотово! Добавлено: ${added}, Пропущено: ${skipped}`)
} catch (error: any) {
  console.error('Ошибка:', error.message)
  process.exit(1)
} finally {
  db.close()
}
