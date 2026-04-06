'use client'

import Navigation from '@/components/Navigation'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function ImpulseLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  const tabs = [
    { href: '/impulse', label: 'Ученики' },
    { href: '/impulse/statistics', label: 'Статистика' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="bg-gray-50 border-b border-gray-200">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {tabs.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                className={`py-4 px-1 border-b-2 text-sm font-medium ${
                  pathname === tab.href ||
                  (tab.href === '/impulse' && pathname?.startsWith('/impulse/students')) ||
                  (tab.href === '/impulse/statistics' && pathname?.startsWith('/impulse/statistics'))
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </div>
    </div>
  )
}
