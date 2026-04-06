import { NextRequest, NextResponse } from 'next/server'
import Database from 'better-sqlite3'
import path from 'path'

const dbPath = path.join(process.cwd(), 'prisma', 'dev.db')

function getDb() {
  return new Database(dbPath)
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year')
    const month = searchParams.get('month')
    
    const db = getDb()
    let followers: any[] = []
    
    try {
      let query = 'SELECT * FROM social_followers'
      const params: any[] = []
      
      if (year && month) {
        query += ' WHERE year = ? AND month = ?'
        params.push(parseInt(year), parseInt(month))
      } else if (year) {
        query += ' WHERE year = ?'
        params.push(parseInt(year))
      }
      
      query += ' ORDER BY year DESC, month DESC, platform ASC'
      
      followers = db.prepare(query).all(...params) as any[]
    } catch (e) {
      // Table might not exist yet
      followers = []
    }
    
    db.close()
    return NextResponse.json(followers)
  } catch (error) {
    console.error('Error fetching social followers:', error)
    return NextResponse.json([])
  }
}

export async function POST(request: NextRequest) {
  let db: Database.Database | null = null
  
  try {
    const body = await request.json()
    const { platform, year, month, count } = body
    
    console.log('Received data:', { platform, year, month, count })
    
    if (!platform || year === undefined || month === undefined || count === undefined) {
      return NextResponse.json({ error: 'Missing required fields: platform, year, month, count' }, { status: 400 })
    }
    
    db = getDb()
    const id = `social_${platform}_${year}_${month}`
    
    // Ensure table exists
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS social_followers (
          id TEXT PRIMARY KEY,
          platform TEXT NOT NULL,
          year INTEGER NOT NULL,
          month INTEGER NOT NULL,
          count INTEGER DEFAULT 0,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(platform, year, month)
        )
      `)
    } catch (createError: any) {
      console.error('Table creation error (might already exist):', createError.message)
    }
    
    // Check if exists
    const existing = db.prepare('SELECT id FROM social_followers WHERE platform = ? AND year = ? AND month = ?').get(platform, year, month)
    
    if (existing) {
      // Update existing
      const updateStmt = db.prepare('UPDATE social_followers SET count = ?, updatedAt = CURRENT_TIMESTAMP WHERE platform = ? AND year = ? AND month = ?')
      const result = updateStmt.run(Number(count) || 0, platform, year, month)
      console.log('Updated:', result.changes, 'rows')
    } else {
      // Insert new
      const insertStmt = db.prepare('INSERT INTO social_followers (id, platform, year, month, count, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)')
      const result = insertStmt.run(id, platform, year, month, Number(count) || 0)
      console.log('Inserted:', result.lastInsertRowid)
    }
    
    if (db) db.close()
    return NextResponse.json({ success: true })
    
  } catch (error: any) {
    console.error('Error saving social followers:', error)
    if (db) db.close()
    return NextResponse.json({ 
      error: error.message || 'Failed to save social followers',
      details: error.toString()
    }, { status: 500 })
  }
}
