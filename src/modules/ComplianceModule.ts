import {
  createPublicClient,
  createWalletClient,
  http,
  PublicClient,
  WalletClient,
  parseEther,
  mainnet
} from 'viem'

import {
  OkkultConfig,
  ComplianceProof,
  SDKResponse,
  ComplianceStatus
} from '../types'
import {
  CONTRACT_ADDRESSES,
  VERIFIER_ABI,
  CHAINALYSIS_ABI
} from '../constants/abis'
import { ProofModule } from './ProofModule'

/**
 * Module for handling on-chain compliance interactions.
 * Manages proof submission, status checking, and real-time event watching.
 */
export class ComplianceModule {
  private publicClient: PublicClient

  constructor(private config: OkkultConfig) {
    this.publicClient = createPublicClient({
      chain: mainnet,
      transport: http(config.rpcUrl ?? 'https://cloudflare-eth.com')
    })
  }

  /**
   * Checks the compliance status of an address on-chain.
   * @param address Ethereum address to check.
   * @returns Promise resolving to SDKResponse with ComplianceStatus.
   */
  async checkStatus(address: string): Promise<SDKResponse<ComplianceStatus>> {
    try {
      console.log('[COMPLIANCE] Checking status for address:', address)

      const verifierAddress = CONTRACT_ADDRESSES.ethereum.okkultVerifier as `0x${string}`

      // Check if address has valid proof
      const hasValidProof = await this.publicClient.readContract({
        address: verifierAddress,
        abi: VERIFIER_ABI,
        functionName: 'hasValidProof',
        args: [address as `0x${string}`]
      }) as boolean

      let validUntil: number | null = null
      let expiredAt: number | null = null

      if (hasValidProof) {
        validUntil = Number(await this.publicClient.readContract({
          address: verifierAddress,
          abi: VERIFIER_ABI,
          functionName: 'proofExpiry',
          args: [address as `0x${string}`]
        }))

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

      console.log('[COMPLIANCE] Status check completed:', status)

      return {
        success: true,
        data: status
      }
    } catch (error: any) {
      console.error('[COMPLIANCE] Status check failed:', error)

      return {
        success: false,
        error: error.message || 'Failed to check compliance status',
        code: 'NETWORK_ERROR'
      }
    }
  }

  /**
   * Submits a compliance proof on-chain.
   * @param proof The ComplianceProof to submit.
   * @param walletClient Viem wallet client for transaction signing.
   * @returns Promise resolving to SDKResponse with transaction hash.
   */
  async submitProof(
    proof: ComplianceProof,
    walletClient: WalletClient
  ): Promise<SDKResponse<string>> {
    try {
      console.log('[COMPLIANCE] Submitting proof for address:', proof.address)

      // Format proof for chain
      const formattedProof = ProofModule.formatForChain(proof)

      const verifierAddress = CONTRACT_ADDRESSES.ethereum.okkultVerifier as `0x${string}`

      // Submit proof transaction
      const hash = await walletClient.writeContract({
        address: verifierAddress,
        abi: VERIFIER_ABI,
        functionName: 'verifyProof',
        args: [
          formattedProof.proof_a,
          formattedProof.proof_b,
          formattedProof.proof_c,
          formattedProof.publicInputs
        ],
        value: parseEther('0.001')
      })

      // Wait for confirmation
      console.log('[COMPLIANCE] Waiting for transaction confirmation')
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash })

      if (receipt.status === 'success') {
        console.log('[COMPLIANCE] Proof submitted successfully:', hash)
        return {
          success: true,
          data: hash
        }
      } else {
        throw new Error('Transaction failed')
      }
    } catch (error: any) {
      console.error('[COMPLIANCE] Proof submission failed:', error)

      return {
        success: false,
        error: error.message || 'Failed to submit proof',
        code: 'NETWORK_ERROR'
      }
    }
  }

  /**
   * Generates and submits a compliance proof in one operation.
   * @param address Ethereum address.
   * @param secret Secret for proof generation.
   * @param walletClient Viem wallet client.
   * @param proofModule Instance of ProofModule for proof generation.
   * @returns Promise resolving to SDKResponse with transaction hash.
   */
  async proveAndSubmit(
    address: string,
    secret: string,
    walletClient: WalletClient,
    proofModule: ProofModule
  ): Promise<SDKResponse<string>> {
    try {
      console.log('[COMPLIANCE] Starting prove and submit for address:', address)

      // Check if already compliant
      const statusResponse = await this.checkStatus(address)
      if (!statusResponse.success) {
        return statusResponse
      }

      if (statusResponse.data!.isValid) {
        return {
          success: false,
          error: 'Address is already compliant',
          code: 'UNKNOWN_ERROR'
        }
      }

      // Generate proof
      console.log('[COMPLIANCE] Generating proof')
      const proofResponse = await proofModule.generate(address, secret)
      if (!proofResponse.success) {
        return proofResponse
      }

      const proof = proofResponse.data!

      // Verify locally first
      console.log('[COMPLIANCE] Verifying proof locally')
      const verifyResponse = await proofModule.verifyLocally(proof)
      if (!verifyResponse.success || !verifyResponse.data) {
        return {
          success: false,
          error: 'Local proof verification failed',
          code: 'INVALID_PROOF'
        }
      }

      // Submit on-chain
      console.log('[COMPLIANCE] Submitting proof on-chain')
      const submitResponse = await this.submitProof(proof, walletClient)

      return submitResponse
    } catch (error: any) {
      console.error('[COMPLIANCE] Prove and submit failed:', error)

      return {
        success: false,
        error: error.message || 'Prove and submit operation failed',
        code: 'UNKNOWN_ERROR'
      }
    }
  }

  /**
   * Watches for proof verification events in real-time.
   * @param onProof Callback function called for each ProofVerified event.
   * @returns Function to stop watching events.
   */
  watchProofEvents(
    onProof: (event: {
      prover: string
      nullifier: string
      validUntil: number
    }) => void
  ): () => void {
    console.log('[COMPLIANCE] Starting event watcher for proof verifications')

    const verifierAddress = CONTRACT_ADDRESSES.ethereum.okkultVerifier as `0x${string}`

    const unwatch = this.publicClient.watchContractEvent({
      address: verifierAddress,
      abi: VERIFIER_ABI,
      eventName: 'ProofVerified',
      onLogs: (logs) => {
        logs.forEach((log) => {
          const event = {
            prover: log.args.prover as string,
            nullifier: log.args.nullifier as string,
            validUntil: Number(log.args.validUntil)
          }
          console.log('[COMPLIANCE] Proof verified event:', event)
          onProof(event)
        })
      }
    })

    return () => {
      console.log('[COMPLIANCE] Stopping event watcher')
      unwatch()
    }
  }

  /**
   * Checks if an address is sanctioned using the Chainalysis oracle.
   * @param address Ethereum address to check.
   * @returns Promise resolving to boolean indicating sanction status.
   */
  async isSanctioned(address: string): Promise<boolean> {
    try {
      console.log('[COMPLIANCE] Checking sanction status for address:', address)

      const oracleAddress = CONTRACT_ADDRESSES.ethereum.chainalysisOracle as `0x${string}`

      const sanctioned = await this.publicClient.readContract({
        address: oracleAddress,
        abi: CHAINALYSIS_ABI,
        functionName: 'isSanctioned',
        args: [address as `0x${string}`]
      }) as boolean

      console.log('[COMPLIANCE] Sanction check result:', sanctioned)

      return sanctioned
    } catch (error: any) {
      console.error('[COMPLIANCE] Sanction check failed:', error)
      // Fail open for better UX
      return false
    }
  }
}

export default ComplianceModule