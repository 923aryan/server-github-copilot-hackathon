import { sign, verify } from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET!

export function createAuthToken(githubUser: any) {
  return sign(
    {
      userId: githubUser.id,
      email: githubUser.email,
      githubToken: githubUser.access_token
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  )
}

export function verifyAuthToken(token: string) {
  try {
    return verify(token, JWT_SECRET)
  } catch (error) {
    return null
  }
}