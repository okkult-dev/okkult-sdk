import { groth16 } from 'snarkjs'
import { PublicClient, WalletClient, parseEther } from 'viem'

import {
  OkkultConfig,
  SDKResponse,
  ShieldParams,
  UnshieldParams,
  TransferParams,
  ShieldResult,
  UTXO
} from '../types'
import {
  initPoseidon,
  generateSecret,
  poseidonHash,
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
  SHIELD_ABI,
  ERC20_ABI,
  VERIFIER_ABI
} from '../constants/abis'

/**
 * Module for handling shielded pool operations.
 * Manages UTXO-based private token transfers with local storage.
 */
export class ShieldModule {
  private storage: Storage | null

  constructor(private config: OkkultConfig) {
    this.storage = typeof window !== 'undefined' ? window.localStorage : null
  }

  /**
   * Shields tokens into the private pool.
   * @param params Shield parameters.
   * @param walletClient Viem wallet client.
   * @param publicClient Viem public client.
   * @returns Promise resolving to SDKResponse with ShieldResult.
   */
  async shield(
    params: ShieldParams,
    walletClient: WalletClient,
    publicClient: PublicClient
  ): Promise<SDKResponse<ShieldResult>> {
    try {
      console.log('[SHIELD] Starting shield operation for token:', params.token)

      // Check compliance
      const verifierAddress = CONTRACT_ADDRESSES.ethereum.okkultVerifier as `0x${string}`
      const isCompliant = await publicClient.readContract({
        address: verifierAddress,
        abi: VERIFIER_ABI,
        functionName: 'hasValidProof',
        args: [walletClient.account.address as `0x${string}`]
      }) as boolean

      if (!isCompliant) {
        return {
          success: false,
          error: 'User is not compliant',
          code: 'INVALID_PROOF'
        }
      }

      // Initialize Poseidon
      await initPoseidon()

      // Generate secret and commitment
      const secret = generateSecret()
      const commitment = await poseidonHash([
        params.amount,
        BigInt(params.token),
        BigInt(secret),
        addressToBigInt(walletClient.account.address)
      ])

      console.log('[SHIELD] Generated commitment:', commitment)

      // Approve ERC20 spending
      const tokenAddress = params.token as `0x${string}`
      await walletClient.writeContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [CONTRACT_ADDRESSES.ethereum.okkultShield as `0x${string}`, params.amount]
      })

      // Generate shield proof
      const inputs = {
        amount: params.amount.toString(),
        token: BigInt(params.token).toString(),
        secret: BigInt(secret).toString(),
        owner: addressToBigInt(walletClient.account.address).toString()
      }

      console.log('[SHIELD] Generating shield proof')

      const [wasmResponse, zkeyResponse] = await Promise.all([
        fetch(CIRCUIT_URLS.shieldWasm),
        fetch(CIRCUIT_URLS.shieldZkey)
      ])

      const wasmBuffer = await wasmResponse.arrayBuffer()
      const zkeyBuffer = await zkeyResponse.arrayBuffer()

      const { proof } = await groth16.fullProve(
        inputs,
        new Uint8Array(wasmBuffer),
        new Uint8Array(zkeyBuffer)
      )

      // Call shield contract
      const shieldAddress = CONTRACT_ADDRESSES.ethereum.okkultShield as `0x${string}`
      const txHash = await walletClient.writeContract({
        address: shieldAddress,
        abi: SHIELD_ABI,
        functionName: 'shield',
        args: [
          params.token as `0x${string}`,
          params.amount,
          commitment as `0x${string}`,
          proof.pi_a,
          proof.pi_b,
          proof.pi_c
        ]
      })

      // Wait for confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })

      if (receipt.status !== 'success') {
        throw new Error('Shield transaction failed')
      }

      // Create and save UTXO
      const utxo: UTXO = {
        commitment,
        amount: params.amount,
        token: params.token,
        secret,
        owner: walletClient.account.address,
        leafIndex: Number(receipt.logs[0]?.topics[2] || 0), // Assuming event has leafIndex
        spent: false,
        createdAt: Date.now()
      }

      this.saveUTXO(utxo)

      const result: ShieldResult = {
        commitment,
        leafIndex: utxo.leafIndex,
        txHash,
        fee: parseEther('0.001') // Assuming fee
      }

      console.log('[SHIELD] Shield operation completed')

