'use client'

import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'

export default function InlineSelect({
  value,
  options,
  onChange,
  className = '',
}: {
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
  className?: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const updatePosition = () => {
        if (buttonRef.current) {
          const rect = buttonRef.current.getBoundingClientRect()
          setPosition({
            top: rect.bottom + 4,
            left: rect.left,
            width: rect.width,
          })
        }
      }
      
      updatePosition()
      
      // Update position on scroll or resize
      window.addEventListener('scroll', updatePosition, true)
      window.addEventListener('resize', updatePosition)
      
      return () => {
        window.removeEventListener('scroll', updatePosition, true)
        window.removeEventListener('resize', updatePosition)
      }
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen) {
      const handler = (e: MouseEvent) => {
        if (buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
          setIsOpen(false)
        }
      }
      document.addEventListener('click', handler)
      return () => document.removeEventListener('click', handler)
    }
  }, [isOpen])

  const selectedOption = options.find(o => o.value === value)

  return (
    <>
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.stopPropagation()
          setIsOpen(!isOpen)
        }}
        className={`cursor-pointer hover:bg-gray-100 px-2 py-1 rounded ${className}`}
      >
        {selectedOption?.label || value}
      </button>
      {isOpen && typeof window !== 'undefined' && buttonRef.current && createPortal(
        <div
          className="fixed bg-white border border-gray-200 rounded-md shadow-lg z-[9999]"
          style={{
            top: `${position.top}px`,
            left: `${position.left}px`,
            width: `${Math.max(position.width, 120)}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {options.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                onChange(option.value)
                setIsOpen(false)
              }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 first:rounded-t-md last:rounded-b-md ${
                option.value === value ? 'bg-blue-50 text-blue-600' : ''
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  )
}
