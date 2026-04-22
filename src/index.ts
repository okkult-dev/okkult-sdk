// Okkult SDK — Public API

/**
 * Main SDK class and factory function.
 * Import these for basic usage.
 */
export { OkkultSDK, createOkkult } from './OkkultSDK'

/**
 * Individual modules for advanced usage.
 * Import these when you need direct module access.
 */
export { ProofModule } from './modules/ProofModule'
export { ComplianceModule } from './modules/ComplianceModule'
export { ShieldModule } from './modules/ShieldModule'
export { VoteModule } from './modules/VoteModule'
export { RelayModule } from './modules/RelayModule'

/**
 * All TypeScript types used in the SDK.
 * Import these for type annotations.
 */
export type {
  OkkultConfig,
  ZKProof,
  ComplianceProof,
  MerkleProofData,
  ComplianceStatus,
  UTXO,
  ShieldParams,
  UnshieldParams,
  TransferParams,
  ShieldResult,
  PollParams,
  VoteParams,
  PollResult,
  RelayParams,
  RelayResult,
  SDKResponse,
  TokenInfo,
} from './types'

/**
 * Error codes and supported tokens.
 * Import these for error handling and token operations.
 */
export { ErrorCode, SUPPORTED_TOKENS } from './types'

/**
 * Contract addresses and network constants.
 * Import these for advanced blockchain interactions.
 */
export { CONTRACT_ADDRESSES, CHAIN_IDS,
         SUBGRAPH_URLS, CIRCUIT_URLS } from './constants/addresses'

/**
 * Cryptographic and Merkle tree utilities.
 * Import these for advanced cryptographic operations.
 */
export { computeNullifier, generateSecret,
         initPoseidon } from './utils/crypto'
export { fetchMerkleProof,
         fetchCurrentRoot } from './utils/merkle'