import { groth16 } from 'snarkjs'
import { PublicClient } from 'viem'

import {
  OkkultConfig,
  ComplianceProof,
  SDKResponse,
  ComplianceStatus,
  MerkleProofData
} from '../types'
import {
  initPoseidon,
  computeNullifier,
  verifyProofLocally,
  addressToBigInt
} from '../utils/crypto'
import {
  fetchMerkleProof,
  validateMerkleProof,
  formatProofForCircuit
} from '../utils/merkle'
import {
  CONTRACT_ADDRESSES,
  CIRCUIT_URLS,
  VERIFIER_ABI
} from '../constants/addresses'

/**
 * Module for handling zero-knowledge proof generation and verification.
 * Manages the complete lifecycle of compliance proofs for the Okkult protocol.
 */
export class ProofModule {
  constructor(private config: OkkultConfig) {}

  /**
   * Generates a compliance proof for the given address and secret.
   * Fetches Merkle proof, computes nullifier, and generates ZK proof.
   * @param address Ethereum address to generate proof for.
   * @param secret Secret value for proof generation.
   * @returns Promise resolving to SDKResponse with ComplianceProof or error.
   */
  async generate(address: string, secret: string): Promise<SDKResponse<ComplianceProof>> {
    try {
      console.log('[PROOF] Starting proof generation for address:', address)

      // Fetch Merkle proof
      console.log('[PROOF] Fetching Merkle proof')
      const merkleProof = await fetchMerkleProof(address)

      // Validate proof
      console.log('[PROOF] Validating Merkle proof')
      if (!validateMerkleProof(merkleProof, address)) {
        return {
          success: false,
          error: 'INVALID_PROOF',
          code: 'INVALID_PROOF'
        }
      }

      // Initialize Poseidon
      console.log('[PROOF] Initializing Poseidon')
      await initPoseidon()

      // Compute nullifier
      console.log('[PROOF] Computing nullifier')
      const nullifier = await computeNullifier(address, secret)

      // Format proof for circuit
      console.log('[PROOF] Formatting proof for circuit')
      const formattedProof = formatProofForCircuit(merkleProof)

      // Build circuit inputs
      const inputs = {
        address: addressToBigInt(address).toString(),
        secret: BigInt(secret).toString(),
        pathElements: formattedProof.pathElements,
        pathIndices: formattedProof.pathIndices,
        root: formattedProof.root,
        nullifier: BigInt(nullifier).toString()
      }

      console.log('[PROOF] Circuit inputs prepared')

      // Fetch circuit files
      console.log('[PROOF] Fetching circuit files')
      const [wasmResponse, zkeyResponse] = await Promise.all([
        fetch(CIRCUIT_URLS.complianceWasm),
        fetch(CIRCUIT_URLS.complianceZkey)
      ])

      if (!wasmResponse.ok || !zkeyResponse.ok) {
        throw new Error('Failed to fetch circuit files')
      }

      const wasmBuffer = await wasmResponse.arrayBuffer()
      const zkeyBuffer = await zkeyResponse.arrayBuffer()

      // Generate proof
      console.log('[PROOF] Generating ZK proof')
      const { proof, publicSignals } = await groth16.fullProve(
        inputs,
        new Uint8Array(wasmBuffer),
        new Uint8Array(zkeyBuffer)
      )

      // Build compliance proof
      const complianceProof: ComplianceProof = {
        proof: {
          pi_a: proof.pi_a,
          pi_b: proof.pi_b,
          pi_c: proof.pi_c
        },
        publicInputs: {
          root: '0x' + BigInt(publicSignals[0]).toString(16).padStart(64, '0'),
          nullifier: '0x' + BigInt(publicSignals[1]).toString(16).padStart(64, '0')
        },
        address,
        generatedAt: Date.now(),
        validUntil: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
      }

      console.log('[PROOF] Proof generation completed')

      return {
        success: true,
        data: complianceProof
      }
    } catch (error: any) {
      console.error('[PROOF] Proof generation failed:', error)

      if (error.message === 'SANCTIONED_ADDRESS') {
        return {
          success: false,
          error: 'Address is sanctioned',
          code: 'SANCTIONED_ADDRESS'
        }
      }

      return {
        success: false,
        error: error.message || 'Unknown error during proof generation',
        code: 'UNKNOWN_ERROR'
      }
    }
  }

