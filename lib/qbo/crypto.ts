import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'

function getKey(): Buffer {
  const secret = process.env.AUTH_SECRET ?? 'upper_construction_dev_secret_fallback'
  return createHash('sha256').update(secret + ':qbo').digest()
}

export function encryptToken(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`
}

export function decryptToken(encrypted: string): string {
  const key = getKey()
  const parts = encrypted.split(':')
  if (parts.length !== 3) throw new Error('Invalid encrypted token format')
  const [ivHex, tagHex, dataHex] = parts
  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const data = Buffer.from(dataHex, 'hex')
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}
