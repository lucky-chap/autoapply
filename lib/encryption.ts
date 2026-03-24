/**
 * AES-256-GCM Encryption Utility (Web Crypto API)
 * 
 * Uses the ENCRYPTION_SECRET env var to encrypt/decrypt sensitive tokens.
 * Format: iv:authTag:encryptedContent
 * 
 * This version uses the Web Crypto API, making it compatible with 
 * both Node.js and the Convex V8 runtime.
 */

const ALGORITHM = "AES-GCM"
const IV_LENGTH = 12 // Recommended for GCM
const AUTH_TAG_LENGTH_BITS = 128 // 16 bytes

// Helpers for hex conversion (since Buffer might not be available)
function hexToUint8Array(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error("Invalid hex string")
  const arr = new Uint8Array(hex.length / 2)
  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return arr
}

function uint8ArrayToHex(arr: Uint8Array): string {
  return Array.from(arr)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

async function getEncryptionKey() {
  const secret = process.env.ENCRYPTION_SECRET
  if (!secret) {
    throw new Error("ENCRYPTION_SECRET must be set for token security.")
  }
  
  // Create a 32-byte key from the secret using SHA-256
  const secretBuffer = new TextEncoder().encode(secret)
  const hash = await crypto.subtle.digest("SHA-256", secretBuffer)
  
  return await crypto.subtle.importKey(
    "raw",
    hash,
    ALGORITHM,
    false,
    ["encrypt", "decrypt"]
  )
}

export async function encrypt(text: string): Promise<string> {
  const key = await getEncryptionKey()
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const encodedText = new TextEncoder().encode(text)

  try {
    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: ALGORITHM, iv: iv as any, tagLength: AUTH_TAG_LENGTH_BITS },
      key,
      encodedText as any
    )

    const encryptedArray = new Uint8Array(encryptedBuffer)
    
    // Web Crypto appends the auth tag to the ciphertext
    const authTag = encryptedArray.slice(-16)
    const ciphertext = encryptedArray.slice(0, -16)

    return `${uint8ArrayToHex(iv)}:${uint8ArrayToHex(authTag)}:${uint8ArrayToHex(ciphertext)}`
  } catch (err) {
    throw new Error(`Encryption failed: ${String(err)}`)
  }
}

export async function decrypt(encryptedData: string): Promise<string> {
  if (!encryptedData.includes(":")) return encryptedData // Fallback for legacy unencrypted tokens

  const parts = encryptedData.split(":")
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted data format")
  }

  const [ivHex, authTagHex, encryptedTextHex] = parts
  const iv = hexToUint8Array(ivHex)
  const authTag = hexToUint8Array(authTagHex)
  const ciphertext = hexToUint8Array(encryptedTextHex)

  // Web Crypto expects ciphertext and tag together
  const dataToDecrypt = new Uint8Array(ciphertext.length + authTag.length)
  dataToDecrypt.set(ciphertext)
  dataToDecrypt.set(authTag, ciphertext.length)

  const key = await getEncryptionKey()

  try {
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv: iv as any, tagLength: AUTH_TAG_LENGTH_BITS },
      key,
      dataToDecrypt as any
    )

    return new TextDecoder().decode(decryptedBuffer)
  } catch (err) {
    throw new Error(`Decryption failed: ${String(err)}`)
  }
}



