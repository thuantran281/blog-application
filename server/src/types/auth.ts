export type UserRole = 'admin' | 'member' | 'viewer'

export interface AuthUser {
  id: string
  username: string
  email: string
  role: UserRole
}
