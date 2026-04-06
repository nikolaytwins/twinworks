#!/bin/bash

# Скрипт для создания бэкапа базы данных
# Использование: ./scripts/backup-db.sh

BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DB_FILE="prisma/dev.db"
BACKUP_FILE="${BACKUP_DIR}/dev_${TIMESTAMP}.db"

# Создаем директорию для бэкапов, если её нет
mkdir -p "$BACKUP_DIR"

# Копируем базу данных
if [ -f "$DB_FILE" ]; then
  cp "$DB_FILE" "$BACKUP_FILE"
  echo "✅ Бэкап создан: $BACKUP_FILE"
  
  # Показываем размер файла
  ls -lh "$BACKUP_FILE"
  
  # Удаляем старые бэкапы (оставляем последние 10)
  ls -t "$BACKUP_DIR"/dev_*.db | tail -n +11 | xargs -r rm
  echo "✅ Старые бэкапы удалены (оставлено последних 10)"
else
  echo "❌ Файл базы данных не найден: $DB_FILE"
  exit 1
fi
