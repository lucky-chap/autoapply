import crypto from "crypto"

/**
 * AES-256-GCM Encryption Utility
 * 
 * Uses the ENCRYPTION_SECRET env var to encrypt/decrypt sensitive tokens.
 * Format: iv:authTag:encryptedContent
 */

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16

function getSecret() {
  const secret = process.env.ENCRYPTION_SECRET
  if (!secret) {
    throw new Error("ENCRYPTION_SECRET must be set for token security.")
  }
  // Ensure the secret is 32 bytes for aes-256
  return crypto.createHash("sha256").update(secret).digest()
}

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH)
  const key = getSecret()
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  
  let encrypted = cipher.update(text, "utf8", "hex")
  encrypted += cipher.final("hex")
  
  const authTag = cipher.getAuthTag().toString("hex")
  
  return `${iv.toString("hex")}:${authTag}:${encrypted}`
}

export function decrypt(encryptedData: string): string {
  if (!encryptedData.includes(":")) return encryptedData // Fallback for unencrypted legacy tokens

  const [ivHex, authTagHex, encryptedText] = encryptedData.split(":")
  
  if (!ivHex || !authTagHex || !encryptedText) {
    throw new Error("Invalid encrypted data format")
  }

  const iv = Buffer.from(ivHex, "hex")
  const authTag = Buffer.from(authTagHex, "hex")
  const key = getSecret()
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  
  let decrypted = decipher.update(encryptedText, "hex", "utf8")
  decrypted += decipher.final("utf8")
  
  return decrypted
}
