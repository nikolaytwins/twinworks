import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const body = await request.json()
    const { title, completed, order, notes, priority, optional } = body

    if (title == null || typeof completed !== 'boolean') {
      return NextResponse.json({ error: 'title and completed are required' }, { status: 400 })
    }

    const data: { title: string; completed: boolean; notes?: string | null; order?: number; priority?: string; optional?: boolean } = {
      title: String(title),
      completed: Boolean(completed),
      notes: notes !== undefined && notes !== null ? String(notes) : null
    }
    if (typeof order === 'number') data.order = order
    if (priority === 'low' || priority === 'medium' || priority === 'high') data.priority = priority
    if (typeof optional === 'boolean') data.optional = optional

    await prisma.checklistGoal.update({
      where: { id: params.id },
      data
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating checklist goal:', error)
    return NextResponse.json({ error: 'Failed to update goal' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    await prisma.checklistGoal.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting checklist goal:', error)
    return NextResponse.json({ error: 'Failed to delete goal' }, { status: 500 })
  }
}
