import { OkkultSDK } from '../src/OkkultSDK'
import { ErrorCode } from '../src/types'

// Mock external dependencies
jest.mock('viem', () => ({
  createPublicClient: jest.fn(),
  createWalletClient: jest.fn(),
  http: jest.fn(),
  mainnet: {},
  parseEther: jest.fn(),
}))

jest.mock('snarkjs', () => ({
  groth16: {
    fullProve: jest.fn(),
    verify: jest.fn(),
  },
}))

jest.mock('circomlibjs', () => ({
  buildPoseidon: jest.fn(),
}))

jest.mock('ethers', () => ({
  encrypt: jest.fn(),
  getAddress: jest.fn(),
  randomBytes: jest.fn(),
  hexlify: jest.fn(),
}))

// Mock fetch globally
global.fetch = jest.fn()

describe('OkkultSDK', () => {
  let sdk: OkkultSDK

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks()

    // Create fresh SDK instance
    sdk = new OkkultSDK({
      chain: 'ethereum',
      rpcUrl: 'https://test.rpc.url',
      apiKey: 'test-api-key'
    })
  })

  describe('initialization', () => {
    test('creates SDK with valid config', () => {
      expect(sdk.proof).toBeDefined()
      expect(sdk.compliance).toBeDefined()
      expect(sdk.shield).toBeDefined()
      expect(sdk.vote).toBeDefined()
      expect(sdk.relay).toBeDefined()
    })

    test('getVersion returns string', () => {
      const version = sdk.getVersion()
      expect(typeof version).toBe('string')
      expect(version.length).toBeGreaterThan(0)
    })

    test('getConfig returns config without sensitive data', () => {
      const config = sdk.getConfig()
      expect(config.chain).toBe('ethereum')
      expect(config.rpcUrl).toBe('https://test.rpc.url')
      expect(config.apiKey).toBeUndefined() // Should be omitted
    })
  })

  describe('checkCompliance', () => {
    test('returns valid status for compliant address', async () => {
      const mockStatus = {
        address: '0x123',
        isValid: true,
        validUntil: Date.now() + 86400000,
        validUntil: Date.now() + 86400000,
        expiredAt: null
      }

      jest.spyOn(sdk.compliance, 'checkStatus').mockResolvedValue({
        success: true,
        data: mockStatus
      })

      const result = await sdk.checkCompliance('0x123')

      expect(result.success).toBe(true)
      expect(result.data!.isValid).toBe(true)
      expect(result.data!.validUntil).toBeGreaterThan(Date.now())
    })

    test('returns invalid status for non-compliant address', async () => {
      const mockStatus = {
        address: '0x456',
        isValid: false,
        validUntil: null,
        expiredAt: null
      }

      jest.spyOn(sdk.compliance, 'checkStatus').mockResolvedValue({
        success: true,
        data: mockStatus
      })

      const result = await sdk.checkCompliance('0x456')

      expect(result.success).toBe(true)
      expect(result.data!.isValid).toBe(false)
      expect(result.data!.validUntil).toBeNull()
    })
  })

  describe('generateProof', () => {
    test('generates proof for clean address', async () => {
      const mockProof = {
        proof: {
          pi_a: ['1', '2'],
          pi_b: [['3', '4'], ['5', '6']],
          pi_c: ['7', '8']
        },
        publicInputs: {
          root: '0x123',
          nullifier: '0x456'
        },
        address: '0x123',
        generatedAt: Date.now(),
        validUntil: Date.now() + 86400000
      }

      jest.spyOn(sdk.proof, 'generate').mockResolvedValue({
        success: true,
        data: mockProof
      })

      const result = await sdk.generateProof('0x123', 'secret')

      expect(result.success).toBe(true)
      expect(result.data!.proof.pi_a).toEqual(['1', '2'])
      expect(result.data!.publicInputs.nullifier).toBe('0x456')
    })

    test('returns error for sanctioned address', async () => {
      jest.spyOn(sdk.proof, 'generate').mockResolvedValue({
        success: false,
        error: 'Address is sanctioned',
        code: ErrorCode.SANCTIONED_ADDRESS
      })

      const result = await sdk.generateProof('0x123', 'secret')

      expect(result.success).toBe(false)
      expect(result.code).toBe(ErrorCode.SANCTIONED_ADDRESS)
    })
  })

  describe('proveAndSubmit', () => {
    test('skips proof generation if already compliant', async () => {
      const mockStatus = {
        address: '0x123',
        isValid: true,
        validUntil: Date.now() + 86400000,
        expiredAt: null
      }

      jest.spyOn(sdk.compliance, 'checkStatus').mockResolvedValue({
        success: true,
        data: mockStatus
      })

      const generateSpy = jest.spyOn(sdk.proof, 'generate')

      const result = await sdk.proveAndSubmit('0x123', 'secret', {} as any)

      expect(generateSpy).not.toHaveBeenCalled()
      expect(result.success).toBe(false)
      expect(result.error).toContain('already compliant')
    })

    test('generates and submits if not compliant', async () => {
      const mockStatus = {
        address: '0x123',
        isValid: false,
        validUntil: null,
        expiredAt: null
      }

      const mockProof = {
        proof: { pi_a: [], pi_b: [], pi_c: [] },
        publicInputs: { root: '0x', nullifier: '0x' },
        address: '0x123',
        generatedAt: Date.now(),
        validUntil: Date.now() + 86400000
      }

      jest.spyOn(sdk.compliance, 'checkStatus').mockResolvedValue({
        success: true,
        data: mockStatus
      })

      jest.spyOn(sdk.proof, 'generate').mockResolvedValue({
        success: true,
        data: mockProof
      })

      jest.spyOn(sdk.proof, 'verifyLocally').mockResolvedValue({
        success: true,
        data: true
      })

      jest.spyOn(sdk.compliance, 'proveAndSubmit').mockResolvedValue({
        success: true,
        data: '0xtxHash'
      })

      const result = await sdk.proveAndSubmit('0x123', 'secret', {} as any)

      expect(result.success).toBe(true)
      expect(result.data).toBe('0xtxHash')
    })
  })

  describe('error handling', () => {
    test('handles network errors gracefully', async () => {
      // Mock fetch to throw network error
      ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

      jest.spyOn(sdk.proof, 'generate').mockRejectedValue(new Error('Network error'))

      const result = await sdk.generateProof('0x123', 'secret')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Network error')
      expect(result.code).toBe(ErrorCode.UNKNOWN_ERROR)
    })
  })
})