  /**
   * Verifies a compliance proof locally.
   * @param proof The ComplianceProof to verify.
   * @returns Promise resolving to SDKResponse with boolean verification result.
   */
  async verifyLocally(proof: ComplianceProof): Promise<SDKResponse<boolean>> {
    try {
      console.log('[PROOF] Starting local proof verification')

      const isValid = await verifyProofLocally(
        proof.proof,
        [proof.publicInputs.root, proof.publicInputs.nullifier],
        CIRCUIT_URLS.vKey
      )

      console.log('[PROOF] Local verification result:', isValid)

      return {
        success: true,
        data: isValid
      }
    } catch (error: any) {
      console.error('[PROOF] Local verification failed:', error)

      return {
        success: false,
        error: error.message || 'Verification failed',
        code: 'UNKNOWN_ERROR'
      }
    }
  }

  /**
   * Gets the compliance status for an address from the blockchain.
   * @param address Ethereum address to check.
   * @param publicClient Viem public client for blockchain calls.
   * @returns Promise resolving to SDKResponse with ComplianceStatus.
   */
  async getStatus(address: string, publicClient: PublicClient): Promise<SDKResponse<ComplianceStatus>> {
    try {
      console.log('[PROOF] Checking compliance status for address:', address)

      const verifierAddress = CONTRACT_ADDRESSES.ethereum.okkultVerifier as `0x${string}`

      // Check if address has valid proof
      const hasValidProof = await publicClient.readContract({
        address: verifierAddress,
        abi: VERIFIER_ABI,
        functionName: 'hasValidProof',
        args: [address as `0x${string}`]
      }) as boolean

      let validUntil: number | null = null
      let expiredAt: number | null = null

      if (hasValidProof) {
        validUntil = await publicClient.readContract({
          address: verifierAddress,
          abi: VERIFIER_ABI,
          functionName: 'proofExpiry',
          args: [address as `0x${string}`]
        }) as number

        const now = Math.floor(Date.now() / 1000)
        if (validUntil < now) {
          expiredAt = validUntil
          validUntil = null
        }
      }

      const status: ComplianceStatus = {
        address,
        isValid: hasValidProof && validUntil !== null,
        validUntil,
        expiredAt
      }

      console.log('[PROOF] Compliance status retrieved:', status)

      return {
        success: true,
        data: status
      }
    } catch (error: any) {
      console.error('[PROOF] Status check failed:', error)

      return {
        success: false,
        error: error.message || 'Failed to get compliance status',
        code: 'NETWORK_ERROR'
      }
    }
  }

  /**
   * Formats a compliance proof for on-chain submission.
   * Converts proof components to BigInt arrays as expected by Solidity.
   * @param proof The ComplianceProof to format.
   * @returns Object with proof components formatted for chain submission.
   */
  static formatForChain(proof: ComplianceProof): {
    proof_a: readonly [bigint, bigint]
    proof_b: readonly [[bigint, bigint], [bigint, bigint]]
    proof_c: readonly [bigint, bigint]
    publicInputs: readonly [bigint, bigint]
  } {
    console.log('[PROOF] Formatting proof for chain submission')

    return {
      proof_a: [BigInt(proof.proof.pi_a[0]), BigInt(proof.proof.pi_a[1])] as const,
      proof_b: [
        [BigInt(proof.proof.pi_b[0][0]), BigInt(proof.proof.pi_b[0][1])],
        [BigInt(proof.proof.pi_b[1][0]), BigInt(proof.proof.pi_b[1][1])]
      ] as const,
      proof_c: [BigInt(proof.proof.pi_c[0]), BigInt(proof.proof.pi_c[1])] as const,
      publicInputs: [
        BigInt(proof.publicInputs.root),
        BigInt(proof.publicInputs.nullifier)
      ] as const
    }
  }
}

export default ProofModule