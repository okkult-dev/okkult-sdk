import { keccak256, encodeAbiParameters } from 'viem'
import { encrypt } from 'ethers'

import {
  OkkultConfig,
  SDKResponse,
  RelayParams,
  RelayResult
} from '../types'
import {
  API_URLS,
  CONTRACT_ADDRESSES
} from '../constants/addresses'
// Assume RELAY_ABI is defined, but since not in constants, I'll define it here or assume
// For simplicity, assume RELAY_ABI has relay and getRelayerPubkey

const RELAY_ABI = [
  {
    type: "function",
    name: "relay",
    inputs: [
      { name: "encryptedTx", type: "bytes" },
      { name: "commitment", type: "bytes32" },
      { name: "feeAmount", type: "uint256" },
      { name: "feeToken", type: "address" }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "getRelayerPubkey",
    inputs: [{ name: "relayer", type: "address" }],
    outputs: [{ name: "", type: "bytes" }],
    stateMutability: "view"
  },
  {
    type: "event",
    name: "TransactionRelayed",
    inputs: [
      { name: "commitment", type: "bytes32", indexed: true },
      { name: "relayer", type: "address", indexed: true },
      { name: "ethTxHash", type: "bytes32", indexed: false },
      { name: "fee", type: "uint256", indexed: false }
    ],
    anonymous: false
  }
] as const

/**
 * Module for submitting transactions via the Okkult Relay network.
 * Enables anonymous transaction broadcasting with ERC-20 fee payment.
 */
export class RelayModule {
  constructor(private config: OkkultConfig) {}

  /**
   * Gets the list of active relayers from the API.
   * @returns Promise resolving to SDKResponse with array of relayer addresses.
   */
  async getActiveRelayers(): Promise<SDKResponse<string[]>> {
    try {
      console.log('[RELAY] Fetching active relayers')

      const response = await fetch(API_URLS.relayers)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const relayers: string[] = await response.json()

      console.log('[RELAY] Active relayers:', relayers.length)

      return {
        success: true,
        data: relayers
      }
    } catch (error: any) {
      console.error('[RELAY] Failed to get active relayers:', error)

      return {
        success: false,
        error: error.message || 'Failed to fetch relayers',
        code: 'NETWORK_ERROR'
      }
    }
  }

  /**
   * Estimates the relay fee in the specified token.
   * @param feeToken The ERC-20 token address for fee payment.
   * @param publicClient Viem public client.
   * @returns Promise resolving to SDKResponse with estimated fee amount.
   */
  async estimateFee(
    feeToken: string,
    publicClient: any
  ): Promise<SDKResponse<bigint>> {
    try {
      console.log('[RELAY] Estimating fee for token:', feeToken)

      const gasPrice = await publicClient.getGasPrice()
      // Simple estimation: gasPrice * 21000 * 2 (assuming 1 ETH ≈ 2000 tokens) + 10% buffer
      const estimatedFee = (gasPrice * 21000n * 2n * 11n) / 10n

      console.log('[RELAY] Estimated fee:', estimatedFee.toString())

      return {
        success: true,
        data: estimatedFee
      }
    } catch (error: any) {
      console.error('[RELAY] Fee estimation failed:', error)

      return {
        success: false,
        error: error.message || 'Fee estimation failed',
        code: 'NETWORK_ERROR'
      }
    }
  }

  /**
   * Submits a transaction through the relay network.
   * @param params Relay parameters.
   * @param walletClient Viem wallet client.
   * @param publicClient Viem public client.
   * @returns Promise resolving to SDKResponse with RelayResult.
   */
  async submit(
    params: RelayParams,
    walletClient: any,
    publicClient: any
  ): Promise<SDKResponse<RelayResult>> {
    try {
      console.log('[RELAY] Submitting transaction via relay')

      // Get active relayers
      const relayersResponse = await this.getActiveRelayers()
      if (!relayersResponse.success) {
        return relayersResponse
      }

      const relayers = relayersResponse.data!
      if (relayers.length === 0) {
        return {
          success: false,
          error: 'No active relayers available',
          code: 'NETWORK_ERROR'
        }
      }

      // Pick random relayer
      const randomRelayer = relayers[Math.floor(Math.random() * relayers.length)]

      // Get relayer public key
      const relayAddress = CONTRACT_ADDRESSES.ethereum.okkultRelay as `0x${string}`
      const pubkeyBytes = await publicClient.readContract({
        address: relayAddress,
        abi: RELAY_ABI,
        functionName: 'getRelayerPubkey',
        args: [randomRelayer as `0x${string}`]
      }) as `0x${string}`

      // Serialize transaction data
      const txData = {
        to: params.to,
        data: params.data,
        value: params.value || 0n,
        gasLimit: 21000n // Default
      }
      const serializedTx = JSON.stringify(txData)

      // Encrypt transaction data
      const encryptedTx = await encrypt(pubkeyBytes, serializedTx)

      // Compute commitment
      const commitment = keccak256(encryptedTx as `0x${string}`)

      // Approve fee token
      const feeTokenAddress = params.feeToken as `0x${string}`
      await walletClient.writeContract({
        address: feeTokenAddress,
        abi: [
          {
            type: "function",
            name: "approve",
            inputs: [
              { name: "spender", type: "address" },
              { name: "amount", type: "uint256" }
            ],
            outputs: [{ name: "", type: "bool" }],
            stateMutability: "nonpayable"
          }
        ],
        functionName: 'approve',
        args: [relayAddress, params.feeAmount]
      })

      // Submit to relay
      const txHash = await walletClient.writeContract({
        address: relayAddress,
        abi: RELAY_ABI,
        functionName: 'relay',
        args: [
          encryptedTx,
          commitment,
          params.feeAmount,
          params.feeToken as `0x${string}`
        ]
      })

      // Wait for relay event
      const result = await this.watchResult(txHash, publicClient, 60000)

      if (!result.success) {
        return result
      }

      const relayResult: RelayResult = {
        txHash: result.data!,
        relayer: randomRelayer,
        fee: params.feeAmount,
        timestamp: Date.now()
      }

      console.log('[RELAY] Transaction relayed successfully')

      return {
        success: true,
        data: relayResult
      }
    } catch (error: any) {
      console.error('[RELAY] Relay submission failed:', error)

      return {
        success: false,
        error: error.message || 'Relay submission failed',
        code: 'NETWORK_ERROR'
      }
    }
  }

  /**
   * Watches for the relay result of a submitted transaction.
   * @param txHash The relay transaction hash to watch.
   * @param publicClient Viem public client.
   * @param timeout Timeout in milliseconds (default 60 seconds).
   * @returns Promise resolving to SDKResponse with the Ethereum transaction hash.
   */
  async watchResult(
    txHash: string,
    publicClient: any,
    timeout: number = 60000
  ): Promise<SDKResponse<string>> {
    return new Promise((resolve) => {
      console.log('[RELAY] Watching for relay result:', txHash)

      const relayAddress = CONTRACT_ADDRESSES.ethereum.okkultRelay as `0x${string}`

      const unwatch = publicClient.watchContractEvent({
        address: relayAddress,
        abi: RELAY_ABI,
        eventName: 'TransactionRelayed',
        onLogs: (logs: any[]) => {
          const relevantLog = logs.find(log => log.transactionHash === txHash)
          if (relevantLog) {
            console.log('[RELAY] Relay result found:', relevantLog.args.ethTxHash)
            unwatch()
            resolve({
              success: true,
              data: relevantLog.args.ethTxHash
            })
          }
        }
      })

      // Timeout
      setTimeout(() => {
        unwatch()
        console.log('[RELAY] Relay watch timed out')
        resolve({
          success: false,
          error: 'Relay timeout',
          code: 'NETWORK_ERROR'
        })
      }, timeout)
    })
  }
}

export default RelayModule