      return {
        success: true,
        data: result
      }
    } catch (error: any) {
      console.error('[SHIELD] Shield operation failed:', error)

      return {
        success: false,
        error: error.message || 'Shield operation failed',
        code: 'NETWORK_ERROR'
      }
    }
  }

  /**
   * Unshields tokens from the private pool.
   * @param params Unshield parameters.
   * @param walletClient Viem wallet client.
   * @returns Promise resolving to SDKResponse with transaction hash.
   */
  async unshield(
    params: UnshieldParams,
    walletClient: WalletClient
  ): Promise<SDKResponse<string>> {
    try {
      console.log('[SHIELD] Starting unshield operation')

      // Load UTXOs
      const utxos = this.loadUTXOs(walletClient.account.address)
      const utxo = utxos.find(u => !u.spent && u.token === params.token && u.amount >= params.amount)

      if (!utxo) {
        return {
          success: false,
          error: 'Insufficient UTXO balance',
          code: 'INSUFFICIENT_BALANCE'
        }
      }

      // Compute nullifier
      const nullifier = await poseidonHash([BigInt(utxo.commitment), BigInt(utxo.secret)])

      // Fetch Merkle proof
      const merkleProof = await fetchMerkleProof(utxo.commitment)
      if (!validateMerkleProof(merkleProof, utxo.owner)) {
        return {
          success: false,
          error: 'Invalid Merkle proof',
          code: 'INVALID_PROOF'
        }
      }

      const formattedProof = formatProofForCircuit(merkleProof)

      // Generate unshield proof
      const inputs = {
        nullifier: BigInt(nullifier).toString(),
        root: formattedProof.root,
        amount: params.amount.toString(),
        token: BigInt(params.token).toString(),
        recipient: addressToBigInt(params.recipient).toString(),
        pathElements: formattedProof.pathElements,
        pathIndices: formattedProof.pathIndices,
        leaf: BigInt(utxo.commitment).toString()
      }

      const [wasmResponse, zkeyResponse] = await Promise.all([
        fetch(CIRCUIT_URLS.shieldWasm),
        fetch(CIRCUIT_URLS.shieldZkey)
      ])

      const wasmBuffer = await wasmResponse.arrayBuffer()
      const zkeyBuffer = await zkeyResponse.arrayBuffer()

      const { proof } = await groth16.fullProve(
        inputs,
        new Uint8Array(wasmBuffer),
        new Uint8Array(zkeyBuffer)
      )

      // Call unshield contract
      const shieldAddress = CONTRACT_ADDRESSES.ethereum.okkultShield as `0x${string}`
      const txHash = await walletClient.writeContract({
        address: shieldAddress,
        abi: SHIELD_ABI,
        functionName: 'unshield',
        args: [
          params.token as `0x${string}`,
          params.amount,
          nullifier as `0x${string}`,
          merkleProof.root as `0x${string}`,
          params.recipient as `0x${string}`,
          proof.pi_a,
          proof.pi_b,
          proof.pi_c
        ]
      })

      // Mark UTXO as spent
      utxo.spent = true
      this.saveUTXO(utxo)

      console.log('[SHIELD] Unshield operation completed')

      return {
        success: true,
        data: txHash
      }
    } catch (error: any) {
      console.error('[SHIELD] Unshield operation failed:', error)

      return {
        success: false,
        error: error.message || 'Unshield operation failed',
        code: 'NETWORK_ERROR'
      }
    }
  }

  /**
   * Performs a private transfer between addresses.
   * @param params Transfer parameters.
   * @param walletClient Viem wallet client.
   * @returns Promise resolving to SDKResponse with transaction hash.
   */
  async privateTransfer(
    params: TransferParams,
    walletClient: WalletClient
  ): Promise<SDKResponse<string>> {
    try {
      console.log('[SHIELD] Starting private transfer')

      // Load UTXOs and find input
      const utxos = this.loadUTXOs(walletClient.account.address)
      const inputUtxo = utxos.find(u => !u.spent && u.token === params.token && u.amount >= params.amount)

      if (!inputUtxo) {
        return {
          success: false,
          error: 'Insufficient UTXO balance',
          code: 'INSUFFICIENT_BALANCE'
        }
      }

      const change = inputUtxo.amount - params.amount

      // Create output UTXOs
      const secret1 = generateSecret()
      const secret2 = generateSecret()

      const outCommitment1 = await poseidonHash([
        params.amount,
        BigInt(params.token),
        BigInt(secret1),
        addressToBigInt(params.recipient)
      ])

      const outCommitment2 = await poseidonHash([
        change,
        BigInt(params.token),
        BigInt(secret2),
        addressToBigInt(walletClient.account.address)
      ])

      // Compute input nullifier
      const inNullifier = await poseidonHash([BigInt(inputUtxo.commitment), BigInt(inputUtxo.secret)])

      // Fetch Merkle proof
      const merkleProof = await fetchMerkleProof(inputUtxo.commitment)
      if (!validateMerkleProof(merkleProof, inputUtxo.owner)) {
        return {
          success: false,
          error: 'Invalid Merkle proof',
          code: 'INVALID_PROOF'
        }
      }

      const formattedProof = formatProofForCircuit(merkleProof)

      // Generate transfer proof
      const inputs = {
        inNullifier: BigInt(inNullifier).toString(),
        outCommitment1: BigInt(outCommitment1).toString(),
        outCommitment2: BigInt(outCommitment2).toString(),
        root: formattedProof.root,
        amount: params.amount.toString(),
        token: BigInt(params.token).toString(),
        recipient: addressToBigInt(params.recipient).toString(),
        change: change.toString(),
        pathElements: formattedProof.pathElements,
        pathIndices: formattedProof.pathIndices,
        leaf: BigInt(inputUtxo.commitment).toString()
      }

      const [wasmResponse, zkeyResponse] = await Promise.all([
        fetch(CIRCUIT_URLS.shieldWasm),
        fetch(CIRCUIT_URLS.shieldZkey)
      ])

      const wasmBuffer = await wasmResponse.arrayBuffer()
      const zkeyBuffer = await zkeyResponse.arrayBuffer()

      const { proof } = await groth16.fullProve(
        inputs,
        new Uint8Array(wasmBuffer),
        new Uint8Array(zkeyBuffer)
      )

      // Call privateTransfer contract
      const shieldAddress = CONTRACT_ADDRESSES.ethereum.okkultShield as `0x${string}`
      const txHash = await walletClient.writeContract({
        address: shieldAddress,
        abi: SHIELD_ABI,
        functionName: 'privateTransfer',
        args: [
          inNullifier as `0x${string}`,
          outCommitment1 as `0x${string}`,
          outCommitment2 as `0x${string}`,
          merkleProof.root as `0x${string}`,
          proof.pi_a,
          proof.pi_b,
          proof.pi_c
        ]
      })

      // Update localStorage
      inputUtxo.spent = true
      this.saveUTXO(inputUtxo)

      // Save output UTXOs
      const outUtxo1: UTXO = {
        commitment: outCommitment1,
        amount: params.amount,
        token: params.token,
        secret: secret1,
        owner: params.recipient,
        leafIndex: 0, // Will be updated by event
        spent: false,
        createdAt: Date.now()
      }

      if (change > 0) {
        const outUtxo2: UTXO = {
          commitment: outCommitment2,
          amount: change,
          token: params.token,
          secret: secret2,
          owner: walletClient.account.address,
          leafIndex: 0,
          spent: false,
          createdAt: Date.now()
        }
        this.saveUTXO(outUtxo2)
      }

      this.saveUTXO(outUtxo1)

      console.log('[SHIELD] Private transfer completed')

      return {
        success: true,
        data: txHash
      }
    } catch (error: any) {
      console.error('[SHIELD] Private transfer failed:', error)

      return {
        success: false,
        error: error.message || 'Private transfer failed',
        code: 'NETWORK_ERROR'
      }
    }
  }

  /**
   * Gets the shielded balance for an owner and token.
   * @param owner Owner address.
   * @param token Token address.
   * @returns Promise resolving to SDKResponse with balance.
   */
  async getBalance(owner: string, token: string): Promise<SDKResponse<bigint>> {
    try {
      const utxos = this.loadUTXOs(owner)
      const balance = utxos
        .filter(u => u.token === token && !u.spent)
        .reduce((sum, u) => sum + u.amount, 0n)

      return {
        success: true,
        data: balance
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to get balance',
        code: 'UNKNOWN_ERROR'
      }
    }
  }

  /**
   * Gets all unspent UTXOs for an owner.
   * @param owner Owner address.
   * @returns Promise resolving to SDKResponse with UTXO array.
   */
  async getUTXOs(owner: string): Promise<SDKResponse<UTXO[]>> {
    try {
      const utxos = this.loadUTXOs(owner).filter(u => !u.spent)

      return {
        success: true,
        data: utxos
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to get UTXOs',
        code: 'UNKNOWN_ERROR'
      }
    }
  }

  /**
   * Saves a UTXO to localStorage.
   * @param utxo The UTXO to save.
   */
  private saveUTXO(utxo: UTXO): void {
    if (!this.storage) return

    try {
      const key = `okkult_utxo_${utxo.commitment}`
      this.storage.setItem(key, JSON.stringify(utxo))

      // Update index
      const indexKey = 'okkult_utxo_index'
      const currentIndex = JSON.parse(this.storage.getItem(indexKey) || '[]')
      if (!currentIndex.includes(utxo.commitment)) {
        currentIndex.push(utxo.commitment)
        this.storage.setItem(indexKey, JSON.stringify(currentIndex))
      }
    } catch (error) {
      console.warn('Failed to save UTXO to localStorage:', error)
    }
  }

  /**
   * Loads UTXOs for an owner from localStorage.
   * @param owner Owner address.
   * @returns Array of UTXOs.
   */
  private loadUTXOs(owner: string): UTXO[] {
    if (!this.storage) return []

    try {
      const indexKey = 'okkult_utxo_index'
      const commitments = JSON.parse(this.storage.getItem(indexKey) || '[]')
      const utxos: UTXO[] = []

      for (const commitment of commitments) {
        const key = `okkult_utxo_${commitment}`
        const data = this.storage.getItem(key)
        if (data) {
          const utxo = JSON.parse(data)
          if (utxo.owner === owner) {
            utxos.push(utxo)
          }
        }
      }

      return utxos
    } catch (error) {
      console.warn('Failed to load UTXOs from localStorage:', error)
      return []
    }
  }
}

export default ShieldModule