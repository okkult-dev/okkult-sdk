import {
  OkkultConfig,
  SDKResponse,
  ComplianceStatus,
  ComplianceProof,
  ShieldParams,
  ShieldResult,
  UnshieldParams,
  VoteParams,
  RelayParams,
  RelayResult
} from './types'

import { ProofModule } from './modules/ProofModule'
import { ComplianceModule } from './modules/ComplianceModule'
import { ShieldModule } from './modules/ShieldModule'
import { VoteModule } from './modules/VoteModule'
import { RelayModule } from './modules/RelayModule'

// Import constants if needed, but not used in this file
// import { ... } from './constants/'

/**
 * Main SDK class for Okkult Protocol.
 * Provides unified access to all zero-knowledge privacy features including
 * compliance proofs, shielded transactions, voting, and transaction relaying.
 */
export class OkkultSDK {
  public readonly proof: ProofModule
  public readonly compliance: ComplianceModule
  public readonly shield: ShieldModule
  public readonly vote: VoteModule
  public readonly relay: RelayModule

  private config: OkkultConfig

  constructor(config: OkkultConfig) {
    this.config = config
    this.proof = new ProofModule(config)
    this.compliance = new ComplianceModule(config)
    this.shield = new ShieldModule(config)
    this.vote = new VoteModule(config)
    this.relay = new RelayModule(config)
  }

  /**
   * Checks compliance status for an address.
   * @param address Ethereum address to check.
   * @returns Promise resolving to SDKResponse with ComplianceStatus.
   */
  async checkCompliance(address: string): Promise<SDKResponse<ComplianceStatus>> {
    return this.compliance.checkStatus(address)
  }

  /**
   * Generates a compliance proof for the given address and secret.
   * @param address Ethereum address.
   * @param secret Secret value for proof generation.
   * @returns Promise resolving to SDKResponse with ComplianceProof.
   */
  async generateProof(address: string, secret: string): Promise<SDKResponse<ComplianceProof>> {
    return this.proof.generate(address, secret)
  }

  /**
   * Submits a compliance proof on-chain.
   * @param proof The ComplianceProof to submit.
   * @param walletClient Viem wallet client.
   * @returns Promise resolving to SDKResponse with transaction hash.
   */
  async submitProof(proof: ComplianceProof, walletClient: any): Promise<SDKResponse<string>> {
    return this.compliance.submitProof(proof, walletClient)
  }

  /**
   * Generates and submits a compliance proof in one operation.
   * @param address Ethereum address.
   * @param secret Secret value.
   * @param walletClient Viem wallet client.
   * @returns Promise resolving to SDKResponse with transaction hash.
   */
  async proveAndSubmit(
    address: string,
    secret: string,
    walletClient: any
  ): Promise<SDKResponse<string>> {
    return this.compliance.proveAndSubmit(address, secret, walletClient, this.proof)
  }

  /**
   * Shields tokens into the private pool.
   * @param params Shield parameters.
   * @param walletClient Viem wallet client.
   * @param publicClient Viem public client.
   * @returns Promise resolving to SDKResponse with ShieldResult.
   */
  async shield(params: ShieldParams, walletClient: any, publicClient: any): Promise<SDKResponse<ShieldResult>> {
    return this.shield.shield(params, walletClient, publicClient)
  }

  /**
   * Unshields tokens from the private pool.
   * @param params Unshield parameters.
   * @param walletClient Viem wallet client.
   * @returns Promise resolving to SDKResponse with transaction hash.
   */
  async unshield(params: UnshieldParams, walletClient: any): Promise<SDKResponse<string>> {
    return this.shield.unshield(params, walletClient)
  }

  /**
   * Casts an anonymous vote in a poll.
   * @param params Vote parameters.
   * @param walletClient Viem wallet client.
   * @returns Promise resolving to SDKResponse with transaction hash.
   */
  async castVote(params: VoteParams, walletClient: any): Promise<SDKResponse<string>> {
    return this.vote.castVote(params, walletClient)
  }

  /**
   * Submits a transaction through the relay network.
   * @param params Relay parameters.
   * @param walletClient Viem wallet client.
   * @param publicClient Viem public client.
   * @returns Promise resolving to SDKResponse with RelayResult.
   */
  async relay(params: RelayParams, walletClient: any, publicClient: any): Promise<SDKResponse<RelayResult>> {
    return this.relay.submit(params, walletClient, publicClient)
  }

  /**
   * Gets the current SDK version.
   * @returns SDK version string.
   */
  getVersion(): string {
    return '1.0.0'
  }

  /**
   * Gets the current SDK configuration (without sensitive data).
   * @returns OkkultConfig object.
   */
  getConfig(): OkkultConfig {
    // Return config without apiKey for security
    const { apiKey, ...safeConfig } = this.config
    return safeConfig
  }
}

/**
 * Factory function to create an OkkultSDK instance.
 * @param config OkkultConfig for SDK initialization.
 * @returns New OkkultSDK instance.
 */
export function createOkkult(config: OkkultConfig): OkkultSDK {
  return new OkkultSDK(config)
}

export default OkkultSDK