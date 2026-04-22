import { MerkleProofData } from '../types'
import { API_URLS } from '../constants/addresses'

/**
 * Fetches a Merkle proof for the given address from the Okkult API.
 * @param address Ethereum address to fetch proof for.
 * @returns Promise resolving to MerkleProofData.
 * @throws Error if address is sanctioned (403) or network error occurs.
 */
export async function fetchMerkleProof(address: string): Promise<MerkleProofData> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

  try {
    const response = await fetch(API_URLS.merkleProof, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ address }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (response.status === 403) {
      throw new Error('SANCTIONED_ADDRESS')
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch Merkle proof: ${response.status} ${response.statusText}`)
    }

    const data: MerkleProofData = await response.json()
    return data
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timed out')
    }
    throw error
  }
}

/**
 * Fetches the current Merkle tree root from the Okkult API.
 * @returns Promise resolving to the root as a hex string.
 * @throws Error on network failure.
 */
export async function fetchCurrentRoot(): Promise<string> {
  try {
    const response = await fetch(API_URLS.treeRoot)

    if (!response.ok) {
      throw new Error(`Failed to fetch tree root: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    return data.root
  } catch (error) {
    throw new Error(`Network error fetching tree root: ${error}`)
  }
}

/**
 * Validates a Merkle proof structure.
 * Checks lengths, indices validity, and root format.
 * @param proof The MerkleProofData to validate.
 * @param address The address (currently unused but kept for future extension).
 * @returns True if proof is valid, false otherwise.
 */
export function validateMerkleProof(proof: MerkleProofData, address: string): boolean {
  try {
    // Check pathElements length (assuming 20 levels for the tree)
    if (!Array.isArray(proof.pathElements) || proof.pathElements.length !== 20) {
      return false
    }

    // Check pathIndices length
    if (!Array.isArray(proof.pathIndices) || proof.pathIndices.length !== 20) {
      return false
    }

    // Check each pathIndex is 0 or 1
    for (const index of proof.pathIndices) {
      if (typeof index !== 'number' || (index !== 0 && index !== 1)) {
        return false
      }
    }

    // Check root is valid bytes32 hex
    if (typeof proof.root !== 'string' ||
        !proof.root.startsWith('0x') ||
        proof.root.length !== 66 ||
        !/^0x[0-9a-fA-F]{64}$/.test(proof.root)) {
      return false
    }

    // Check leaf is valid bytes32 hex
    if (typeof proof.leaf !== 'string' ||
        !proof.leaf.startsWith('0x') ||
        proof.leaf.length !== 66 ||
        !/^0x[0-9a-fA-F]{64}$/.test(proof.leaf)) {
      return false
    }

    return true
  } catch (error) {
    return false
  }
}

/**
 * Formats a Merkle proof for use in circom circuits.
 * Converts hex values to BigInt decimal strings.
 * @param proof The MerkleProofData to format.
 * @returns Object with pathElements, pathIndices, and root as circuit-compatible formats.
 */
export function formatProofForCircuit(proof: MerkleProofData): {
  pathElements: string[]
  pathIndices: number[]
  root: string
} {
  try {
    const pathElements = proof.pathElements.map(hex => BigInt(hex).toString())
    const pathIndices = proof.pathIndices
    const root = BigInt(proof.root).toString()

    return {
      pathElements,
      pathIndices,
      root,
    }
  } catch (error) {
    throw new Error(`Failed to format proof for circuit: ${error}`)
  }
}