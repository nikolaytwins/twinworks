# Автоматическая подбивка подписчиков

## Возможные интеграции для автоматического сбора данных

### 1. Instagram
- **API**: Instagram Graph API / Basic Display API
- **Требования**: Facebook App, токен доступа
- **Метод**: `GET /{user-id}/insights` с метрикой `follower_count`
- **Ограничения**: Требуется бизнес-аккаунт или Creator Account

### 2. YouTube
- **API**: YouTube Data API v3
- **Требования**: Google Cloud проект, API ключ или OAuth
- **Метод**: `channels.list` с параметром `statistics.subscriberCount`
- **Ограничения**: Квоты на запросы (10,000 единиц в день по умолчанию)

### 3. Telegram
- **API**: Telegram Bot API
- **Требования**: Telegram Bot Token
- **Метод**: 
  - Для каналов: `getChatMembersCount` (для публичных каналов по username)
  - Для ботов: `getChatMembersCount` (нужен chat_id)
- **Ограничения**: Для приватных каналов нужны права администратора

### 4. Telegram База (Contacts)
- **Сложность**: Высокая
- **Метод**: Через Telegram Client API (MTProto)
- **Ограничения**: Требуется номер телефона и сессия

## Реализация

Для автоматической подбивки можно:

1. **Создать отдельную страницу настроек** `/me/social/settings`
   - Форма для ввода API ключей/токенов
   - Сохранение в БД или .env

2. **API endpoint** `/api/social-followers/sync`
   - Вызов внешних API
   - Сохранение данных в БД
   - Запуск по расписанию или вручную

3. **Cron job или Scheduled Task**
   - Ежедневное обновление данных
   - Можно использовать Vercel Cron или отдельный сервис

## Пример структуры настроек:

```typescript
model SocialIntegration {
  id          String
  platform    String
  apiKey      String?  // зашифровано
  apiSecret   String?  // зашифровано
  enabled     Boolean
  lastSync    DateTime?
}
```
