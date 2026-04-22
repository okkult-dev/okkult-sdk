import { buildPoseidon } from 'circomlibjs'
import { groth16 } from 'snarkjs'
import { getAddress, randomBytes, hexlify } from 'ethers'

/**
 * Cached Poseidon instance for cryptographic operations.
 */
let poseidonInstance: any = null

/**
 * Initializes the Poseidon hash function instance.
 * Uses singleton pattern to avoid reinitialization.
 * @returns Promise resolving to the Poseidon instance.
 */
export async function initPoseidon(): Promise<any> {
  if (poseidonInstance) {
    return poseidonInstance
  }

  try {
    poseidonInstance = await buildPoseidon()
    console.log('Poseidon initialized successfully')
    return poseidonInstance
  } catch (error) {
    throw new Error(`Failed to initialize Poseidon: ${error}`)
  }
}

/**
 * Computes the Poseidon hash of the given inputs.
 * @param inputs Array of bigint values to hash.
 * @returns Hex string representation of the hash with 0x prefix.
 */
export async function poseidonHash(inputs: bigint[]): Promise<string> {
  const poseidon = await initPoseidon()
  try {
    const hash = poseidon(inputs)
    return '0x' + BigInt(poseidon.F.toString(hash)).toString(16).padStart(64, '0')
  } catch (error) {
    throw new Error(`Failed to compute Poseidon hash: ${error}`)
  }
}

/**
 * Computes a nullifier from an address and secret.
 * @param address Ethereum address as hex string.
 * @param secret Secret value as hex string.
 * @returns Promise resolving to nullifier as hex string with 0x prefix.
 */
export async function computeNullifier(address: string, secret: string): Promise<string> {
  try {
    const hash = await poseidonHash([BigInt(address), BigInt(secret)])
    return hash
  } catch (error) {
    throw new Error(`Failed to compute nullifier: ${error}`)
  }
}

/**
 * Generates a cryptographically secure random secret.
 * Detects environment and uses appropriate random source.
 * @returns Hex string representation of 32 random bytes with 0x prefix.
 */
export function generateSecret(): string {
  try {
    let randomBytesArray: Uint8Array

    if (typeof window !== 'undefined' && window.crypto) {
      // Browser environment
      randomBytesArray = new Uint8Array(32)
      window.crypto.getRandomValues(randomBytesArray)
    } else {
      // Node.js environment
      const crypto = require('crypto')
      randomBytesArray = crypto.randomBytes(32)
    }

    return '0x' + Array.from(randomBytesArray)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  } catch (error) {
    throw new Error(`Failed to generate secret: ${error}`)
  }
}

/**
 * Verifies a zero-knowledge proof locally by fetching the verification key.
 * @param proof The proof object to verify.
 * @param publicSignals Array of public signal strings.
 * @param vkeyUrl URL to fetch the verification key from.
 * @returns Promise resolving to boolean indicating proof validity.
 */
export async function verifyProofLocally(
  proof: any,
  publicSignals: string[],
  vkeyUrl: string
): Promise<boolean> {
  try {
    const response = await fetch(vkeyUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch verification key: ${response.statusText}`)
    }
    const vkey = await response.json()

    const isValid = await groth16.verify(vkey, publicSignals, proof)
    return isValid
  } catch (error) {
    console.error(`Proof verification failed: ${error}`)
    return false
  }
}

/**
 * Converts a hex string to a field element (decimal string).
 * @param hex Hex string with or without 0x prefix.
 * @returns Decimal string representation of the field element.
 */
export function hexToFieldElement(hex: string): string {
  try {
    const cleanHex = hex.startsWith('0x') ? hex : '0x' + hex
    return BigInt(cleanHex).toString()
  } catch (error) {
    throw new Error(`Failed to convert hex to field element: ${error}`)
  }
}

/**
 * Converts a field element (decimal string) to a hex string.
 * @param fieldEl Decimal string representation of the field element.
 * @returns Hex string with 0x prefix, padded to 32 bytes.
 */
export function fieldElementToHex(fieldEl: string): string {
  try {
    const hex = BigInt(fieldEl).toString(16).padStart(64, '0')
    return '0x' + hex
  } catch (error) {
    throw new Error(`Failed to convert field element to hex: ${error}`)
  }
}

/**
 * Converts an Ethereum address to a BigInt.
 * Normalizes the address first using ethers.
 * @param address Ethereum address as string.
 * @returns BigInt representation of the address.
 */
export function addressToBigInt(address: string): bigint {
  try {
    const normalizedAddress = getAddress(address)
    return BigInt(normalizedAddress)
  } catch (error) {
    throw new Error(`Failed to convert address to BigInt: ${error}`)
  }
}