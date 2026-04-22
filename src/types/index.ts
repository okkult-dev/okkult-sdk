// ── SDK Config ────────────────────────────────────────

/**
 * Configuration interface for the Okkult SDK.
 * Defines the blockchain network and optional connection parameters.
 */
export interface OkkultConfig {
  chain:    'ethereum'
  rpcUrl?:  string        // optional — uses default if not set
  wsUrl?:   string        // optional WebSocket for real-time
  apiKey?:  string        // optional premium API key
}

// ── Proof Types ───────────────────────────────────────

/**
 * Represents a zero-knowledge proof structure.
 * Contains the proof components as arrays of strings.
 */
export interface ZKProof {
  pi_a: string[]
  pi_b: string[][]
  pi_c: string[]
}

/**
 * Compliance proof for verifying user compliance with privacy protocols.
 * Includes the ZK proof, public inputs, and metadata.
 */
export interface ComplianceProof {
  proof:       ZKProof
  publicInputs: {
    root:      string    // hex with 0x prefix
    nullifier: string    // hex with 0x prefix
  }
  address:     string
  generatedAt: number    // unix timestamp
  validUntil:  number    // unix timestamp
}

/**
 * Data structure for Merkle tree proofs.
 * Used to verify inclusion in a Merkle tree.
 */
export interface MerkleProofData {
  root:         string
  pathElements: string[]
  pathIndices:  number[]
  leaf:         string
}

// ── Compliance Types ──────────────────────────────────

/**
 * Status of compliance for a given address.
 * Indicates validity, expiration, and optional reason for invalidity.
 */
export interface ComplianceStatus {
  address:    string
  isValid:    boolean
  validUntil: number | null    // null if no proof
  expiredAt?: number | null
  reason?:    string
}

// ── Shield Types ──────────────────────────────────────

/**
 * Unspent Transaction Output (UTXO) structure for shielded transactions.
 * Represents a shielded asset with its metadata.
 */
export interface UTXO {
  commitment:  string
  amount:      bigint
  token:       string
  secret:      string
  owner:       string
  leafIndex:   number
  spent:       boolean
  createdAt:   number
}

/**
 * Parameters for shielding tokens into the privacy pool.
 */
export interface ShieldParams {
  token:  string    // ERC-20 token address
  amount: bigint    // amount to shield
}

/**
 * Parameters for unshielding tokens from the privacy pool.
 */
export interface UnshieldParams {
  token:     string
  amount:    bigint
  recipient: string    // recipient address
}

/**
 * Parameters for transferring shielded tokens between users.
 */
export interface TransferParams {
  token:     string
  amount:    bigint
  recipient: string    // 0zk address of recipient
}

/**
 * Result of a shield operation.
 * Contains the commitment, leaf index, transaction hash, and fee.
 */
export interface ShieldResult {
  commitment: string
  leafIndex:  number
  txHash:     string
  fee:        bigint
}

// ── Vote Types ────────────────────────────────────────

/**
 * Parameters for creating a new poll.
 * Defines the poll's metadata and eligibility criteria.
 */
export interface PollParams {
  title:       string
  description: string
  voterRoot:   string    // Merkle root of eligible voters
  startTime:   number    // unix timestamp
  endTime:     number    // unix timestamp
}

/**
 * Parameters for casting a vote in a poll.
 * Includes voter information and proof of eligibility.
 */
export interface VoteParams {
  pollId:       number
  voterAddress: string
  voterSecret:  string
  voteChoice:   0 | 1    // 0 = no, 1 = yes
  voterRoot:    string
  pathElements: string[]
  pathIndices:  number[]
}

/**
 * Result of a poll after tallying votes.
 * Contains the vote counts and tally status.
 */
export interface PollResult {
  pollId:     number
  totalYes:   number
  totalNo:    number
  totalVotes: number
  tallied:    boolean
}

// ── Relay Types ───────────────────────────────────────

/**
 * Parameters for relaying a transaction through the network.
 * Defines the target contract, data, and fee payment.
 */
export interface RelayParams {
  to:        string    // contract to call
  data:      string    // calldata
  value?:    bigint    // ETH value
  feeToken:  string    // token to pay relay fee
  feeAmount: bigint    // relay fee amount
}

/**
 * Result of a relay operation.
 * Contains transaction details and fee information.
 */
export interface RelayResult {
  txHash:    string
  relayer:   string
  fee:       bigint
  timestamp: number
}

// ── SDK Response Wrapper ──────────────────────────────

/**
 * Generic response wrapper for SDK operations.
 * Provides success status, data, and error information.
 */
export interface SDKResponse<T> {
  success: boolean
  data?:   T
  error?:  string
  code?:   ErrorCode
}

// ── Error Codes ───────────────────────────────────────

/**
 * Enumeration of possible error codes in the SDK.
 * Used for categorizing and handling different types of errors.
 */
export enum ErrorCode {
  SANCTIONED_ADDRESS    = 'SANCTIONED_ADDRESS',
  INSUFFICIENT_FEE      = 'INSUFFICIENT_FEE',
  INVALID_PROOF         = 'INVALID_PROOF',
  NULLIFIER_USED        = 'NULLIFIER_USED',
  TREE_OUTDATED         = 'TREE_OUTDATED',
  INSUFFICIENT_BALANCE  = 'INSUFFICIENT_BALANCE',
  NO_UTXO_FOUND         = 'NO_UTXO_FOUND',
  NETWORK_ERROR         = 'NETWORK_ERROR',
  UNKNOWN_ERROR         = 'UNKNOWN_ERROR',
}

// ── Token Constants ───────────────────────────────────

/**
 * Information about a supported token.
 * Includes symbol, contract address, and decimal places.
 */
export interface TokenInfo {
  symbol:   string
  address:  string
  decimals: number
}

/**
 * Record of supported tokens with their information.
 * Currently includes major stablecoins and wrapped tokens.
 */
export const SUPPORTED_TOKENS: Record<string, TokenInfo> = {
  USDC: {
    symbol:   'USDC',
    address:  '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    decimals: 6
  },
  WETH: {
    symbol:   'WETH',
    address:  '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    decimals: 18
  },
  WBTC: {
    symbol:   'WBTC',
    address:  '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    decimals: 8
  },
  DAI: {
    symbol:   'DAI',
    address:  '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    decimals: 18
  }
}