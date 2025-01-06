import type { Context } from "hono"
import { HTTPException } from "hono/http-exception"
import { verifyAuthToken } from "../utils"

export async function authMiddleware(c: Context, next: () => Promise<void>) {
  const authHeader = c.req.header('Authorization')
  console.log("check 1 m")
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new HTTPException(401, { message: 'Unauthorized' })
  }
  console.log("check 2 m")

  const token = authHeader.split(' ')[1]
  const payload = verifyAuthToken(token)
  console.log("check 3 m")

  if (!payload) {
    throw new HTTPException(401, { message: 'Invalid token' })
  }
  console.log("check 4 m")

  // Add verified user data to context
  c.set('user', payload)
  console.log("check 5 m")

  await next()
}