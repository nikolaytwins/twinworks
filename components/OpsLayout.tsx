'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function OpsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const links = [
    { href: '/ops', label: 'Неделя' },
    { href: '/ops/projects', label: 'Проекты' },
    { href: '/ops/planned', label: 'План' },
    { href: '/ops/interrupts', label: 'Срочное' },
  ]

  return (
    <div>
      <div className="bg-gray-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`py-4 px-1 border-b-2 text-sm font-medium ${
                  pathname === link.href
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {link.label}
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
