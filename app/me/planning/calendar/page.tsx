import { redirect } from 'next/navigation'

/**
 * Страница планирования теперь на /me/checklist.
 * Этот маршрут оставлен для обратной совместимости — редирект на checklist.
 */
export default function CalendarRedirectPage() {
  redirect('/me/checklist')
}
