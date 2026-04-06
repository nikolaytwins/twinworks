import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <h1 className="text-2xl font-semibold text-gray-900 mb-2">Страница не найдена</h1>
      <p className="text-gray-600 mb-6">Такой страницы нет. Перейдите на главную.</p>
      <Link
        href="/me/dashboard"
        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
      >
        На дашборд
      </Link>
    </div>
  )
}
