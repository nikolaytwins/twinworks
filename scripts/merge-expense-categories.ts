/**
 * One-time script: merge duplicate expense categories into one per group.
 * - Updates PersonalTransaction.category from duplicate names to canonical name.
 * - Merges expense_categories: sums expectedMonthly, keeps one row (canonical name), deletes duplicates.
 *
 * Run: npx tsx scripts/merge-expense-categories.ts
 */
import Database from 'better-sqlite3'
import path from 'path'

const dbPath = path.join(process.cwd(), 'prisma', 'dev.db')
const db = new Database(dbPath)

type MergeGroup = { canonical: string; mergeFrom: string[] }

const MERGE_GROUPS: MergeGroup[] = [
  { canonical: 'Подписки', mergeFrom: ['Подписки на сервисы', 'подписки'] },
  {
    canonical: 'Совместное время с Лерой',
    mergeFrom: ['Совместное время с Лерой (досуг)', 'совместное с лерой (досуг)'],
  },
  { canonical: 'Зарплаты', mergeFrom: ['Зарплаты команде', 'зарплаты'] },
  { canonical: 'Бытовые расходы', mergeFrom: ['Продукты и быт', 'продукты и быт'] },
  { canonical: 'Коммуналка', mergeFrom: ['коммуналка', 'коммулалка'] },
  { canonical: 'На себя', mergeFrom: ['Я', 'я'] },
  {
    canonical: 'Подписки + интернет + связь',
    mergeFrom: ['подписки и интернет', 'Подписки и интернет'],
  },
]

function run() {
  console.log('Merge expense categories: start\n')

  for (const { canonical, mergeFrom } of MERGE_GROUPS) {
    // 1. Update transactions: set category to canonical where category is any of mergeFrom
    for (const alias of mergeFrom) {
      const upd = db.prepare(
        "UPDATE PersonalTransaction SET category = ?, updatedAt = datetime('now') WHERE category = ?"
      ).run(canonical, alias)
      if (upd.changes > 0) {
        console.log(`  Transactions: "${alias}" → "${canonical}" (${upd.changes} rows)`)
      }
    }

    // 2. Merge expense_categories: get all rows (canonical + aliases, exact match)
    const placeholders = mergeFrom.map(() => '?').join(', ')
    const args = [canonical, ...mergeFrom]
    const rows = db.prepare(
      `SELECT id, name, type, expectedMonthly FROM expense_categories WHERE name = ? OR name IN (${placeholders})`
    ).all(...args) as { id: string; name: string; type: string; expectedMonthly: number }[]

    if (rows.length === 0) continue
    const totalExpected = rows.reduce((s, r) => s + (r.expectedMonthly || 0), 0)
    const canonicalRow = rows.find((r) => r.name === canonical)
    const keepId = canonicalRow ? canonicalRow.id : rows[0].id
    const keepType = (canonicalRow || rows[0]).type

    db.prepare(
      "UPDATE expense_categories SET name = ?, expectedMonthly = ?, updatedAt = datetime('now') WHERE id = ?"
    ).run(canonical, totalExpected, keepId)

    const toDelete = rows.filter((r) => r.id !== keepId)
    for (const r of toDelete) {
      db.prepare('DELETE FROM expense_categories WHERE id = ?').run(r.id)
      console.log(`  Category removed: "${r.name}" (expectedMonthly ${r.expectedMonthly} merged into "${canonical}")`)
    }
    if (rows.length > 1) {
      console.log(`  Category "${canonical}": expectedMonthly = ${totalExpected} (kept id ${keepId}, type ${keepType})\n`)
    }
  }

  console.log('Merge expense categories: done.')
}

try {
  run()
} catch (e: any) {
  console.error('Error:', e?.message || e)
  process.exit(1)
} finally {
  db.close()
}
