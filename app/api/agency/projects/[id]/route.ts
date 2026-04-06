import { NextRequest, NextResponse } from 'next/server'
import Database from 'better-sqlite3'
import path from 'path'

const dbPath = path.join(process.cwd(), 'prisma', 'dev.db')

function getDb() {
  return new Database(dbPath)
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const db = getDb()
    const project = db.prepare('SELECT * FROM AgencyProject WHERE id = ?').get(params.id) as any
    db.close()
    
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }
    
    return NextResponse.json(project)
  } catch (error) {
    console.error('Error fetching project:', error)
    return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const body = await request.json()
    const name = body.name != null ? String(body.name) : ''
    const totalAmount = Number(body.totalAmount) || 0
    const paidAmount = Number(body.paidAmount) || 0
    const deadline = body.deadline ?? null
    const status = body.status != null ? String(body.status) : 'not_paid'
    const serviceType = body.serviceType != null ? String(body.serviceType) : 'site'
    const clientType = body.clientType != null && body.clientType !== '' ? String(body.clientType) : null
    const paymentMethod = body.paymentMethod != null && body.paymentMethod !== '' ? String(body.paymentMethod) : null
    const clientContact = body.clientContact != null ? String(body.clientContact) : null
    const notes = body.notes != null ? String(body.notes) : null

    const db = getDb()
    db.prepare(`
      UPDATE AgencyProject 
      SET name = ?, totalAmount = ?, paidAmount = ?, deadline = ?, status = ?, serviceType = ?, clientType = ?, paymentMethod = ?, clientContact = ?, notes = ?, updatedAt = datetime('now')
      WHERE id = ?
    `).run(name, totalAmount, paidAmount, deadline, status, serviceType, clientType, paymentMethod, clientContact, notes, params.id)
    
    const project = db.prepare('SELECT * FROM AgencyProject WHERE id = ?').get(params.id) as any
    db.close()
    
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }
    
    console.log('Project updated successfully:', project)
    return NextResponse.json({ success: true, project })
  } catch (error: any) {
    console.error('Error updating project:', error)
    console.error('Error details:', error.message, error.stack)
    return NextResponse.json({ 
      error: 'Failed to update project',
      details: error.message 
    }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const db = getDb()
    db.prepare('DELETE FROM AgencyProject WHERE id = ?').run(params.id)
    db.close()
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting project:', error)
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 })
  }
}
