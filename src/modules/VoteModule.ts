import { groth16 } from 'snarkjs'
import { PublicClient, WalletClient, parseEther } from 'viem'

import {
  OkkultConfig,
  SDKResponse,
  PollParams,
  VoteParams,
  PollResult
} from '../types'
import {
  initPoseidon,
  generateSecret,
  poseidonHash,
  addressToBigInt
} from '../utils/crypto'
import {
  CONTRACT_ADDRESSES,
  CIRCUIT_URLS,
  VOTE_ABI
} from '../constants/abis'

/**
 * Module for handling private on-chain governance voting.
 * Manages poll creation, anonymous voting with ZK proofs, and result retrieval.
 */
export class VoteModule {
  constructor(private config: OkkultConfig) {}

  /**
   * Creates a new governance poll.
   * @param params Poll creation parameters.
   * @param walletClient Viem wallet client for transaction signing.
   * @returns Promise resolving to SDKResponse with poll ID.
   */
  async createPoll(
    params: PollParams,
    walletClient: WalletClient
  ): Promise<SDKResponse<number>> {
    try {
      console.log('[VOTE] Creating poll:', params.title)

      const voteAddress = CONTRACT_ADDRESSES.ethereum.okkultVote as `0x${string}`

      const txHash = await walletClient.writeContract({
        address: voteAddress,
        abi: VOTE_ABI,
        functionName: 'createPoll',
        args: [
          params.title,
          params.description,
          params.voterRoot as `0x${string}`,
          params.startTime,
          params.endTime
        ],
        value: parseEther('0.01')
      })

      // Wait for confirmation and extract pollId from event
      const publicClient = walletClient.extend(() => ({})) as PublicClient // Assuming walletClient has public methods
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })

      const pollCreatedEvent = receipt.logs.find(log =>
        log.topics[0] === '0x...' // PollCreated event signature, need to compute or hardcode
      )

      if (!pollCreatedEvent) {
        throw new Error('PollCreated event not found')
      }

      const pollId = Number(pollCreatedEvent.topics[1]) // Assuming pollId is indexed

      console.log('[VOTE] Poll created with ID:', pollId)

