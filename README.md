# okkult-sdk

```bash
$ npm install @okkult/sdk
```

---

## Usage

```typescript
import { OkkultSDK } from '@okkult/sdk'

const okkult = new OkkultSDK({ chain: 'ethereum' })

// Check compliance
const status = await okkult.checkCompliance(address)

// Generate + submit proof
await okkult.proveAndSubmit(address, secret, signer)

// Shield assets
await okkult.shield({ token, amount }, walletClient, publicClient)

// Cast private vote
await okkult.castVote({ pollId, voteChoice: 1 }, walletClient)
```

---

## Modules

```bash
$ ls src/modules/
> ProofModule      → ZK proof generation
> ComplianceModule → On-chain compliance check
> ShieldModule     → Shield / unshield assets
> VoteModule       → Private governance
> RelayModule      → Gas-free transaction relay
```

---

## Part of Okkult Protocol

```bash
$ cat ecosystem.txt
> okkult-proof      Core ZK compliance circuit
> okkult-sdk        ← you are here
> okkult-contracts  Smart contracts
> okkult-circuits   ZK circuits
> okkult-app        Frontend
> okkult-subgraph   The Graph indexer
> okkult-docs       Documentation
```

---

## License

```bash
$ cat license.txt
> MIT — okkult.io · @Okkult_
```
