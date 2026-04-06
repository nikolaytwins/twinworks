-- Insert Personal Accounts
INSERT INTO PersonalAccount (id, name, type, currency, balance, createdAt, updatedAt)
VALUES 
  ('acc1', 'Основная карта', 'card', 'RUB', 450000, datetime('now'), datetime('now')),
  ('acc2', 'Касса', 'cash', 'RUB', 50000, datetime('now'), datetime('now')),
  ('acc3', 'Подушка безопасности', 'bank', 'RUB', 500000, datetime('now'), datetime('now')),
  ('acc4', 'Цель: квартира', 'bank', 'RUB', 2000000, datetime('now'), datetime('now'));

-- Insert Personal Transactions
INSERT INTO PersonalTransaction (id, date, type, amount, currency, category, description, fromAccountId, toAccountId, createdAt, updatedAt)
VALUES 
  ('t1', datetime('now', '-2 days'), 'expense', 15000, 'RUB', 'Продукты', 'Продукты на неделю', 'acc1', NULL, datetime('now'), datetime('now')),
  ('t2', datetime('now', '-5 days'), 'expense', 35000, 'RUB', 'Аренда', 'Аренда офиса', 'acc1', NULL, datetime('now'), datetime('now')),
  ('t3', datetime('now', '-10 days'), 'income', 400000, 'RUB', 'Зарплата', 'Выручка за месяц', NULL, 'acc1', datetime('now'), datetime('now')),
  ('t4', datetime('now', 'start of month'), 'expense', 20000, 'RUB', 'Развлечения', 'Ресторан', 'acc1', NULL, datetime('now'), datetime('now')),
  ('t5', datetime('now', '-7 days'), 'expense', 12000, 'RUB', 'Транспорт', 'Такси и метро', 'acc1', NULL, datetime('now'), datetime('now')),
  ('t6', datetime('now', '-15 days'), 'income', 50000, 'RUB', 'Фриланс', 'Дополнительный проект', NULL, 'acc1', datetime('now'), datetime('now'));

-- Insert Personal Goals
INSERT INTO PersonalGoal (id, period, name, targetAmount, currentAmount, linkedAccountId, deadline, notes, createdAt, updatedAt)
VALUES 
  ('g1', 'month', 'Накопить на отпуск', 100000, 60000, NULL, date('now', 'start of month', '+1 month', '-1 day'), NULL, datetime('now'), datetime('now')),
  ('g2', 'quarter', 'Квартира', 5000000, 2000000, 'acc4', date('now', 'start of month', '+3 months', '-1 day'), NULL, datetime('now'), datetime('now')),
  ('g3', 'month', 'Новый ноутбук', 150000, 80000, NULL, date('now', 'start of month', '+1 month', '-1 day'), NULL, datetime('now'), datetime('now'));

-- Insert Personal Settings
INSERT INTO personal_settings (id, expectedMonthlyExpenses, updatedAt)
VALUES ('settings1', 109000, datetime('now'));
