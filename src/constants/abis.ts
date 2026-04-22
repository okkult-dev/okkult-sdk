/**
 * ABI for the Okkult Verifier contract.
 * Handles zero-knowledge proof verification and compliance checks.
 */
export const VERIFIER_ABI = [
  {
    type: "function",
    name: "verifyProof",
    inputs: [
      { name: "", type: "uint256[2]" },
      { name: "", type: "uint256[2][2]" },
      { name: "", type: "uint256[2]" },
      { name: "", type: "uint256[2]" }
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "payable"
  },
  {
    type: "function",
    name: "hasValidProof",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "proofExpiry",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "event",
    name: "ProofVerified",
    inputs: [
      { name: "prover", type: "address", indexed: true },
      { name: "nullifier", type: "bytes32", indexed: true },
      { name: "validUntil", type: "uint256", indexed: false }
    ],
    anonymous: false
  }
] as const

/**
 * ABI for the Okkult Shield contract.
 * Manages shielded transactions, deposits, and withdrawals.
 */
export const SHIELD_ABI = [
  {
    type: "function",
    name: "shield",
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "commitment", type: "bytes32" },
      { name: "", type: "uint256[2]" },
      { name: "", type: "uint256[2][2]" },
      { name: "", type: "uint256[2]" }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "unshield",
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "nullifier", type: "bytes32" },
      { name: "root", type: "bytes32" },
      { name: "recipient", type: "address" },
      { name: "", type: "uint256[2]" },
      { name: "", type: "uint256[2][2]" },
      { name: "", type: "uint256[2]" }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "privateTransfer",
    inputs: [
      { name: "inNullifier", type: "bytes32" },
      { name: "outCommitment1", type: "bytes32" },
      { name: "outCommitment2", type: "bytes32" },
      { name: "root", type: "bytes32" },
      { name: "", type: "uint256[2]" },
      { name: "", type: "uint256[2][2]" },
      { name: "", type: "uint256[2]" }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "isCompliant",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view"
  },
  {
    type: "event",
    name: "Shielded",
    inputs: [
      { name: "commitment", type: "bytes32", indexed: true },
      { name: "leafIndex", type: "uint256", indexed: true },
      { name: "token", type: "address", indexed: false },
      { name: "fee", type: "uint256", indexed: false }
    ],
    anonymous: false
  },
  {
    type: "event",
    name: "Unshielded",
    inputs: [
      { name: "nullifier", type: "bytes32", indexed: true },
      { name: "recipient", type: "address", indexed: true },
      { name: "token", type: "address", indexed: false },
      { name: "amount", type: "uint256", indexed: false }
    ],
    anonymous: false
  },
  {
    type: "event",
    name: "PrivateTransfer",
    inputs: [
      { name: "inNullifier", type: "bytes32", indexed: true },
      { name: "outCommitment1", type: "bytes32", indexed: true },
      { name: "outCommitment2", type: "bytes32", indexed: false }
    ],
    anonymous: false
  }
] as const

/**
 * ABI for the Okkult Vote contract.
 * Handles anonymous voting with zero-knowledge proofs.
 */
export const VOTE_ABI = [
  {
    type: "function",
    name: "createPoll",
    inputs: [
      { name: "title", type: "string" },
      { name: "description", type: "string" },
      { name: "voterRoot", type: "bytes32" },
      { name: "startTime", type: "uint256" },
      { name: "endTime", type: "uint256" }
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "payable"
  },
  {
    type: "function",
    name: "castVote",
    inputs: [
      { name: "pollId", type: "uint256" },
      { name: "encryptedVote", type: "bytes32" },
      { name: "nullifier", type: "bytes32" },
      { name: "", type: "uint256[2]" },
      { name: "", type: "uint256[2][2]" },
      { name: "", type: "uint256[2]" }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "tallyVotes",
    inputs: [
      { name: "pollId", type: "uint256" },
      { name: "totalYes", type: "uint256" },
      { name: "totalNo", type: "uint256" },
      { name: "", type: "uint256[2]" },
      { name: "", type: "uint256[2][2]" },
      { name: "", type: "uint256[2]" }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "polls",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [{ name: "", type: "tuple" }],
    stateMutability: "view"
  },
  {
    type: "event",
    name: "PollCreated",
    inputs: [
      { name: "pollId", type: "uint256", indexed: true },
      { name: "title", type: "string", indexed: false },
      { name: "voterRoot", type: "bytes32", indexed: false },
      { name: "startTime", type: "uint256", indexed: false },
      { name: "endTime", type: "uint256", indexed: false }
    ],
    anonymous: false
  },
  {
    type: "event",
    name: "VoteCast",
    inputs: [
      { name: "pollId", type: "uint256", indexed: true },
      { name: "nullifier", type: "bytes32", indexed: true },
      { name: "encryptedVote", type: "bytes32", indexed: false }
    ],
    anonymous: false
  },
  {
    type: "event",
    name: "PollTallied",
    inputs: [
      { name: "pollId", type: "uint256", indexed: true },
      { name: "totalYes", type: "uint256", indexed: false },
      { name: "totalNo", type: "uint256", indexed: false },
      { name: "totalVotes", type: "uint256", indexed: false }
    ],
    anonymous: false
  }
] as const

/**
 * Standard ERC20 token ABI.
 * Used for interacting with ERC20 tokens.
 */
export const ERC20_ABI = [
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "allowance",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" }
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "transfer",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "decimals",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "symbol",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view"
  }
] as const

/**
 * ABI for the Chainalysis Oracle contract.
 * Used to check if an address is sanctioned.
 */
export const CHAINALYSIS_ABI = [
  {
    type: "function",
    name: "isSanctioned",
    inputs: [{ name: "addr", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view"
  }
] as const