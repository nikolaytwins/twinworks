import { cookies } from 'next/headers'

export type UserRole = 'OWNER' | 'PM'

export async function setUserRole(role: UserRole) {
  const cookieStore = await cookies()
  cookieStore.set('user_role', role, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  })
}

export async function getUserRole(): Promise<UserRole | null> {
  const cookieStore = await cookies()
  const role = cookieStore.get('user_role')?.value
  return (role === 'OWNER' || role === 'PM') ? role : null
}

export async function requireRole(allowedRoles: UserRole[]): Promise<UserRole> {
  const role = await getUserRole()
  if (!role || !allowedRoles.includes(role)) {
    throw new Error('Unauthorized')
  }
  return role
}

export async function logout() {
  const cookieStore = await cookies()
  cookieStore.delete('user_role')
}