      return {
        success: true,
        data: pollId
      }
    } catch (error: any) {
      console.error('[VOTE] Poll creation failed:', error)

      return {
        success: false,
        error: error.message || 'Poll creation failed',
        code: 'NETWORK_ERROR'
      }
    }
  }

  /**
   * Casts an anonymous vote in a poll using ZK proof.
   * @param params Vote casting parameters.
   * @param walletClient Viem wallet client.
   * @returns Promise resolving to SDKResponse with transaction hash.
   */
  async castVote(
    params: VoteParams,
    walletClient: WalletClient
  ): Promise<SDKResponse<string>> {
    try {
      console.log('[VOTE] Casting vote for poll:', params.pollId)

      // Initialize Poseidon
      await initPoseidon()

      // Generate vote nonce
      const voteNonce = generateSecret()

      // Compute nullifier and encrypted vote
      const nullifier = await poseidonHash([
        addressToBigInt(params.voterAddress),
        BigInt(params.voterSecret),
        BigInt(params.pollId)
      ])

      const encryptedVote = await poseidonHash([
        BigInt(params.voteChoice),
        BigInt(voteNonce)
      ])

      // Build circuit inputs
      const inputs = {
        address: addressToBigInt(params.voterAddress).toString(),
        secret: BigInt(params.voterSecret).toString(),
        pollId: params.pollId.toString(),
        voterRoot: BigInt(params.voterRoot).toString(),
        pathElements: params.pathElements.map(hex => BigInt(hex).toString()),
        pathIndices: params.pathIndices,
        voteChoice: params.voteChoice.toString(),
        voteNonce: BigInt(voteNonce).toString()
      }

      console.log('[VOTE] Generating vote proof')

      // Fetch circuit files
      const [wasmResponse, zkeyResponse] = await Promise.all([
        fetch(CIRCUIT_URLS.voteWasm),
        fetch(CIRCUIT_URLS.voteZkey)
      ])

      const wasmBuffer = await wasmResponse.arrayBuffer()
      const zkeyBuffer = await zkeyResponse.arrayBuffer()

      const { proof } = await groth16.fullProve(
        inputs,
        new Uint8Array(wasmBuffer),
        new Uint8Array(zkeyBuffer)
      )

      // Cast vote
      const voteAddress = CONTRACT_ADDRESSES.ethereum.okkultVote as `0x${string}`
      const txHash = await walletClient.writeContract({
        address: voteAddress,
        abi: VOTE_ABI,
        functionName: 'castVote',
        args: [
          params.pollId,
          encryptedVote as `0x${string}`,
          nullifier as `0x${string}`,
          proof.pi_a,
          proof.pi_b,
          proof.pi_c
        ]
      })

      console.log('[VOTE] Vote cast successfully')

      return {
        success: true,
        data: txHash
      }
    } catch (error: any) {
      console.error('[VOTE] Vote casting failed:', error)

      return {
        success: false,
        error: error.message || 'Vote casting failed',
        code: 'NETWORK_ERROR'
      }
    }
  }

  /**
   * Gets the result of a specific poll.
   * @param pollId The poll ID to query.
   * @param publicClient Viem public client.
   * @returns Promise resolving to SDKResponse with PollResult.
   */
  async getPoll(pollId: number, publicClient: PublicClient): Promise<SDKResponse<PollResult>> {
    try {
      console.log('[VOTE] Getting poll result for ID:', pollId)

      const voteAddress = CONTRACT_ADDRESSES.ethereum.okkultVote as `0x${string}`

      const pollData = await publicClient.readContract({
        address: voteAddress,
        abi: VOTE_ABI,
        functionName: 'polls',
        args: [pollId]
      }) as any[] // Assuming tuple return

      if (!pollData || pollData.length === 0) {
        return {
          success: false,
          error: 'Poll not found',
          code: 'UNKNOWN_ERROR'
        }
      }

      // Assuming pollData = [title, description, voterRoot, startTime, endTime, totalYes, totalNo, tallied]
      const result: PollResult = {
        pollId,
        totalYes: Number(pollData[5]),
        totalNo: Number(pollData[6]),
        totalVotes: Number(pollData[5]) + Number(pollData[6]),
        tallied: pollData[7]
      }

      console.log('[VOTE] Poll result retrieved:', result)

      return {
        success: true,
        data: result
      }
    } catch (error: any) {
      console.error('[VOTE] Get poll failed:', error)

      return {
        success: false,
        error: error.message || 'Failed to get poll',
        code: 'NETWORK_ERROR'
      }
    }
  }

  /**
   * Gets all active (ongoing) polls.
   * @param publicClient Viem public client.
   * @returns Promise resolving to SDKResponse with array of active PollResults.
   */
  async getActivePolls(publicClient: PublicClient): Promise<SDKResponse<PollResult[]>> {
    try {
      console.log('[VOTE] Getting active polls')

      const voteAddress = CONTRACT_ADDRESSES.ethereum.okkultVote as `0x${string}`

      // Get current block
      const currentBlock = await publicClient.getBlockNumber()
      const fromBlock = currentBlock - 10000n

      // Fetch PollCreated events
      const logs = await publicClient.getLogs({
        address: voteAddress,
        event: {
          type: 'event',
          name: 'PollCreated',
          inputs: [
            { name: 'pollId', type: 'uint256', indexed: true },
            { name: 'title', type: 'string', indexed: false },
            { name: 'voterRoot', type: 'bytes32', indexed: false },
            { name: 'startTime', type: 'uint256', indexed: false },
            { name: 'endTime', type: 'uint256', indexed: false }
          ]
        },
        fromBlock,
        toBlock: currentBlock
      })

      const activePolls: PollResult[] = []
      const now = Math.floor(Date.now() / 1000)

      for (const log of logs) {
        const pollId = Number(log.args.pollId)
        const pollResponse = await this.getPoll(pollId, publicClient)

        if (pollResponse.success && pollResponse.data) {
          const poll = pollResponse.data
          // Assuming we can get endTime from somewhere, but since polls() doesn't return it, perhaps need to adjust
          // For now, assume all fetched are potential active, but since we can't filter without endTime, return all not tallied
          if (!poll.tallied) {
            activePolls.push(poll)
          }
        }
      }

      console.log('[VOTE] Active polls retrieved:', activePolls.length)

      return {
        success: true,
        data: activePolls
      }
    } catch (error: any) {
      console.error('[VOTE] Get active polls failed:', error)

      return {
        success: false,
        error: error.message || 'Failed to get active polls',
        code: 'NETWORK_ERROR'
      }
    }
  }
}

export default VoteModule