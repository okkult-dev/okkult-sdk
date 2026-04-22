/**
 * Central registry of all deployed contract addresses for Ethereum mainnet.
 * Single source of truth for all contract addresses used across the SDK.
 */
export const CONTRACT_ADDRESSES = {
  ethereum: {
    // Okkult Core
    okkultVerifier:    '0x' as `0x${string}`,
    okkultShield:      '0x' as `0x${string}`,
    okkultVote:        '0x' as `0x${string}`,
    complianceTree:    '0x' as `0x${string}`,
    nullifierRegistry: '0x' as `0x${string}`,
    kultToken:         '0x' as `0x${string}`,

    // External — Ecosystem
    chainalysisOracle: '0x40C57923924B5c5c5455c48D93317139ADDaC8fb' as `0x${string}`,
    railgunShield:     '0xFA7093CDD9EE6932B4eb2c9e1cde7CE00B1FA4b9' as `0x${string}`,
    uniswapV3Router:   '0xE592427A0AEce92De3Edee1F18E0157C05861564' as `0x${string}`,
    aavePool:          '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2' as `0x${string}`,
  }
} as const

/**
 * Chain IDs for supported networks.
 */
export const CHAIN_IDS = {
  ethereum: 1,
} as const

/**
 * Subgraph URLs for querying blockchain data.
 */
export const SUBGRAPH_URLS = {
  ethereum: 'https://api.thegraph.com/subgraphs/name/okkult/okkult-mainnet'
} as const

/**
 * API endpoints for Okkult services.
 */
export const API_URLS = {
  merkleProof:  'https://api.okkult.io/v1/merkle-proof',
  treeRoot:     'https://api.okkult.io/v1/tree/root',
  relayers:     'https://api.okkult.io/v1/relayers',
} as const

/**
 * URLs for zero-knowledge circuit files.
 */
export const CIRCUIT_URLS = {
  complianceWasm: 'https://cdn.okkult.io/circuits/compliance.wasm',
  complianceZkey: 'https://cdn.okkult.io/circuits/compliance_final.zkey',
  vKey:           'https://cdn.okkult.io/circuits/verification_key.json',
  shieldWasm:     'https://cdn.okkult.io/circuits/shield.wasm',
  shieldZkey:     'https://cdn.okkult.io/circuits/shield_final.zkey',
  voteWasm:       'https://cdn.okkult.io/circuits/vote.wasm',
  voteZkey:       'https://cdn.okkult.io/circuits/vote_final.zkey',
} as const