export const knowledgeBase = [

  // ============================================================
  // A. ARC BASICS
  // ============================================================
  {
    id: "arc-basics-1",
    keywords: ["evm compatible", "solidity arc", "ethereum compatible", "existing code arc", "evm arc"],
    title: "Is Arc EVM-compatible? Can I use my existing Solidity code?",
    content: `
SHORT_ANSWER:
Yes. Arc is fully EVM-compatible. Your existing Solidity contracts, Hardhat/Foundry configs, and Ethereum libraries work on Arc with minimal changes. The main difference is gas is paid in USDC, not ETH.

EXPLANATION:
Arc is built as an EVM-compatible Layer-1 blockchain. This means:
- All standard Solidity versions (including 0.8.x) work
- Hardhat, Foundry, Remix, Truffle all work
- ethers.js, viem, wagmi all work
- ERC-20, ERC-721, ERC-1155 standards all work
- OpenZeppelin contracts work without modification
The key difference: USDC replaces ETH as the gas token. You must have USDC to pay transaction fees — no ETH needed.

GUIDE:
Step 1: Change your RPC to https://rpc.mainnet.arc.io
Step 2: Change chain ID to 5042002
Step 3: Make sure your deployer wallet has MAINNET USDC (for gas)
Step 4: Deploy exactly as you would on Ethereum

KEY DIFFERENCES FROM ETHEREUM:
- Gas paid in USDC (not ETH)
- Sub-second deterministic finality (no waiting for confirmations)
- No reorg risk
- USDC has 6 decimals for ERC-20, 18 decimals for native gas

SOURCE:
docs.arc.io/arc/references/evm-compatibility.md
`
  },

  {
    id: "arc-basics-2",
    keywords: ["hardhat arc", "foundry arc", "remix arc", "tools arc", "developer tools arc"],
    title: "What developer tools work on Arc?",
    content: `
SHORT_ANSWER:
All standard Ethereum developer tools work on Arc — Hardhat, Foundry, Remix, Truffle, ethers.js, viem, wagmi, and OpenZeppelin.

FULL LIST OF SUPPORTED TOOLS:
- Hardhat (recommended for most projects)
- Foundry (fastest for testing)
- Remix IDE (browser-based, good for quick deploys)
- Truffle (legacy support)
- ethers.js v5 and v6
- viem (modern, recommended)
- wagmi (React hooks for wallet connection)
- OpenZeppelin Contracts
- Chainlink (oracle support)
- Thirdweb
- Alchemy (RPC provider)

GUIDE (Hardhat setup):
Step 1: npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
Step 2: In hardhat.config.ts, add:
networks: {
  arcMAINNET: {
    url: "https://rpc.mainnet.arc.io",
    chainId: 5042002,
    accounts: [process.env.PRIVATE_KEY],
  }
}
Step 3: npx hardhat run scripts/deploy.ts --network arcMAINNET

SOURCE:
docs.arc.io/arc/tutorials/deploy-on-arc.md
`
  },

  {
    id: "arc-basics-3",
    keywords: ["arc vs ethereum", "arc vs l2", "arc vs base", "arc vs arbitrum", "why arc", "arc different"],
    title: "How is Arc different from Ethereum Layer-2s like Base or Arbitrum?",
    content: `
SHORT_ANSWER:
Arc is a standalone Layer-1 blockchain, not a Layer-2. It's purpose-built for stablecoin payments with USDC as native gas, sub-second finality, and direct Circle integration — unlike L2s which inherit Ethereum's security and token model.

KEY DIFFERENCES:
| Feature | Arc | Base/Arbitrum (L2) |
|---|---|---|
| Type | L1 blockchain | L2 on Ethereum |
| Gas token | USDC (stable) | ETH (volatile) |
| Finality | Sub-second, deterministic | Seconds to minutes |
| Fee stability | Stable, predictable | Volatile with ETH price |
| Purpose | Stablecoin payments | General-purpose |
| Circle integration | Native, deep | Third-party |
| Reorg risk | None (BFT consensus) | Low but possible |

WHY BUILD ON ARC INSTEAD:
- No ETH price exposure for gas costs
- Predictable fees (bounded at ~$0.01/tx)
- Faster finality for payment apps
- Native USDC integration
- Designed for financial apps, not gaming/NFTs

SOURCE:
docs.arc.io/arc/concepts/system-overview.md
`
  },

  {
    id: "arc-basics-4",
    keywords: ["malachite", "consensus arc", "arc consensus", "bft arc", "tendermint arc"],
    title: "What is Arc's consensus mechanism? What is Malachite?",
    content: `
SHORT_ANSWER:
Arc uses Malachite — a Rust implementation of Tendermint-style Byzantine Fault Tolerant (BFT) consensus. It achieves deterministic finality as soon as 2/3 of validators commit a block, typically in under 1 second.

EXPLANATION:
Malachite is Arc's high-performance consensus engine:
- Based on Tendermint BFT algorithm
- Written in Rust for performance
- Proof-of-Authority at launch (permissioned validator set)
- Finality is deterministic — no probabilistic confirmation needed
- Open source on GitHub under Circle's organization

HOW FINALITY WORKS:
1. Block is proposed by a validator
2. Validators vote in two rounds (prevote + precommit)
3. When 2/3+ validators precommit → block is FINAL
4. No rollbacks, no reorgs possible after finality

PRACTICAL IMPACT:
- Your dApp can treat a transaction as final immediately
- No need to wait for 6 confirmations like Ethereum
- Eliminates reorg risk for payment applications

SOURCE:
docs.arc.io/arc/concepts/deterministic-finality.md
`
  },

  {
    id: "arc-basics-5",
    keywords: ["arc tps", "arc speed", "block time arc", "transactions per second", "arc performance"],
    title: "What is Arc's TPS and block time?",
    content: `
SHORT_ANSWER:
Arc supports 20 million gas/second throughput with sub-second block times. Finality is deterministic and instant — no waiting for confirmations.

SPECS:
- Gas throughput: 20M gas/second
- Finality: Sub-second (deterministic)
- Block time: Sub-second
- Base fee target: ~$0.01 per transaction
- Max base fee: 1e-3 USDC (~$0.001 per gas unit)

NOTE:
Arc MAINNET has processed over 244M transactions as of May 2026. Mainnet specs may differ slightly. Performance is optimized for financial transactions, not gaming or high-frequency NFT minting.

SOURCE:
docs.arc.io/arc/references/gas-and-fees.md
`
  },

  {
    id: "arc-basics-6",
    keywords: ["account abstraction arc", "aa arc", "smart account arc", "paymaster arc"],
    title: "Does Arc support account abstraction?",
    content: `
SHORT_ANSWER:
Yes. Arc supports account abstraction (AA) through third-party AA providers and paymasters listed in the Arc documentation.

EXPLANATION:
Account abstraction on Arc allows:
- Smart contract wallets instead of EOAs
- Gasless transactions via paymasters
- Batch transactions
- Social recovery wallets
- Custom signing logic

Arc uses SCA (Smart Contract Account) wallets in Circle's developer-controlled wallet system. These are AA-compatible wallets.

GUIDE:
Step 1: Check AA providers at docs.arc.io/arc/tools/account-abstraction.md
Step 2: Choose an AA provider compatible with Arc
Step 3: Deploy your AA wallet contract
Step 4: Use paymaster to sponsor gas if needed

SOURCE:
docs.arc.io/arc/tools/account-abstraction.md
`
  },

  // ============================================================
  // B. SETUP & CONFIGURATION
  // ============================================================
  {
    id: "setup-1",
    keywords: ["add arc MAINNET metamask", "metamask arc setup", "connect arc metamask", "arc network metamask"],
    title: "How do I add Arc MAINNET to MetaMask?",
    content: `
SHORT_ANSWER:
Open MetaMask → Settings → Networks → Add network manually → enter the details below → Save.

NETWORK DETAILS:
- Network name: Arc MAINNET
- New RPC URL: https://rpc.mainnet.arc.io
- Chain ID: 5042002
- Currency symbol: USDC
- Block Explorer URL: https://explorer.arc.io

STEP-BY-STEP:
Step 1: Open MetaMask browser extension
Step 2: Click the network selector at the top center
Step 3: Click "Add Network"
Step 4: Click "Add a network manually"
Step 5: Fill in the fields above
Step 6: Click "Save"
Step 7: Click "Switch to Arc MAINNET"

PROGRAMMATIC (for dApps):
await window.ethereum.request({
  method: "wallet_addEthereumChain",
  params: [{
    chainId: "0x13b2",
    chainName: "Arc MAINNET",
    nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
    rpcUrls: ["https://rpc.mainnet.arc.io"],
    blockExplorerUrls: ["https://explorer.arc.io"],
  }],
});

NOTE: MetaMask may show balance as "ETH" since it doesn't support custom gas tokens fully, but the underlying token is USDC. Use the ERC-20 interface to read actual USDC balance.

SOURCE:
docs.arc.io/arc/references/connect-to-arc.md
`
  },

  {
    id: "setup-2",
    keywords: ["arc rpc url", "rpc endpoint arc", "arc rpc", "arc endpoint"],
    title: "What is Arc MAINNET's RPC URL and network details?",
    content: `
SHORT_ANSWER:
RPC URL: https://rpc.mainnet.arc.io | Chain ID: 5042002 (hex: 0x13b2) | Explorer: https://explorer.arc.io

COMPLETE NETWORK DETAILS:
- Network name: Arc MAINNET
- RPC URL: https://rpc.mainnet.arc.io
- Chain ID: 5042002 (hex: 0x13b2)
- Currency symbol: USDC
- Block Explorer: https://explorer.arc.io
- Faucet: https://faucet.circle.com

CONTRACT ADDRESSES (MAINNET):
- USDC: 0x3600000000000000000000000000000000000000
- EURC: 0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1
- CCTP TokenMessengerV2: 0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA
- CCTP MessageTransmitterV2: 0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275
- Gateway: 0x0077777d7EBA4688BDeF3E311b846F25870A19B9
- ERC-8004 IdentityRegistry: 0x8004A818BFB912233c491871b3d84c89A494BD9e
- ERC-8183 AgenticCommerce: 0x0747EEf0706327138c69792bF28Cd525089e4583

SOURCE:
docs.arc.io/arc/references/connect-to-arc.md
docs.arc.io/arc/references/contract-addresses.md
`
  },

  {
    id: "setup-3",
    keywords: ["MAINNET usdc faucet", "get usdc MAINNET", "free usdc arc", "arc faucet", "faucet circle"],
    title: "How do I get MAINNET USDC on Arc?",
    content: `
SHORT_ANSWER:
Go to faucet.circle.com → Select Arc MAINNET → Enter your wallet address → Click Send. USDC arrives in seconds.

STEP-BY-STEP:
Step 1: Go to https://faucet.circle.com
Step 2: Select network: ARC MAINNET
Step 3: Select token: USDC
Step 4: Enter your wallet address
Step 5: Click "Send"
Step 6: Wait 10-30 seconds
Step 7: Check balance at https://explorer.arc.io

ALSO AVAILABLE:
- EURC MAINNET tokens from same faucet
- USYC MAINNET (requires allowlisting via Circle Support)

KEY POINTS:
- MAINNET USDC has no real monetary value
- You can request multiple times
- USDC required for gas fees on Arc
- USDC Contract: 0x3600000000000000000000000000000000000000

SOURCE:
faucet.circle.com
docs.arc.io/arc/references/contract-addresses.md
`
  },

  {
    id: "setup-4",
    keywords: ["hardhat config arc", "hardhat arc setup", "deploy hardhat arc", "hardhat MAINNET arc"],
    title: "How do I set up Hardhat for Arc?",
    content: `
SHORT_ANSWER:
Install Hardhat, add Arc MAINNET network config with RPC and Chain ID, then deploy with --network arcMAINNET flag.

COMPLETE SETUP:
Step 1: Install dependencies
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox dotenv

Step 2: Create .env file
PRIVATE_KEY=your_wallet_private_key

Step 3: Create hardhat.config.ts
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import dotenv from "dotenv";
dotenv.config();

const config: HardhatUserConfig = {
  solidity: "0.8.24",
  networks: {
    arcMAINNET: {
      url: "https://rpc.mainnet.arc.io",
      chainId: 5042002,
      accounts: [process.env.PRIVATE_KEY!],
    },
  },
};
export default config;

Step 4: Write your contract in contracts/MyContract.sol

Step 5: Write deploy script in scripts/deploy.ts
import { ethers } from "hardhat";
async function main() {
  const Contract = await ethers.getContractFactory("MyContract");
  const contract = await Contract.deploy();
  await contract.waitForDeployment();
  console.log("Deployed to:", await contract.getAddress());
}
main().catch(console.error);

Step 6: Deploy
npx hardhat run scripts/deploy.ts --network arcMAINNET

Step 7: View on explorer
https://explorer.arc.io/address/YOUR_CONTRACT_ADDRESS

KEY POINTS:
- Deployer wallet must have MAINNET USDC for gas
- Gas is automatically paid in USDC
- No ETH needed

SOURCE:
docs.arc.io/arc/tutorials/deploy-on-arc.md
`
  },

  {
    id: "setup-5",
    keywords: ["foundry arc", "forge arc", "foundry setup arc", "cast arc"],
    title: "How do I set up Foundry for Arc?",
    content: `
SHORT_ANSWER:
Install Foundry, create foundry.toml with Arc RPC, then use forge deploy with Arc's RPC URL.

SETUP:
Step 1: Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

Step 2: Create project
forge init my-arc-project
cd my-arc-project

Step 3: Create foundry.toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]

[rpc_endpoints]
arc_MAINNET = "https://rpc.mainnet.arc.io"

Step 4: Write contract in src/MyContract.sol

Step 5: Deploy
forge create src/MyContract.sol:MyContract \
  --rpc-url https://rpc.mainnet.arc.io \
  --private-key $PRIVATE_KEY \
  --chain-id 5042002

Step 6: Run tests
forge test --rpc-url https://rpc.mainnet.arc.io

KEY POINTS:
- forge test works locally without RPC
- Use --rpc-url for on-chain tests
- cast send works for contract interactions

SOURCE:
docs.arc.io/arc/tutorials/deploy-on-arc.md
`
  },

  {
    id: "setup-6",
    keywords: ["verify contract arc", "arcscan verify", "contract verification arc"],
    title: "How do I verify contracts on Arc Explorer?",
    content: `
SHORT_ANSWER:
Go to explorer.arc.io, find your contract, click "Verify & Publish", upload your Solidity source code and compiler settings.

STEP-BY-STEP:
Step 1: Go to https://explorer.arc.io
Step 2: Search your contract address
Step 3: Click "Contract" tab
Step 4: Click "Verify & Publish"
Step 5: Select compiler version (must match what you used)
Step 6: Paste your Solidity source code
Step 7: Submit verification

WITH HARDHAT (automated):
npm install --save-dev @nomicfoundation/hardhat-verify

In hardhat.config.ts add:
etherscan: {
  apiKey: { arcMAINNET: "placeholder" },
  customChains: [{
    network: "arcMAINNET",
    chainId: 5042002,
    urls: {
      apiURL: "https://explorer.arc.io/api",
      browserURL: "https://explorer.arc.io",
    },
  }],
},

Then run:
npx hardhat verify --network arcMAINNET YOUR_CONTRACT_ADDRESS

SOURCE:
https://explorer.arc.io
`
  },

  // ============================================================
  // C. USDC & GAS
  // ============================================================
  {
    id: "gas-1",
    keywords: ["pay gas usdc", "gas usdc arc", "how gas works arc", "usdc gas fee", "arc gas model"],
    title: "How does gas work on Arc? How do I pay gas in USDC?",
    content: `
SHORT_ANSWER:
On Arc, gas fees are paid in USDC automatically. You just need USDC in your wallet — no ETH needed. The fee model uses EIP-1559 + EWMA smoothing for stable, predictable costs.

EXPLANATION:
Arc's fee model:
- Gas unit: USDC (18 decimals for internal accounting)
- Pricing: EIP-1559 + EWMA smoothing
- Base fee target: ~$0.01 per transaction
- Minimum base fee: 20 Gwei
- Maximum base fee: 1e-3 USDC
- Fees are stable — short spikes don't cause sudden jumps

HOW TO SET GAS (ethers.js):
import { ethers } from "ethers";
const provider = new ethers.JsonRpcProvider("https://rpc.mainnet.arc.io");
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

const tx = await wallet.sendTransaction({
  to: recipient,
  value: ethers.parseUnits("1", 6), // 1 USDC
  maxFeePerGas: ethers.parseUnits("20", "gwei"), // minimum
  maxPriorityFeePerGas: ethers.parseUnits("1", "gwei"), // tip
});

COMMON ERROR: "transaction underpriced"
Fix: Set maxFeePerGas to at least ethers.parseUnits("20", "gwei")

SOURCE:
docs.arc.io/arc/references/gas-and-fees.md
`
  },

  {
    id: "gas-2",
    keywords: ["usdc contract address arc", "usdc address MAINNET", "arc usdc contract", "usdc token arc"],
    title: "What is the USDC contract address on Arc MAINNET?",
    content: `
SHORT_ANSWER:
USDC Contract on Arc MAINNET: 0x3600000000000000000000000000000000000000 (6 decimals for ERC-20 interface)

ALL CONTRACT ADDRESSES (Arc MAINNET):
- USDC: 0x3600000000000000000000000000000000000000
- EURC: 0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1
- USYC: 0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C
- CCTP TokenMessengerV2: 0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA
- CCTP MessageTransmitterV2: 0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275
- Gateway Wallet: 0x0077777d7EBA4688BDeF3E311b846F25870A19B9
- StableFX Escrow: 0x867650F5eAe8df91445971f14d89fd84F0C9a9f8
- ERC-8004 IdentityRegistry: 0x8004A818BFB912233c491871b3d84c89A494BD9e
- ERC-8183 AgenticCommerce: 0x0747EEf0706327138c69792bF28Cd525089e4583
- Multicall3: 0xcA11bde05977b3631167028862bE2a173976CA11
- Permit2: 0x000000000022D473030F116dDEE9F6B43aC78BA3
- CREATE2 Factory: 0x4e59b44847b379578588920cA78FbF26c0B4956C

IMPORTANT: USDC uses 6 decimals for ERC-20 interface, 18 decimals for native gas accounting. Use ERC-20 interface (6 decimals) for application-level transfers.

SOURCE:
docs.arc.io/arc/references/contract-addresses.md
`
  },

  {
    id: "gas-3",
    keywords: ["transfer usdc arc", "send usdc programmatic", "usdc transfer code", "erc20 transfer arc"],
    title: "How do I transfer USDC programmatically on Arc?",
    content: `
SHORT_ANSWER:
Use the ERC-20 transfer function with USDC contract 0x3600000000000000000000000000000000000000. USDC has 6 decimals — 1 USDC = 1,000,000 units.

CODE EXAMPLES:

Using ethers.js:
import { ethers } from "ethers";
const USDC = "0x3600000000000000000000000000000000000000";
const ERC20_ABI = ["function transfer(address to, uint256 amount) returns (bool)"];

const provider = new ethers.JsonRpcProvider("https://rpc.mainnet.arc.io");
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const usdc = new ethers.Contract(USDC, ERC20_ABI, wallet);

// Send 1 USDC
const tx = await usdc.transfer(recipientAddress, ethers.parseUnits("1", 6));
await tx.wait();

Using raw transaction (MetaMask/frontend):
const amount = (1000000).toString(16).padStart(64, "0"); // 1 USDC in hex
const data = "0xa9059cbb" + recipientAddress.slice(2).padStart(64, "0") + amount;

await window.ethereum.request({
  method: "eth_sendTransaction",
  params: [{ from: senderAddress, to: USDC_CONTRACT, data }],
});

DECIMAL GUIDE:
- 0.001 USDC = 1000 units
- 0.1 USDC = 100000 units
- 1 USDC = 1000000 units
- 10 USDC = 10000000 units

SOURCE:
docs.arc.io/arc/references/contract-addresses.md
`
  },

  // ============================================================
  // D. SMART CONTRACTS
  // ============================================================
  {
    id: "contracts-1",
    keywords: ["deploy erc20 arc", "erc20 contract arc", "create token arc", "deploy token arc"],
    title: "How do I deploy an ERC-20 contract on Arc?",
    content: `
SHORT_ANSWER:
Arc is EVM-compatible — deploy standard ERC-20 contracts using Hardhat or Foundry with Arc's RPC URL and Chain ID 5042002.

COMPLETE GUIDE:

Step 1: Write your ERC-20 contract (contracts/MyToken.sol)
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MyToken is ERC20 {
    constructor(uint256 initialSupply) ERC20("MyToken", "MTK") {
        _mint(msg.sender, initialSupply * 10 ** decimals());
    }
}

Step 2: Install OpenZeppelin
npm install @openzeppelin/contracts

Step 3: Deploy script (scripts/deploy.ts)
import { ethers } from "hardhat";
async function main() {
  const MyToken = await ethers.getContractFactory("MyToken");
  const token = await MyToken.deploy(1000000); // 1M tokens
  await token.waitForDeployment();
  console.log("Token deployed to:", await token.getAddress());
}
main().catch(console.error);

Step 4: Deploy to Arc
npx hardhat run scripts/deploy.ts --network arcMAINNET

Step 5: Verify on explorer
https://explorer.arc.io/address/YOUR_TOKEN_ADDRESS

SOURCE:
docs.arc.io/arc/tutorials/deploy-on-arc.md
`
  },

  {
    id: "contracts-2",
    keywords: ["usdc payment contract", "accept usdc", "payment contract arc", "receive usdc contract"],
    title: "How do I write a payment contract that accepts USDC on Arc?",
    content: `
SHORT_ANSWER:
Create a contract that calls transferFrom on the USDC ERC-20 interface. Users must first approve your contract to spend their USDC.

COMPLETE EXAMPLE:
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

contract MicroPayment {
    address public constant USDC = 0x3600000000000000000000000000000000000000;
    address public owner;
    uint256 public pricePerQuery = 1000; // 0.001 USDC (6 decimals)

    event Payment(address indexed payer, uint256 amount);

    constructor() { owner = msg.sender; }

    function pay() external {
        require(
            IERC20(USDC).transferFrom(msg.sender, owner, pricePerQuery),
            "USDC transfer failed"
        );
        emit Payment(msg.sender, pricePerQuery);
    }

    function withdraw() external {
        require(msg.sender == owner, "Not owner");
        uint256 balance = IERC20(USDC).balanceOf(address(this));
        IERC20(USDC).transfer(owner, balance);
    }
}

FRONTEND FLOW:
Step 1: User approves your contract to spend USDC
Step 2: User calls pay() on your contract
Step 3: USDC transfers from user to owner

NOTE: For simpler payment collection without a custom contract, use direct USDC transfer to your wallet address.

SOURCE:
docs.arc.io/arc/tutorials/deploy-on-arc.md
`
  },

  {
    id: "contracts-3",
    keywords: ["proxy contract arc", "upgradeable contract arc", "contract upgrade arc", "transparent proxy"],
    title: "Can I deploy proxy/upgradeable contracts on Arc?",
    content: `
SHORT_ANSWER:
Yes. Standard OpenZeppelin proxy patterns (Transparent, UUPS) work on Arc. The CREATE2 factory is also available for deterministic deployment.

UUPS PROXY EXAMPLE:
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract MyUpgradeableContract is UUPSUpgradeable, OwnableUpgradeable {
    function initialize() public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}
}

DEPLOY WITH HARDHAT:
import { upgrades } from "hardhat";
const contract = await upgrades.deployProxy(MyContract, [], { kind: "uups" });

CREATE2 FACTORY ADDRESS:
0x4e59b44847b379578588920cA78FbF26c0B4956C

SOURCE:
docs.arc.io/arc/tutorials/deploy-on-arc.md
`
  },

  // ============================================================
  // E. CIRCLE WALLETS SDK
  // ============================================================
  {
    id: "circle-sdk-1",
    keywords: ["circle sdk setup", "developer controlled wallets setup", "circle wallet install", "circle sdk install"],
    title: "How do I set up Circle Developer-Controlled Wallets SDK?",
    content: `
SHORT_ANSWER:
Install the SDK, create API key and Entity Secret in Circle Console, then initialize the client with your credentials.

COMPLETE SETUP:
Step 1: Install SDK
npm install @circle-fin/developer-controlled-wallets

Step 2: Create Circle account
Go to https://console.circle.com and sign up

Step 3: Generate API Key
Console → API Keys → Create API Key → Standard Key
Copy the key (shown only once)

Step 4: Generate Entity Secret
import { generateEntitySecret } from "@circle-fin/developer-controlled-wallets";
const secret = generateEntitySecret();
console.log(secret); // Save this securely!

Step 5: Register Entity Secret in Console
import { registerEntitySecretCiphertext } from "@circle-fin/developer-controlled-wallets";
const response = await registerEntitySecretCiphertext({
  apiKey: process.env.CIRCLE_API_KEY,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET,
});
// Save recovery_file.dat if provided

Step 6: Add to .env
CIRCLE_API_KEY=your_api_key
CIRCLE_ENTITY_SECRET=your_32_byte_secret

Step 7: Initialize client
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";

const client = initiateDeveloperControlledWalletsClient({
  apiKey: process.env.CIRCLE_API_KEY,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET,
});

SOURCE:
developers.circle.com/wallets/developer-controlled/quickstart
`
  },

  {
    id: "circle-sdk-2",
    keywords: ["create wallet circle", "circle wallet arc", "wallet set circle", "create arc wallet"],
    title: "How do I create and manage wallets on Arc with Circle SDK?",
    content: `
SHORT_ANSWER:
Create a WalletSet first, then create wallets inside it. Each WalletSet can hold up to 10 million wallets. Use blockchain: "ARC-MAINNET" for Arc.

CODE:
// Create wallet set
const walletSet = await client.createWalletSet({
  name: "My App Wallets",
});

// Create wallets on Arc MAINNET
const walletsResponse = await client.createWallets({
  blockchains: ["ARC-MAINNET"],
  count: 1, // number of wallets to create
  walletSetId: walletSet.data.walletSet.id,
  accountType: "SCA", // Smart Contract Account (recommended)
});

const wallet = walletsResponse.data.wallets[0];
console.log("Wallet Address:", wallet.address);
console.log("Wallet ID:", wallet.id);

// List existing wallets
const wallets = await client.listWallets({});
console.log(wallets.data.wallets);

// Get specific wallet
const wallet = await client.getWallet({ id: walletId });

KEY POINTS:
- SCA (Smart Contract Account) recommended for Arc
- Each wallet has a unique ID and address
- WalletSet ID needed for creating wallets
- Up to 10M wallets per WalletSet

SOURCE:
developers.circle.com/wallets/developer-controlled/quickstart
`
  },

  {
    id: "circle-sdk-3",
    keywords: ["send usdc circle sdk", "transfer circle sdk", "circle sdk transaction", "send transaction circle"],
    title: "How do I send USDC using Circle SDK on Arc?",
    content: `
SHORT_ANSWER:
Use createTransaction() method with the USDC token address and recipient. Circle handles signing automatically.

CODE:
// Send 1 USDC from a Circle-managed wallet
const tx = await client.createTransaction({
  walletAddress: "0xYourWalletAddress",
  blockchain: "ARC-MAINNET",
  tokenAddress: "0x3600000000000000000000000000000000000000", // USDC
  destinationAddress: "0xRecipientAddress",
  amount: ["1"], // 1 USDC (string array)
  fee: {
    type: "level",
    config: { feeLevel: "MEDIUM" }, // LOW, MEDIUM, HIGH
  },
});

// Get transaction ID
const txId = tx.data.id;

// Poll transaction status
const checkStatus = async () => {
  const result = await client.getTransaction({ id: txId });
  const state = result.data.transaction.state;
  console.log("Status:", state);
  // States: INITIATED, PENDING_RISK_SCREENING, SENT, CONFIRMED, COMPLETE, FAILED
  if (state !== "COMPLETE" && state !== "FAILED") {
    setTimeout(checkStatus, 2000); // poll every 2 seconds
  }
};
await checkStatus();

AMOUNT FORMAT:
- "1" = 1 USDC
- "0.001" = 0.001 USDC
- Always pass as string

SOURCE:
developers.circle.com/wallets/developer-controlled/send-tokens
`
  },

  {
    id: "circle-sdk-4",
    keywords: ["entity secret lost", "recover entity secret", "entity secret recovery", "lost circle credentials"],
    title: "How do I recover a lost Entity Secret?",
    content: `
SHORT_ANSWER:
If you saved the recovery_file.dat during setup, use it to reset via Circle Console → Reset. If lost, you must generate a new Entity Secret — existing wallets remain accessible with the new secret.

RECOVERY OPTIONS:

Option 1: You have recovery_file.dat
- Go to console.circle.com → DEV CONTROLLED → Configurator → Entity Secret
- Click "Reset"
- Upload the recovery_file.dat file
- Enter new entity secret ciphertext
- Click Reset

Option 2: No recovery_file.dat (use Rotate)
- You need the current Entity Secret to rotate
- If you have it stored somewhere, use Rotate to get a new one
- Warning: All pending transactions using old secret will fail

Option 3: Completely lost
- Contact Circle Support at support.circle.com
- Provide API key and account verification
- They may be able to help reset

PREVENTION:
Always save the recovery_file.dat when creating Entity Secret:
import fs from "fs";
const response = await registerEntitySecretCiphertext({...});
fs.writeFileSync("recovery_file.dat", response.data?.recoveryFile ?? "");

SOURCE:
console.circle.com → Configurator → Entity Secret
`
  },

  {
    id: "circle-sdk-5",
    keywords: ["sca wallet eoa wallet", "smart contract account", "wallet type circle", "account type circle"],
    title: "What is the difference between SCA and EOA wallets in Circle?",
    content: `
SHORT_ANSWER:
SCA (Smart Contract Account) is recommended for Arc — it supports account abstraction features. EOA (Externally Owned Account) is simpler but lacks advanced features like batch transactions.

COMPARISON:
| Feature | SCA | EOA |
|---|---|---|
| Account Abstraction | Yes | No |
| Batch transactions | Yes | No |
| Gas sponsorship | Yes | No |
| Recovery options | Better | Basic |
| Recommended for Arc | Yes | Basic use only |

WHEN TO USE EACH:
SCA: Production apps, AI agents, payment systems, dApps needing AA
EOA: Simple scripts, testing, basic transfers

CODE (create SCA):
const wallets = await client.createWallets({
  blockchains: ["ARC-MAINNET"],
  count: 1,
  walletSetId: walletSetId,
  accountType: "SCA", // use this for Arc
});

SOURCE:
developers.circle.com/wallets/developer-controlled/wallets
`
  },

  // ============================================================
  // F. ERC-8004
  // ============================================================
  {
    id: "erc8004-setup-1",
    keywords: ["erc-8004 setup", "register ai agent arc", "agent registration guide", "erc8004 tutorial"],
    title: "How do I register an AI Agent on Arc using ERC-8004?",
    content: `
SHORT_ANSWER:
Prepare metadata JSON → Upload to IPFS → Call register() on IdentityRegistry contract → Get your Agent ID (NFT tokenId).

COMPLETE GUIDE:

Step 1: Create metadata JSON
{
  "name": "My AI Agent",
  "description": "What your agent does",
  "agent_type": "ai_assistant",
  "capabilities": ["natural_language_qa", "code_generation"],
  "version": "1.0.0",
  "url": "https://your-dapp.com",
  "payment": {
    "cost_per_query": "0.001",
    "token": "USDC",
    "network": "ARC-MAINNET"
  }
}

Step 2: Upload to IPFS (Pinata)
- Go to pinata.cloud
- Upload the JSON file
- Copy CID (e.g., bafkrei...)
- Your URI: ipfs://YOUR_CID

Step 3: Register using Circle SDK
const tx = await client.createContractExecutionTransaction({
  walletAddress: ownerWalletAddress,
  blockchain: "ARC-MAINNET",
  contractAddress: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
  abiFunctionSignature: "register(string)",
  abiParameters: ["ipfs://YOUR_CID"],
  fee: { type: "level", config: { feeLevel: "MEDIUM" } },
});

Step 4: Get your Agent ID
// Listen for Transfer event to get tokenId (your Agent ID)
// Or check your wallet on explorer.arc.io

CONTRACT ADDRESSES:
- IdentityRegistry: 0x8004A818BFB912233c491871b3d84c89A494BD9e
- ReputationRegistry: 0x8004B663056A597Dffe9eCcC1965A193B7388713
- ValidationRegistry: 0x8004Cb1BF31DAf7788923b405b754f57acEB4272

SOURCE:
docs.arc.io/arc/tutorials/register-your-first-ai-agent.md
`
  },

  // ============================================================
  // G. ERC-8183
  // ============================================================
  {
    id: "erc8183-setup-1",
    keywords: ["erc-8183 guide", "create job arc", "job settlement guide", "agentic commerce tutorial"],
    title: "How do I create and complete an ERC-8183 job on Arc?",
    content: `
SHORT_ANSWER:
Client creates job → Provider sets budget → Client approves + funds USDC escrow → Provider submits deliverable → Client completes → USDC released.

COMPLETE GUIDE:

CONTRACT: 0x0747EEf0706327138c69792bF28Cd525089e4583

Step 1: Create job (client wallet)
const tx = await client.createContractExecutionTransaction({
  walletAddress: clientWalletAddress,
  blockchain: "ARC-MAINNET",
  contractAddress: "0x0747EEf0706327138c69792bF28Cd525089e4583",
  abiFunctionSignature: "createJob(address,address,uint256,string,address)",
  abiParameters: [
    providerAddress,           // who does the work
    evaluatorAddress,          // who approves (can be client)
    expiryTimestamp.toString(), // unix timestamp
    "Job description here",
    "0x0000000000000000000000000000000000000000" // hook (0 = none)
  ],
  fee: { type: "level", config: { feeLevel: "MEDIUM" } },
});

Step 2: Provider sets budget
abiFunctionSignature: "setBudget(uint256,uint256,bytes)"
abiParameters: [jobId, "1000000", "0x"] // 1 USDC

Step 3: Approve USDC (client)
abiFunctionSignature: "approve(address,uint256)"
// Call on USDC contract, approve AgenticCommerce contract

Step 4: Fund escrow (client)
abiFunctionSignature: "fund(uint256,bytes)"
abiParameters: [jobId, "0x"]

Step 5: Submit deliverable (provider)
import { keccak256, toHex } from "viem";
const deliverable = keccak256(toHex("work-completed-proof"));
abiFunctionSignature: "submit(uint256,bytes32,bytes)"
abiParameters: [jobId, deliverable, "0x"]

Step 6: Complete job (client/evaluator)
import { keccak256, toHex } from "viem";
const reason = keccak256(toHex("approved"));
abiFunctionSignature: "complete(uint256,bytes32,bytes)"
abiParameters: [jobId, reason, "0x"]
// USDC automatically released to provider

JOB STATES: Open → Funded → Submitted → Completed/Rejected/Expired

SOURCE:
docs.arc.io/arc/tutorials/create-your-first-erc-8183-job.md
`
  },

  // ============================================================
  // H. ARC APP KIT
  // ============================================================
  {
    id: "appkit-1",
    keywords: ["app kit install", "arc app kit setup", "bridge kit install", "circle app kit"],
    title: "How do I install and use Arc App Kit?",
    content: `
SHORT_ANSWER:
Install @circle-fin/app-kit, choose your adapter (viem, ethers, Solana, or Circle Wallets), then use Bridge, Swap, Send, or Unified Balance features.

INSTALLATION:
npm install @circle-fin/app-kit

VIEM ADAPTER SETUP:
import { AppKit } from "@circle-fin/app-kit";
import { createViemAdapter } from "@circle-fin/app-kit/adapters/viem";
import { createWalletClient, http } from "viem";
import { arcMAINNET } from "viem/chains";

const walletClient = createWalletClient({
  chain: arcMAINNET,
  transport: http(),
});

const adapter = createViemAdapter({ walletClient });
const appKit = new AppKit({ adapter });

BRIDGE USDC TO ARC:
const result = await appKit.bridge({
  fromChain: "ETH", // source chain
  toChain: "ARC",   // destination
  amount: "10",     // USDC amount
  token: "USDC",
});

UNIFIED BALANCE:
const balance = await appKit.getUnifiedBalance({
  address: userAddress,
});
// Returns combined USDC balance across all chains

SUPPORTED CHAINS:
Ethereum, Base, Arbitrum, Polygon, Solana, Arc + more

SOURCE:
docs.arc.io/app-kit.md
docs.arc.io/app-kit/tutorials/installation.md
`
  },

  // ============================================================
  // I. CCTP
  // ============================================================
  {
    id: "cctp-setup-1",
    keywords: ["cctp setup", "cctp bridge", "cross chain usdc arc", "cctp tutorial", "usdc bridge arc"],
    title: "How do I use CCTP to bridge USDC to Arc?",
    content: `
SHORT_ANSWER:
CCTP burns USDC on source chain and mints native USDC on Arc. Domain ID for Arc is 26. Use Arc App Kit for easiest integration — it handles CCTP automatically.

EASIEST WAY (App Kit):
const result = await appKit.bridge({
  fromChain: "ETH",
  toChain: "ARC",
  amount: "100",
  token: "USDC",
});

MANUAL CCTP FLOW:
Step 1: Approve USDC for burning
Step 2: Call depositForBurn on TokenMessengerV2 (source chain)
Step 3: Wait for Circle attestation
Step 4: Call receiveMessage on MessageTransmitterV2 (Arc)

ARC CCTP CONTRACTS:
- Domain: 26
- TokenMessengerV2: 0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA
- MessageTransmitterV2: 0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275
- TokenMinterV2: 0xb43db544E2c27092c107639Ad201b3dEfAbcF192

SUPPORTED CHAINS: Ethereum, Base, Arbitrum, Optimism, Polygon, Solana, Avalanche, and more

TRANSFER TIME: Usually 1-5 minutes for attestation

SOURCE:
docs.arc.io/app-kit/bridge.md
developers.circle.com/cctp
`
  },

  // ============================================================
  // J. FRONTEND DEVELOPMENT
  // ============================================================
  {
    id: "frontend-1",
    keywords: ["viem arc config", "arc MAINNET viem", "define arc chain viem", "viem chain arc"],
    title: "How do I define Arc MAINNET in viem?",
    content: `
SHORT_ANSWER:
Use defineChain() with Arc's network details, or import arcMAINNET from viem/chains if available.

CODE:
import { defineChain } from "viem";

export const arcMAINNET = defineChain({
  id: 5042002,
  name: "Arc MAINNET",
  network: "arc-MAINNET",
  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    decimals: 6,
  },
  rpcUrls: {
    default: { http: ["https://rpc.mainnet.arc.io"] },
    public: { http: ["https://rpc.mainnet.arc.io"] },
  },
  blockExplorers: {
    default: {
      name: "ArcScan",
      url: "https://explorer.arc.io",
    },
  },
  MAINNET: true,
});

// Use in wagmi config
import { createConfig, http } from "wagmi";
const config = createConfig({
  chains: [arcMAINNET],
  transports: { [arcMAINNET.id]: http() },
});

SOURCE:
docs.arc.io/arc/references/connect-to-arc.md
`
  },

  {
    id: "frontend-2",
    keywords: ["usdc balance react", "read balance arc", "usdc balance frontend", "check balance react"],
    title: "How do I read USDC balance on Arc in a React frontend?",
    content: `
SHORT_ANSWER:
Call eth_call with the ERC-20 balanceOf function signature on the USDC contract. Divide result by 1e6 for display.

CODE (React + ethers.js):
const getBalance = async (address: string) => {
  const data = "0x70a08231" + address.slice(2).padStart(64, "0");
  const result = await window.ethereum.request({
    method: "eth_call",
    params: [{ to: "0x3600000000000000000000000000000000000000", data }, "latest"],
  });
  const balance = parseInt(result, 16) / 1e6;
  return balance.toFixed(3); // e.g., "19.850"
};

CODE (viem):
import { createPublicClient, http } from "viem";
import { arcMAINNET } from "./arcChain";

const client = createPublicClient({ chain: arcMAINNET, transport: http() });

const balance = await client.readContract({
  address: "0x3600000000000000000000000000000000000000",
  abi: [{ name: "balanceOf", type: "function", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] }],
  functionName: "balanceOf",
  args: [userAddress],
});
const formatted = Number(balance) / 1e6; // convert from 6 decimals

SOURCE:
docs.arc.io/arc/references/contract-addresses.md
`
  },

  {
    id: "frontend-3",
    keywords: ["switch network metamask", "switch arc chain", "wallet switch chain", "add arc dapp"],
    title: "How do I switch users to Arc MAINNET in a dApp?",
    content: `
SHORT_ANSWER:
Use wallet_switchEthereumChain. If Arc isn't added yet, catch error code 4902 and call wallet_addEthereumChain to add it automatically.

COMPLETE CODE:
const switchToArc = async () => {
  const ARC_CHAIN_ID = "0x13b2"; // 5042002 in hex

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: ARC_CHAIN_ID }],
    });
  } catch (err) {
    if (err.code === 4902) {
      // Chain not added yet — add it
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: ARC_CHAIN_ID,
          chainName: "Arc MAINNET",
          nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
          rpcUrls: ["https://rpc.mainnet.arc.io"],
          blockExplorerUrls: ["https://explorer.arc.io"],
        }],
      });
    } else if (err.code === 4001) {
      console.log("User rejected the request");
    }
  }
};

SOURCE:
docs.arc.io/arc/references/connect-to-arc.md
`
  },

  // ============================================================
  // K. BACKEND & API
  // ============================================================
  {
    id: "backend-1",
    keywords: ["arc rpc nodejs", "arc backend", "ethers arc node", "arc node js"],
    title: "How do I use Arc RPC in Node.js backend?",
    content: `
SHORT_ANSWER:
Use ethers.js JsonRpcProvider or viem createPublicClient with Arc's RPC URL.

ethers.js:
import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider("https://rpc.mainnet.arc.io");

// Get block number
const blockNumber = await provider.getBlockNumber();

// Get USDC balance
const USDC = "0x3600000000000000000000000000000000000000";
const ABI = ["function balanceOf(address) view returns (uint256)"];
const usdc = new ethers.Contract(USDC, ABI, provider);
const balance = await usdc.balanceOf(address);
console.log(ethers.formatUnits(balance, 6)); // convert 6 decimals

// Send transaction
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const tx = await wallet.sendTransaction({
  to: recipient,
  data: transferData,
  maxFeePerGas: ethers.parseUnits("20", "gwei"),
});
await tx.wait();

viem:
import { createPublicClient, http } from "viem";
import { arcMAINNET } from "./arcChain";

const client = createPublicClient({
  chain: arcMAINNET,
  transport: http("https://rpc.mainnet.arc.io"),
});

const blockNumber = await client.getBlockNumber();

SOURCE:
docs.arc.io/arc/references/connect-to-arc.md
`
  },

  {
    id: "backend-2",
    keywords: ["listen events arc", "contract events arc", "usdc transfer events", "monitor arc events"],
    title: "How do I listen for USDC transfer events on Arc?",
    content: `
SHORT_ANSWER:
Use getLogs() with the Transfer event topic. USDC Transfer topic: 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef

ethers.js:
import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider("https://rpc.mainnet.arc.io");
const USDC = "0x3600000000000000000000000000000000000000";
const ABI = ["event Transfer(address indexed from, address indexed to, uint256 value)"];
const usdc = new ethers.Contract(USDC, ABI, provider);

// Listen for transfers TO your wallet
usdc.on("Transfer", (from, to, amount, event) => {
  if (to.toLowerCase() === yourAddress.toLowerCase()) {
    console.log("Received:", ethers.formatUnits(amount, 6), "USDC from", from);
    console.log("TX:", event.transactionHash);
  }
});

// Get historical transfers
const filter = usdc.filters.Transfer(null, yourAddress);
const events = await usdc.queryFilter(filter, -1000); // last 1000 blocks

viem:
const logs = await client.getLogs({
  address: USDC_CONTRACT,
  event: parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 indexed value)"),
  args: { to: yourAddress },
  fromBlock: BigInt(startBlock),
  toBlock: "latest",
});

SOURCE:
docs.arc.io/arc/tutorials/monitor-contract-events.md
`
  },

  // ============================================================
  // L. TROUBLESHOOTING
  // ============================================================
  {
    id: "troubleshoot-dev-1",
    keywords: ["transaction failing arc", "transaction error arc", "arc tx error", "debug arc transaction"],
    title: "Why is my transaction failing on Arc? How do I debug it?",
    content: `
SHORT_ANSWER:
Most Arc transaction failures are caused by: insufficient USDC for gas, maxFeePerGas below 20 Gwei minimum, wrong network, or incorrect contract interaction.

COMMON ERRORS AND FIXES:

1. "transaction underpriced"
Cause: maxFeePerGas below 20 Gwei minimum
Fix: Set maxFeePerGas: ethers.parseUnits("20", "gwei")

2. "insufficient funds for gas * price + value"
Cause: Not enough USDC to cover gas + transfer amount
Fix: Get more MAINNET USDC at faucet.circle.com

3. "intrinsic gas too low"
Cause: Gas limit too low
Fix: Set gas limit to minimum 21000 for transfers, use eth_estimateGas for contracts

4. Transaction pending forever
Cause: maxFeePerGas too low
Fix: Increase fee or reset MetaMask nonce via Settings → Advanced → Reset Account

5. Contract call reverting
Cause: Business logic error, wrong parameters, or insufficient allowance
Fix: Check ABI parameters match contract expectations, ensure USDC allowance approved

DEBUGGING STEPS:
Step 1: Check USDC balance at explorer.arc.io
Step 2: Verify you're on Arc MAINNET (Chain ID: 5042002)
Step 3: Check maxFeePerGas is at least 20 Gwei
Step 4: Use eth_estimateGas to check gas limit
Step 5: Check Arc Discord for network issues

ERROR CODE REFERENCE:
- 156013: Entity Secret invalid or not registered
- 155258: Insufficient USDC balance for transaction
- 4001: User rejected MetaMask request
- 4902: Chain not added to MetaMask

SOURCE:
docs.arc.io/arc/references/gas-and-fees.md
`
  },

  {
    id: "troubleshoot-dev-2",
    keywords: ["error 156013", "circle error 156013", "entity secret error", "walletset error"],
    title: "What does Circle error code 156013 mean and how do I fix it?",
    content: `
SHORT_ANSWER:
Error 156013 means "Entity Secret is invalid or does not match the registered ciphertext." Your entity secret in .env doesn't match what's registered in Circle Console.

CAUSES:
1. Wrong entity secret in .env file
2. Entity secret was rotated but .env not updated
3. Entity secret not yet registered in Circle Console
4. Copy-paste error when saving the secret

STEP-BY-STEP FIX:
Step 1: Check your .env file
cat .env | grep CIRCLE_ENTITY_SECRET

Step 2: Verify it's exactly 64 hex characters (32 bytes)

Step 3: Test if your current credentials work
const wallets = await client.listWallets({});
// If this works, entity secret is correct

Step 4: If wrong, you have two options:
Option A: Find original secret in old .env files
grep -r "ENTITY_SECRET" ~/projects/

Option B: Rotate entity secret using Circle Console
- console.circle.com → DEV CONTROLLED → Configurator → Entity Secret → Rotate
- Requires current secret's ciphertext

Step 5: Update .env with correct secret
Step 6: Restart your dev server

SOURCE:
developers.circle.com/wallets/developer-controlled/entity-secret
`
  },

  {
    id: "troubleshoot-dev-3",
    keywords: ["error 155258", "insufficient balance error", "circle insufficient funds", "155258"],
    title: "What does Circle error code 155258 mean?",
    content: `
SHORT_ANSWER:
Error 155258 means "The wallet does not have enough USDC balance for this transaction." You need to fund the Circle-managed wallet with MAINNET USDC.

FIX:
Step 1: Get your wallet address
const wallets = await client.listWallets({});
const address = wallets.data.wallets[0].address;
console.log("Fund this address:", address);

Step 2: Fund with MAINNET USDC
- Go to faucet.circle.com
- Select Arc MAINNET
- Enter the wallet address
- Click Send

Step 3: Wait 10-30 seconds for USDC to arrive

Step 4: Verify balance
const balance = await client.getWalletTokenBalance({ id: walletId });

Step 5: Retry your transaction

NOTE: Make sure to fund the specific Circle wallet address, not your MetaMask address.

SOURCE:
developers.circle.com/wallets/developer-controlled/send-tokens
`
  },

  {
    id: "troubleshoot-dev-4",
    keywords: ["metamask wrong balance", "metamask usdc not showing", "usdc not visible metamask", "add usdc metamask"],
    title: "Why is MetaMask showing wrong balance or USDC not visible?",
    content: `
SHORT_ANSWER:
MetaMask doesn't natively display custom gas tokens correctly. Manually add USDC as a token using its contract address.

FIX:
Step 1: Add USDC token manually
- Open MetaMask
- Make sure you're on Arc MAINNET
- Click "Import tokens"
- Enter: 0x3600000000000000000000000000000000000000
- Symbol: USDC, Decimals: 6
- Click Add

Step 2: If balance shows as ETH
MetaMask shows native gas as ETH even on Arc. The actual balance is USDC. Read the ERC-20 balanceOf instead:
const data = "0x70a08231" + address.slice(2).padStart(64, "0");
const result = await window.ethereum.request({
  method: "eth_call",
  params: [{ to: "0x3600000000000000000000000000000000000000", data }, "latest"],
});
const balance = parseInt(result, 16) / 1e6;

Step 3: Reset account if stale
MetaMask → Settings → Advanced → Reset Account (clears nonce/pending txs, not funds)

SOURCE:
docs.arc.io/arc/references/connect-to-arc.md
`
  },

  // ============================================================
  // A. ARC TOKEN & AIRDROP
  // ============================================================
  {
    id: "token-1",
    keywords: ["arc token", "arc airdrop", "arc native token", "arc coin", "will arc have token"],
    title: "Will Arc have a native token? Is there an Arc airdrop?",
    content: `
SHORT_ANSWER:
No official token or airdrop has been confirmed yet. Circle CEO Jeremy Allaire publicly stated in April 2026 that Arc will have a native token for governance, staking incentives, and economic alignment — but no date or distribution details announced.

WHAT WE KNOW:
- Circle CEO Jeremy Allaire at a Seoul event (April 14, 2026): Arc token will "help provide mechanisms for governance, incentives, economic alignment, and to ultimately move it into a proof-of-stake system"
- Circle mentioned native token possibility in Q3 2025, Q4 2025, and Q1 2026 earnings calls
- Circle published broad tokenomics in its whitepaper

ARC TOKENOMICS (from whitepaper):
- Total Supply: 10 billion ARC tokens
- Ecosystem (60%): Token sales, developer grants, network growth, participation mechanisms
- Circle (25%): Circle operations, staking, governance, ecosystem programs
- Long-Term Reserve (15%): Treasury for market stability and critical infrastructure

WHAT IS NOT CONFIRMED:
- No official airdrop date
- No distribution eligibility criteria published
- No unlock or vesting schedule
- No TGE (Token Generation Event) date

HONEST ADVICE:
MAINNET participation is speculative but low-risk. Focus on meaningful contributions (building, content creation) rather than simple faucet farming.

SOURCE:
Circle CEO statement at Seoul event, April 14, 2026
airdrops.io/arc (updated May 2026)
`
  },

  {
    id: "token-2",
    keywords: ["arc tokenomics", "arc supply", "arc distribution", "arc token supply", "10 billion arc"],
    title: "What are Arc's tokenomics?",
    content: `
SHORT_ANSWER:
Arc has a 10 billion total supply split into: Ecosystem 60%, Circle 25%, Long-Term Reserve 15%. Unlock and vesting schedules have not been published yet.

BREAKDOWN:
- Total Supply: 10,000,000,000 ARC
- Ecosystem (60% = 6 billion): Covers token sales, developer grants, network growth programs, and participation mechanisms. Majority goes to builders and contributors.
- Circle (25% = 2.5 billion): For Circle's operations on the network, staking, governance participation, and ecosystem programs
- Long-Term Reserve (15% = 1.5 billion): Treasury for market stress, critical infrastructure, and network stability

WHAT'S NOT PUBLISHED YET:
- Vesting schedules
- Unlock timelines
- Eligibility criteria for ecosystem allocation
- TGE date

NOTE:
These tokenomics were shared in Circle's whitepaper. Circle went public on NYSE in June 2025. Arc is a core part of Circle's 2026 product roadmap.

SOURCE:
Circle whitepaper (2026)
`
  },

  {
    id: "token-3",
    keywords: ["qualify airdrop arc", "arc airdrop eligibility", "farming arc", "increase arc airdrop chance", "how to get arc airdrop"],
    title: "How do I increase my chances of a potential Arc airdrop?",
    content: `
SHORT_ANSWER:
Participate meaningfully on Arc MAINNET — deploy contracts, use dApps, join Arc House community program, get Discord roles, create content, and build real projects.

RECOMMENDED ACTIVITIES (from community guides):

1. MAINNET TRANSACTIONS
- Add Arc MAINNET to MetaMask (Chain ID: 5042002)
- Get MAINNET USDC from faucet.circle.com
- Send transactions regularly
- Do cross-chain swaps
- Interact with multiple dApps

2. ARC HOUSE (OFFICIAL PROGRAM)
- Join arc.house community program
- Complete tasks to earn badges and points
- Apply for Builder/Creator roles
- Submit your project

3. DISCORD
- Join Arc Discord
- Get Architect role (verified member)
- Apply for Creator role (requires building or content)
- Participate in AMAs and Office Hours

4. BUILD SOMETHING
- Deploy a smart contract on Arc
- Build a dApp or tool
- Create educational content about Arc
- Submit to #user-made-things on Discord

5. SOCIAL MEDIA
- Follow @arc_xbt on Twitter/X
- Post about your Arc builds
- Share demo videos on YouTube
- Tag Arc team in your content

6. ADVANCED ACTIVITIES
- Register an ERC-8004 AI Agent
- Create ERC-8183 jobs
- Use Circle Developer-Controlled Wallets
- Mint NFTs on Arc (Omnihub, Ordinal Genesis)
- Register domain on InfinityName

HONEST ADVICE:
No airdrop is confirmed. Focus on activities that have real value regardless of airdrop — building skills, networking, creating content.

SOURCE:
airdrops.io/arc, cryptorank.io/drophunting/arc-chain-activity
`
  },

  {
    id: "token-4",
    keywords: ["arc mainnet", "when mainnet arc", "arc mainnet date", "arc mainnet launch", "arc mainnet 2026"],
    title: "When will Arc mainnet launch?",
    content: `
SHORT_ANSWER:
No official mainnet date confirmed. Arc public MAINNET launched October 28, 2025. Mainnet Beta is expected in 2026 based on Circle's roadmap.

TIMELINE SO FAR:
- Private MAINNET: Early 2025
- Public MAINNET: October 28, 2025
- Mainnet Beta: Expected 2026 (no specific date)
- Full mainnet: TBD

WHAT ARC HAS AT MAINNET LAUNCH:
- 100+ institutional partners (BlackRock, Visa, Goldman Sachs, HSBC, Mastercard, AWS, Anthropic)
- ERC-8004 AI Agent Registry
- ERC-8183 Agentic Commerce
- CCTP cross-chain transfers
- Arc App Kit (Bridge, Swap, Send, Unified Balance)
- Over 244M+ transactions on MAINNET as of May 2026

WHAT COMES WITH MAINNET:
- Privacy Module (confidential transactions)
- Stablecoin Services (multi-stablecoin gas, paymaster)
- Proof-of-Stake transition (eventually)
- Possible ARC token launch

NOTE:
Circle is now publicly traded (NYSE: CRCL since June 2025). Mainnet timing will depend on testing, regulatory, and development milestones.

SOURCE:
airdrops.io/arc (May 2026 update)
docs.arc.io/arc/concepts/system-overview.md
`
  },

  {
    id: "token-5",
    keywords: ["arc builders fund", "circle ventures arc", "arc grant", "arc funding", "arc investment"],
    title: "What is the Arc Builders Fund and how do I apply?",
    content: `
SHORT_ANSWER:
Circle Ventures launched the Arc Builders Fund in December 2025 to provide funding and support for early-stage teams building on Arc network.

WHAT IS IT:
- Launched: December 2025
- Purpose: Fund early-stage teams building real applications on Arc
- Run by: Circle Ventures (Circle's investment arm)
- Focus: Fintech, payments, AI agents, DeFi, enterprise apps

HOW TO APPLY:
Step 1: Build something meaningful on Arc (working prototype required)
Step 2: Join Arc House (arc.house) and establish your profile
Step 3: Engage with Arc community (Discord, Twitter, Office Hours)
Step 4: Contact Circle Ventures through official Arc channels
Step 5: Submit your project for review

WHAT THEY LOOK FOR:
- Real working applications on Arc
- Clear business model or ecosystem value
- Strong team with relevant background
- Arc-native features (USDC payments, ERC-8004/8183, CCTP)

TIP:
Presenting at Arc Office Hours on Discord is a great way to get noticed by the Arc team before formally applying.

SOURCE:
Bitget News, December 2025 (Circle Ventures Arc Builders Fund announcement)
`
  },

  // ============================================================
  // B. ARC HOUSE
  // ============================================================
  {
    id: "archouse-1",
    keywords: ["arc house", "what is arc house", "arc house community", "arc house program", "arc house join"],
    title: "What is Arc House and how do I join?",
    content: `
SHORT_ANSWER:
Arc House is the official community platform for Arc builders and contributors. You earn points and badges by completing tasks, building projects, and engaging with the ecosystem.

WHAT IS ARC HOUSE:
- Official Arc community portal at arc.house
- Builder recognition platform
- Task-based point system with badges
- Gateway to grants, recognition, and ecosystem listing
- Connected to Arc Discord community

HOW TO JOIN:
Step 1: Go to arc.house
Step 2: Click "Join Community"
Step 3: Register with email or LinkedIn account
Step 4: Create your profile (add GitHub, Twitter, LinkedIn)
Step 5: Submit application for approval
Step 6: Once approved, start completing tasks

PROFILE TIPS:
- Add all your social links (GitHub, Twitter, LinkedIn)
- Write a clear bio about what you build
- Link your Arc MAINNET wallet address
- Add your YouTube channel if you create content

NOTE:
Approval may take 24-48 hours. Some roles require manual review by Arc team.

SOURCE:
arc.house
airdrops.io/arc
`
  },

  {
    id: "archouse-2",
    keywords: ["arc house points", "earn arc points", "arc badges", "arc house tasks", "arc house rewards"],
    title: "How do I earn points and badges on Arc House?",
    content: `
SHORT_ANSWER:
Earn points by completing tasks: building dApps, creating content, participating in Discord, submitting to ecosystem, and engaging with Arc community.

WAYS TO EARN POINTS:

HIGH VALUE ACTIVITIES:
- Build and deploy a dApp on Arc MAINNET
- Create educational YouTube video about Arc
- Get featured in Arc Discord #user-made-things
- Present at Arc Office Hours
- Submit project for Arc ecosystem listing
- Register an ERC-8004 AI Agent
- Write technical blog post or tutorial

MEDIUM VALUE:
- Active Discord participation
- Create Twitter/X content about Arc
- Help other community members with questions
- Complete bounty tasks on Superboard
- Mint NFTs on Arc dApps

LOWER VALUE:
- Daily GM interactions
- Like/retweet Arc official posts
- Refer new members

BADGES:
- Builder Badge: Deploy contracts/dApps
- Creator Badge: Quality content creation
- Architect Badge: Verified Discord member
- Community Badge: Active participation

HOW TO REDEEM:
Arc House hasn't officially announced redemption mechanics yet. Points and badges are being tracked for potential future rewards.

SOURCE:
arc.house (contribution rules section)
`
  },

  {
    id: "archouse-3",
    keywords: ["creator role arc", "arc discord creator", "get creator role", "arc builder role"],
    title: "How do I get the Creator or Builder role on Arc Discord?",
    content: `
SHORT_ANSWER:
Creator role requires building meaningful projects OR creating quality educational content about Arc. Apply through Arc Discord by showing your work.

CREATOR ROLE REQUIREMENTS:
Option A — Build something:
- Deploy a working dApp on Arc MAINNET
- Must use Arc-native features (USDC payment, ERC-8004, ERC-8183)
- Share in #user-made-things Discord channel
- Include GitHub repo and demo link/video

Option B — Create content:
- Create quality YouTube tutorials about Arc
- Write technical articles/blogs about building on Arc
- Consistent posting with real educational value
- Not just promotional — must be technically informative

HOW TO APPLY:
Step 1: Join Arc Discord
Step 2: Build your project or create your content
Step 3: Share in appropriate Discord channel
Step 4: Request Creator role in designated channel
Step 5: Arc team reviews and assigns role

ARCHITECT ROLE:
- Basic verified member role
- Easier to get — just verify your account
- Entry point before Creator

TIP:
A YouTube demo video showing your dApp working on Arc is one of the most effective ways to get noticed and qualify for Creator role.

SOURCE:
airdrops.io/arc
Arc Discord community
`
  },

  {
    id: "archouse-4",
    keywords: ["arc office hours", "arc discord presentation", "arc office hours submit", "present arc project"],
    title: "What is Arc Office Hours and how do I apply?",
    content: `
SHORT_ANSWER:
Arc Office Hours is a regular session on Arc Discord where builders present their projects, get feedback from the Arc team, and connect with the community. Apply via Google Form.

WHAT IS IT:
- Live presentation sessions on Arc Discord
- Builders demo their projects for 5-10 minutes
- Arc team gives direct feedback
- Community asks questions
- Great for visibility and ecosystem recognition

HOW TO APPLY:
Step 1: Build a working project on Arc (MAINNET or prototype)
Step 2: Fill out the Arc Office Hours Google Form
Step 3: Include: project name, GitHub, demo link, what feedback you want
Step 4: Wait for confirmation from Arc community team
Step 5: Present live on scheduled date

WHAT TO PREPARE:
- 5-10 minute demo of your project
- Live transaction on Arc MAINNET
- Clear explanation of how you use Arc/Circle
- What feedback you're looking for

TIPS FOR ACCEPTANCE:
- Have a working demo (not just slides)
- Show real Arc transactions
- Be clear about your Arc integration
- Engage in Discord before applying

NOTE:
Submitting this form does not guarantee a slot. Arc team reviews for fit, readiness, and available time.

SOURCE:
Arc Discord #announcements channel
`
  },

  // ============================================================
  // C. UNDERSTANDING ARC (COMMUNITY LEVEL)
  // ============================================================
  {
    id: "community-explain-1",
    keywords: ["what is arc simple", "arc blockchain explain", "arc for beginners", "arc explained simply"],
    title: "What is Arc blockchain in simple terms?",
    content: `
SHORT_ANSWER:
Arc is a new blockchain made by Circle (the company that created USDC). Think of it as a fast payment network where you pay transaction fees in USDC dollars instead of ETH or other volatile coins.

SIMPLE EXPLANATION:
Imagine a bank network, but decentralized and on a blockchain:
- You use USDC (digital dollars) for everything
- Paying fees costs pennies in USDC
- Transactions confirm in under 1 second
- Built for payments, not games or NFTs
- Backed by Circle (publicly traded US company)

WHY IT MATTERS:
Traditional blockchains use volatile coins for gas (ETH, BNB, SOL). When ETH price goes up, transaction fees become expensive and unpredictable. Arc solves this by using USDC — fees are always predictable and cheap.

WHO IS BUILDING ON ARC:
- BlackRock (world's largest asset manager)
- Visa (global payments giant)
- Goldman Sachs (top investment bank)
- Mastercard
- Amazon Web Services

KEY FACTS:
- Made by Circle (creator of USDC)
- Circle is publicly traded on NYSE
- Public MAINNET launched October 28, 2025
- Over 100 institutional partners

SOURCE:
docs.arc.io
`
  },

  {
    id: "community-explain-2",
    keywords: ["arc circle same", "is arc circle", "arc vs circle", "circle arc relationship"],
    title: "Is Arc the same as Circle? What is their relationship?",
    content: `
SHORT_ANSWER:
Arc is Circle's blockchain. Circle created and built Arc, just like Apple made iOS. Circle continues to exist as a separate company — Arc is one of their products.

RELATIONSHIP:
- Circle: The company (like Apple)
- USDC: Circle's stablecoin product (like iPhone)
- Arc: Circle's blockchain (like iOS)
- CCTP: Circle's cross-chain protocol (like iCloud)

CIRCLE BACKGROUND:
- Founded 2013 by Jeremy Allaire and Sean Neville
- Issued USDC stablecoin (world's #2 stablecoin by market cap)
- Raised $2.22+ billion in funding
- Went public on NYSE (ticker: CRCL) in June 2025
- Revenue: Billions from USDC reserves interest

WHY CIRCLE BUILT ARC:
Circle needed a blockchain that natively supported stablecoins as gas. Existing chains treat USDC as just another token. Arc makes USDC the core of everything.

KEY POINT:
Circle will continue supporting USDC on 15+ other blockchains (Ethereum, Solana, Base, etc.). Arc is an addition to Circle's ecosystem, not a replacement.

SOURCE:
circle.com
arc.io
`
  },

  {
    id: "community-explain-3",
    keywords: ["is arc safe", "arc scam", "arc legit", "is arc trustworthy", "arc reliable"],
    title: "Is Arc safe and legitimate? Is it a scam?",
    content: `
SHORT_ANSWER:
Arc is legitimate and safe. It is built by Circle, a regulated US financial company that is publicly traded on NYSE. It is not a scam.

WHY ARC IS TRUSTWORTHY:
1. Built by Circle — a regulated, publicly traded US company (NYSE: CRCL)
2. Circle is the issuer of USDC — the world's most regulated stablecoin
3. Circle has published monthly reserve reports since 2018
4. Arc has 100+ institutional partners including BlackRock and Visa
5. Circle raised $2.22+ billion from top investors
6. Open source code — anyone can verify it

RISKS TO BE AWARE OF:
- Arc MAINNET is still in testing phase — bugs possible
- MAINNET USDC has no real value
- No confirmed token or airdrop — be skeptical of claims
- Mainnet not launched yet
- Smart contracts on MAINNET may have vulnerabilities

WHAT IS SAFE:
- Using Arc MAINNET with test USDC (no real money)
- Joining Arc House and Discord
- Building projects on MAINNET
- Creating educational content

WHAT TO AVOID:
- Anyone claiming to sell "Arc tokens" — no token exists yet
- Fake airdrop websites asking for your seed phrase
- Unofficial "Arc" Discords or Telegrams

SOURCE:
circle.com, arc.io
NYSE: CRCL (Circle's stock)
`
  },

  {
    id: "community-explain-4",
    keywords: ["arc partners", "blackrock arc", "visa arc", "goldman arc", "institutional arc", "who uses arc"],
    title: "Who are Arc's institutional partners?",
    content: `
SHORT_ANSWER:
Arc launched with 100+ institutional partners including BlackRock, Visa, Goldman Sachs, HSBC, Mastercard, Amazon Web Services, and Anthropic.

CONFIRMED PARTNERS AT MAINNET LAUNCH (October 2025):
FINANCE:
- BlackRock (world's largest asset manager, $10T AUM)
- Goldman Sachs (top investment bank)
- HSBC (global bank)
- Standard Chartered
- Janus Henderson
- Cumberland (crypto market maker)
- Coinbase

PAYMENTS:
- Visa
- Mastercard
- CopperX

TECHNOLOGY:
- Amazon Web Services (AWS)
- Anthropic (AI company, maker of Claude)

ARC BUILDERS FUND BACKED TEAMS:
- Multiple early-stage fintech startups
- DeFi protocols
- Payment infrastructure companies

WHAT THESE PARTNERS DO ON ARC:
- Test USDC payments infrastructure
- Build stablecoin payment rails
- Explore tokenized real-world assets
- Test FX settlement using StableFX

NOTE:
"Partner" means they are testing on Arc MAINNET. Full production deployments will happen after mainnet launch.

SOURCE:
airdrops.io/arc (May 2026)
`
  },

  // ============================================================
  // D. WALLETS & GETTING STARTED (COMMUNITY LEVEL)
  // ============================================================
  {
    id: "community-wallet-1",
    keywords: ["rabby wallet arc", "rabby arc setup", "rabby MAINNET arc"],
    title: "How do I add Arc MAINNET to Rabby Wallet?",
    content: `
SHORT_ANSWER:
Open Rabby → Click network selector (top-left) → Add Custom Network → Enter Arc details → Confirm.

STEP-BY-STEP:
Step 1: Open Rabby Wallet browser extension
Step 2: Click the network selector in top-left corner
Step 3: Click "Add Custom Network"
Step 4: Fill in:
   - Chain Name: Arc MAINNET
   - Chain ID: 5042002
   - RPC URL: https://rpc.mainnet.arc.io
   - Currency Symbol: USDC
   - Block Explorer: https://explorer.arc.io
Step 5: Click "Confirm"
Step 6: Select Arc MAINNET from your network list

NOTE:
Rabby is a great alternative to MetaMask — it has better security warnings and multi-chain support. Recommended for Arc users.

SOURCE:
docs.arc.io/arc/references/connect-to-arc.md
`
  },

  {
    id: "community-wallet-2",
    keywords: ["coinbase wallet arc", "coinbase arc setup", "coinbase arc MAINNET"],
    title: "How do I add Arc MAINNET to Coinbase Wallet?",
    content: `
SHORT_ANSWER:
Open Coinbase Wallet → Settings → Networks → Add custom network → Enter Arc details.

STEP-BY-STEP:
Step 1: Open Coinbase Wallet app or extension
Step 2: Go to Settings
Step 3: Tap "Networks"
Step 4: Tap "Add custom network"
Step 5: Enter:
   - Network name: Arc MAINNET
   - RPC URL: https://rpc.mainnet.arc.io
   - Chain ID: 5042002
   - Currency symbol: USDC
   - Block explorer: https://explorer.arc.io
Step 6: Tap "Save"
Step 7: Switch to Arc MAINNET

NOTE:
Coinbase Wallet works well with Arc. It's a good choice for users already in the Coinbase ecosystem.

SOURCE:
docs.arc.io/arc/references/connect-to-arc.md
`
  },

  {
    id: "community-wallet-3",
    keywords: ["check arc transaction", "arcscan how to use", "find arc tx", "arc explorer guide"],
    title: "How do I check my transactions on Arc Explorer (ArcScan)?",
    content: `
SHORT_ANSWER:
Go to explorer.arc.io and search your wallet address or transaction hash to see all your Arc activity.

GUIDE:
Step 1: Go to https://explorer.arc.io
Step 2: In the search bar, paste either:
   - Your wallet address (0x...) — shows all transactions
   - Transaction hash (0x...) — shows specific transaction

WHAT YOU CAN SEE:
For wallet address:
- USDC balance
- All transactions sent/received
- Token transfers
- Contract interactions
- Gas used

For transaction hash:
- Status (Success/Pending/Failed)
- Block number
- From/To addresses
- Amount transferred
- Gas fee paid
- Timestamp

USEFUL LINKS:
- Gas tracker: https://explorer.arc.io/gas-tracker
- All transactions: https://explorer.arc.io/txs
- Token list: https://explorer.arc.io/tokens

TIP:
Save your wallet address URL: explorer.arc.io/address/YOUR_ADDRESS for quick access.

SOURCE:
https://explorer.arc.io
`
  },

  // ============================================================
  // E. MAINNET DAPPS
  // ============================================================
  {
    id: "dapps-1",
    keywords: ["arc dapps", "arc ecosystem apps", "what to do arc MAINNET", "arc MAINNET apps", "arc dapp list"],
    title: "What dApps are available on Arc MAINNET?",
    content: `
SHORT_ANSWER:
Arc MAINNET has several active dApps including Zkcodex (contracts/NFTs), Omnihub (NFT marketplace), InfinityName (domains), and MicroAI (AI chatbot). More are launching regularly.

AVAILABLE DAPPS (as of 2026):

NFTs & CREATION:
- Zkcodex: Deploy contracts and mint NFTs without coding
- Omnihub: Create NFT collections
- Ordinal Genesis: NFT collections on Arc

DOMAINS:
- InfinityName: Register .arc domain names

AI & PAYMENTS:
- MicroAI (microai-tan.vercel.app): Pay-per-use AI chatbot, $0.001 USDC per question, Arc & Circle knowledge hub

DEFI & FINANCE:
- StableFX: FX swaps with USDC/EURC (institutional)

CROSS-CHAIN:
- Arc App Kit: Bridge/Swap USDC from other chains

HOW TO FIND MORE:
- Check Arc Discord #ecosystem channel
- Visit arc.house for listed projects
- Follow @arc_xbt on Twitter for new announcements

NOTE:
Arc MAINNET ecosystem is growing fast. New projects launch weekly. The best way to stay updated is Discord and Twitter.

SOURCE:
Arc Discord, cryptorank.io/drophunting/arc-chain-activity
`
  },

  {
    id: "dapps-2",
    keywords: ["mint nft arc", "arc nft", "nft arc MAINNET", "cyan nft arc", "omnihub arc"],
    title: "How do I mint an NFT on Arc MAINNET?",
    content: `
SHORT_ANSWER:
Use Omnihub or Zkcodex to mint NFTs on Arc MAINNET. Connect your wallet, get MAINNET USDC, and mint — it's free except for tiny gas fees.

USING OMNIHUB:
Step 1: Go to Omnihub (search "Omnihub Arc" on Twitter for current link)
Step 2: Connect MetaMask (on Arc MAINNET)
Step 3: Choose an NFT collection to mint
Step 4: Click Mint
Step 5: Confirm USDC gas fee in MetaMask
Step 6: View your NFT on explorer.arc.io

USING ZKCODEX (for creating your own collection):
Step 1: Go to Zkcodex (search current link on Arc Discord)
Step 2: Connect wallet
Step 3: Click "Create" or "Deploy"
Step 4: Follow steps to deploy NFT contract
Step 5: Mint from your new collection

WHAT IS CYAN NFT:
The Cyan NFT was an early Arc MAINNET activity. Mint it to show early participation. Search "Cyan NFT Arc" on Twitter for current link.

NOTE:
NFT platforms' URLs may change. Always get links from official Arc Discord or @arc_xbt Twitter.

SOURCE:
Arc Discord, cryptorank.io/drophunting/arc-chain-activity
`
  },

  {
    id: "dapps-3",
    keywords: ["infinity name arc", "arc domain", "register domain arc", "arc name service"],
    title: "How do I register a domain on Arc (InfinityName)?",
    content: `
SHORT_ANSWER:
InfinityName lets you register .arc domain names on Arc MAINNET. Connect wallet, search for your name, and register with MAINNET USDC.

GUIDE:
Step 1: Find InfinityName current link on Arc Discord
Step 2: Connect MetaMask (Arc MAINNET)
Step 3: Search for your desired domain name
Step 4: Click Register if available
Step 5: Confirm transaction in MetaMask
Step 6: Your domain is registered on-chain

TIPS:
- Get a simple, memorable domain
- Register your Twitter/brand name if available
- Domain registration shows on-chain activity

NOTE:
InfinityName link may have changed. Check Arc Discord #ecosystem or @arc_xbt Twitter for current URL.

SOURCE:
Arc Discord ecosystem channels
`
  },

  {
    id: "dapps-4",
    keywords: ["zkcodex arc", "deploy contract no code", "arc no code deploy", "zkcodex tutorial"],
    title: "How do I deploy a smart contract on Arc without coding (Zkcodex)?",
    content: `
SHORT_ANSWER:
Zkcodex lets you deploy simple contracts on Arc with a few clicks — no Solidity knowledge needed. Great for showing on-chain developer activity.

GUIDE:
Step 1: Find Zkcodex link on Arc Discord or Twitter
Step 2: Connect MetaMask (Arc MAINNET)
Step 3: Click "Deploy" button
Step 4: Choose a simple contract template
Step 5: Confirm the transaction in MetaMask
Step 6: View your deployed contract on explorer.arc.io

WHAT THIS DOES:
- Creates a real smart contract on Arc blockchain
- Shows up in your wallet's transaction history
- Counts as developer activity
- No coding required

NOTE:
Even without coding knowledge, deploying contracts shows meaningful on-chain activity. For real development, use Hardhat or Foundry.

SOURCE:
Arc Discord, cryptorank.io drophunting guide
`
  },

  // ============================================================
  // F. ARC SOCIAL & CONTENT
  // ============================================================
  {
    id: "social-1",
    keywords: ["arc twitter", "arc social media", "arc xbt twitter", "follow arc", "arc official twitter"],
    title: "What are Arc's official social media accounts?",
    content: `
SHORT_ANSWER:
Arc's official Twitter is @arc_xbt. Circle's official Twitter is @circle. Always verify you're following official accounts to avoid scams.

OFFICIAL ACCOUNTS:
Twitter/X:
- @arc_xbt (Arc official)
- @circle (Circle official)
- @jerallaire (Jeremy Allaire, Circle CEO)

Discord:
- Official Arc Discord (get link from arc.io or arc.house)

Website:
- arc.io (Arc official)
- circle.com (Circle official)
- arc.house (Community platform)

Docs:
- docs.arc.io

CONTENT TO FOLLOW FOR:
- New MAINNET dApp launches
- Office Hours announcements
- Token/airdrop news (when it comes)
- Ecosystem partner announcements
- Technical updates

SCAM WARNING:
Fake accounts exist. Never send USDC to anyone claiming to be Arc team. Arc will never DM you asking for your private key or seed phrase.

SOURCE:
arc.io official website
`
  },

  {
    id: "social-2",
    keywords: ["content creator arc", "arc youtube", "arc blog", "arc content", "create arc content"],
    title: "How do I create content about Arc and get recognized?",
    content: `
SHORT_ANSWER:
Create YouTube tutorials, technical blogs, or Twitter threads about building on Arc. Share in Discord #user-made-things and apply for Creator role. Quality content gets retweeted by Arc team.

CONTENT FORMATS THAT WORK:

YOUTUBE (highest value):
- "How to build [dApp type] on Arc" tutorials
- Demo videos showing your project
- "Getting started with Arc" for beginners
- ERC-8004 and ERC-8183 explainers

TWITTER/X (medium value):
- Thread explaining how Arc works
- Demo gif/video of your project
- Building-in-public updates
- Arc ecosystem reviews

TECHNICAL BLOGS (medium value):
- Medium or dev.to articles
- Step-by-step build guides
- Arc vs other chains comparison

TIPS FOR GETTING NOTICED:
Step 1: Tag @arc_xbt in your posts
Step 2: Share in Arc Discord #user-made-things
Step 3: Use hashtag #ArcBlockchain or #BuildOnArc
Step 4: Include real transactions on Arc MAINNET
Step 5: Apply for Creator role after 3-5 quality pieces

WHAT QUALIFIES FOR CREATOR ROLE:
- Multiple quality pieces of content
- Technical accuracy about Arc
- Real demonstrations, not just theory
- Educational value for community

SOURCE:
Arc Discord guidelines, airdrops.io/arc
`
  },

  // ============================================================
  // G. ARC TOKEN DETAILS
  // ============================================================
  {
    id: "token-details-1",
    keywords: ["arc staking", "arc governance", "arc pos", "proof of stake arc", "arc validator"],
    title: "Will Arc have staking and governance?",
    content: `
SHORT_ANSWER:
Yes. Circle CEO confirmed Arc token will enable "governance, incentives, and economic alignment" and eventually transition to proof-of-stake. No implementation timeline yet.

WHAT'S PLANNED:
- Governance: ARC token holders vote on protocol decisions
- Staking: Stake ARC to participate in consensus
- Incentives: Token rewards for validators and contributors
- Proof-of-Stake: Replace current Proof-of-Authority validator set

CURRENT STATE (MAINNET):
- Proof-of-Authority: Arc uses a permissioned validator set of regulated institutions
- No staking yet
- No governance contracts yet

WHAT CEO SAID (Seoul, April 2026):
Arc token will "help provide mechanisms for governance, incentives, economic alignment, and to ultimately move it into a proof-of-stake system over time"

WHAT THIS MEANS FOR USERS:
- Future: Hold ARC to vote on changes
- Future: Stake ARC to earn rewards
- Future: Run a validator node (after PoS transition)

SOURCE:
Circle CEO Jeremy Allaire statement, April 14, 2026
`
  },

  {
    id: "token-details-2",
    keywords: ["run arc node", "arc validator", "arc node setup", "arc node requirements"],
    title: "Can I run an Arc node? How do I become a validator?",
    content: `
SHORT_ANSWER:
Arc currently uses a permissioned Proof-of-Authority validator set of regulated institutions. Public node running is possible for non-validator nodes. PoS with open validators is planned for the future.

CURRENT VALIDATOR SET:
- Permissioned (not open to public yet)
- Composed of regulated financial institutions
- Managed by Arc/Circle
- Will transition to Proof-of-Stake in the future

RUN A NON-VALIDATOR NODE:
Step 1: Check hardware requirements at docs.arc.io/arc/concepts/running-a-node.md
Step 2: Follow setup guide at docs.arc.io/arc/tutorials/run-an-arc-node.md
Step 3: Connect to Arc Mainnet RPC
Step 4: Sync the blockchain

NODE PROVIDERS (if you don't want to run your own):
- Check docs.arc.io/arc/tools/node-providers.md for list of RPC providers

FUTURE PoS:
After ARC token launches and PoS transition:
- Stake ARC tokens to become validator
- Earn rewards for validating
- Participate in governance

SOURCE:
docs.arc.io/arc/concepts/running-a-node.md
docs.arc.io/arc/tutorials/run-an-arc-node.md
`
  },

  {
    id: "token-details-3",
    keywords: ["arc privacy", "opt-in privacy arc", "private transaction arc", "confidential arc"],
    title: "What is opt-in privacy on Arc?",
    content: `
SHORT_ANSWER:
Arc plans to offer opt-in confidential transactions — you choose whether your transaction amounts are public or private. This is planned but not yet live on MAINNET.

WHAT IT MEANS:
- Default: All transactions are public (like Ethereum)
- Opt-in: You can make transaction amounts private
- Selective disclosure: Share view key with specific people (e.g., auditors)
- Amounts are encrypted on-chain
- Sender/receiver may still be visible depending on implementation

WHY IT MATTERS:
- Businesses can keep payment amounts confidential
- Institutions can comply with regulations while maintaining privacy
- Individuals can protect financial privacy
- Still compliant — view keys allow regulators/auditors access

STATUS:
- Privacy Module: PLANNED (not yet live)
- Currently all Arc transactions are fully public
- Expected post-mainnet launch

SOURCE:
docs.arc.io/arc/concepts/opt-in-privacy.md
docs.arc.io/arc/concepts/system-overview.md
`
  },

  // ============================================================
  // H. USYC & ADVANCED
  // ============================================================
  {
    id: "usyc-1",
    keywords: ["usyc arc", "what is usyc", "usyc MAINNET", "tokenized treasury arc", "yield arc"],
    title: "What is USYC on Arc and how do I get it?",
    content: `
SHORT_ANSWER:
USYC is Circle's yield-bearing stablecoin representing shares in a US Treasury money market fund. It's available on Arc but requires allowlisting. Minimum $100,000 USD investment for mainnet (MAINNET is free with approval).

WHAT IS USYC:
- Issued by Circle International Bermuda Ltd.
- Backed by short-duration US Treasury securities
- Earns yield (like a money market fund on-chain)
- Available on Arc MAINNET and other chains

GETTING MAINNET USYC:
Step 1: Get MAINNET USDC from faucet.circle.com
Step 2: Request allowlisting from Circle Support (support.circle.com)
   - Include your Arc MAINNET wallet address
   - Requests processed in 24-48 hours
Step 3: Once approved, go to USYC Portal (usyc.dev.hashnote.com)
Step 4: Deposit MAINNET USDC to receive USYC
Step 5: Or call the USYC Teller contract directly

USYC CONTRACT ADDRESSES (Arc MAINNET):
- USYC: 0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C
- Entitlements: 0xcc205224862c7641930c87679e98999d23c26113
- Teller: 0x9fdF14c5B14173D74C08Af27AebFf39240dC105A

MAINNET RESTRICTIONS:
- Only for institutions outside the US
- $100,000 USD minimum investment
- Full KYC/AML required

SOURCE:
docs.arc.io/arc/references/contract-addresses.md
developers.circle.com/tokenized/usyc/overview
`
  },

  {
    id: "stablefx-1",
    keywords: ["stablefx arc", "fx arc", "foreign exchange arc", "usdc eurc swap", "arc fx"],
    title: "What is StableFX on Arc?",
    content: `
SHORT_ANSWER:
StableFX is Circle's enterprise FX engine on Arc that lets institutions swap between USDC and EURC using a Request-for-Quote (RFQ) model with on-chain settlement.

HOW IT WORKS:
1. Institution requests a quote to swap USDC → EURC (or vice versa)
2. Market makers provide quotes via RFQ
3. Institution accepts best quote
4. Swap settles instantly on Arc via escrow contract
5. No slippage risk — price locked at quote time

STABLEFX CONTRACTS (Arc MAINNET):
- FxEscrow: 0x867650F5eAe8df91445971f14d89fd84F0C9a9f8
- Requires Permit2 for USDC approval
- Permit2: 0x000000000022D473030F116dDEE9F6B43aC78BA3

USE CASES:
- Treasury management (convert USDC to EURC for EU operations)
- International payments in local stablecoins
- FX hedging for businesses
- Cross-currency settlement

NOTE:
StableFX is designed for institutions and enterprise users. Individual users can use Arc App Kit for simpler swaps.

SOURCE:
docs.arc.io/arc/references/contract-addresses.md
developers.circle.com/stablefx
`
  },

  // ============================================================
// NEW ENTRIES FROM REAL ARC DOCS — ADD TO END OF knowledgeBase
// ============================================================

  // CONTRACT ADDRESSES
  {
    id: "arc-contracts-usdc",
    keywords: ["usdc contract", "usdc address", "contract address", "0x3600", "erc20 usdc", "native usdc", "decimals usdc"],
    title: "USDC Contract Address on Arc MAINNET",
    content: `
SHORT_ANSWER:
USDC contract on Arc MAINNET: 0x3600000000000000000000000000000000000000
Important: ERC-20 interface uses 6 decimals. Native USDC gas token uses 18 decimals. Never mix these.

DETAILS:
- USDC is the native gas token AND ERC-20 token on Arc
- Use ERC-20 interface for transferFrom, approve, allowance
- Get MAINNET USDC from: faucet.circle.com (select Arc MAINNET)
- Explorer: explorer.arc.io/address/0x3600000000000000000000000000000000000000
`,
  },
  {
    id: "arc-contracts-eurc",
    keywords: ["eurc", "euro stablecoin", "eurc address", "eurc contract", "euro usdc arc"],
    title: "EURC Contract Address on Arc MAINNET",
    content: `
SHORT_ANSWER:
EURC (Euro stablecoin by Circle) on Arc MAINNET: 0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1
Uses 6 decimals. Get MAINNET EURC from faucet.circle.com.
`,
  },
  {
    id: "arc-contracts-cctp",
    keywords: ["cctp", "cross chain transfer", "token messenger", "message transmitter", "cctp address", "cctp arc", "domain 26", "bridge usdc"],
    title: "CCTP Contract Addresses on Arc MAINNET",
    content: `
SHORT_ANSWER:
Circle Cross-Chain Transfer Protocol (CCTP) contracts on Arc MAINNET (Domain 26):
- TokenMessengerV2: 0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA
- MessageTransmitterV2: 0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275
- TokenMinterV2: 0xb43db544E2c27092c107639Ad201b3dEfAbcF192
- Arc CCTP Domain ID: 26

HOW CCTP WORKS:
1. Burns USDC on source chain
2. Emits a message
3. Circle attests the burn
4. Mints native USDC on destination chain (Arc)
No wrapped tokens — fully native USDC on both sides.
`,
  },
  {
    id: "arc-contracts-usyc",
    keywords: ["usyc", "yield bearing", "tokenized fund", "money market", "usyc address", "treasury token"],
    title: "USYC (Yield-Bearing Token) on Arc MAINNET",
    content: `
SHORT_ANSWER:
USYC is Circle's yield-bearing tokenized money market fund on Arc.
- USYC: 0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C
- Teller (mint/redeem): 0x9fdF14c5B14173D74C08Af27AebFf39240dC105A
- Entitlements (access control): 0xcc205224862c7641930c87679e98999d23c26113

IMPORTANT: Only accessible to institutions outside the US. Minimum $100K USD. Requires allowlisting by Circle Support.
`,
  },

  // CONNECT TO ARC
  {
    id: "arc-connect-network",
    keywords: ["connect wallet", "add network", "metamask arc", "rpc url", "chain id arc", "network config", "MAINNET config", "add arc"],
    title: "How to Connect to Arc MAINNET (Network Config)",
    content: `
SHORT_ANSWER:
Arc MAINNET network config for MetaMask or any EVM wallet:
- Network Name: Arc MAINNET
- RPC URL: https://rpc.mainnet.arc.io
- Chain ID: 5042 (hex: 0x13b2)
- Currency Symbol: USDC
- Block Explorer: https://explorer.arc.io

STEP BY STEP (MetaMask):
1. Open MetaMask → Settings → Networks → Add Network
2. Enter the config above
3. Save and switch to Arc MAINNET
4. Get MAINNET USDC from faucet.circle.com
`,
  },

  // APP KIT
  {
    id: "arc-app-kit-overview",
    keywords: ["app kit", "appkit", "bridge sdk", "swap sdk", "unified balance", "send sdk", "circle sdk", "arc sdk"],
    title: "Arc App Kit — Bridge, Swap, Send, Unified Balance",
    content: `
SHORT_ANSWER:
Arc App Kit is Circle's SDK for payment and liquidity workflows across chains.
Install: npm install @circle-fin/arc-app-kit

CAPABILITIES:
- Bridge: Transfer USDC across chains (EVM, Solana, Circle Wallets)
- Swap: Token swaps on same chain
- Send: Wallet-to-wallet transfers
- Unified Balance: Combine USDC from multiple chains into one spendable balance

Supported chains: Arc, Ethereum, Base, Solana, and more.
Docs: docs.arc.io/app-kit

ADAPTERS: Viem, Ethers, Solana, Circle Wallets
`,
  },
  {
    id: "arc-app-kit-unified-balance",
    keywords: ["unified balance", "chain agnostic", "multichain usdc", "spendable balance", "cross chain balance"],
    title: "Arc Unified Balance — Multichain USDC",
    content: `
SHORT_ANSWER:
Unified Balance combines USDC from multiple blockchains (Ethereum, Base, Solana, Arc, etc.) into a single instantly spendable balance on Arc.

HOW IT WORKS:
1. User deposits USDC from any supported chain
2. App Kit bridges it to Arc via CCTP/Gateway
3. User can now spend from a single unified balance on Arc
4. No need to manually bridge before every transaction

USE CASE: dApps that want users to pay without worrying about which chain their USDC is on.
Docs: docs.arc.io/app-kit/unified-balance
`,
  },

  // AGENTIC ECONOMY DEEP DIVE
  {
    id: "arc-erc8004-deep",
    keywords: ["erc8004", "erc-8004", "ai agent identity", "agent registry", "agent reputation", "register agent", "agent credential"],
    title: "ERC-8004: AI Agent Identity & Reputation on Arc",
    content: `
SHORT_ANSWER:
ERC-8004 is Arc's onchain standard for AI agent identity, reputation, and credential verification.

KEY CONCEPTS:
- Agent Registry: Onchain registry where agents register their identity
- Reputation Events: Verifiable history of agent actions and outcomes
- Credentials: Cryptographic proofs of agent capabilities
- Unique Agent ID: Each agent gets a persistent onchain ID

HOW TO REGISTER:
1. Deploy or connect to the ERC-8004 registry contract on Arc MAINNET
2. Call registerAgent() with metadata (name, description, capabilities)
3. Your agent receives a unique Agent ID
4. Build reputation through completed ERC-8183 jobs

MicroAI's ERC-8004 Agent ID: 69168 (on Arc MAINNET)
Tutorial: docs.arc.io/arc/tutorials/register-your-first-ai-agent
`,
  },
  {
    id: "arc-erc8183-deep",
    keywords: ["erc8183", "erc-8183", "job contract", "escrow job", "agent job", "deliverable", "job settlement", "job lifecycle"],
    title: "ERC-8183: Job Lifecycle & USDC Settlement on Arc",
    content: `
SHORT_ANSWER:
ERC-8183 defines the full lifecycle for AI agent jobs on Arc: creation → escrow → deliverable → evaluation → USDC settlement.

JOB LIFECYCLE:
1. CREATE JOB: Employer creates job with requirements and USDC escrow amount
2. FUND ESCROW: USDC locked in the job contract
3. ACCEPT JOB: Agent accepts and begins work
4. SUBMIT DELIVERABLE: Agent submits proof of work onchain
5. EVALUATE: Employer or oracle evaluates deliverable
6. SETTLE: USDC released to agent or refunded

WHY IT MATTERS:
- Trustless: No need to trust the agent or employer
- Instant: USDC settlement in under 1 second (Arc's deterministic finality)
- Auditable: Full job history onchain

MicroAI's ERC-8183 Job ID: 110278 (on Arc MAINNET)
Tutorial: docs.arc.io/arc/tutorials/create-your-first-erc-8183-job
GitHub example: github.com/circlefin/arc-escrow
`,
  },

  // GAS & FEES
  {
    id: "arc-gas-fees-detail",
    keywords: ["gas fees", "gas price", "usdc gas", "fee model", "stable fees", "transaction cost", "how much gas", "arc fees"],
    title: "Gas & Fees on Arc — USDC-Native Model",
    content: `
SHORT_ANSWER:
Arc uses USDC as the native gas token instead of ETH. Fees are predictable and stable.

FEE MODEL:
- Gas paid in USDC (not ETH/native token)
- Based on EIP-1559 architecture with weighted moving average smoothing
- Fees are low and deterministic — no gas price spikes
- Fee revenue goes to Arc Treasury

FOR DEVELOPERS:
- Set gasPrice in USDC units when submitting transactions
- Use ethers.js / viem normally — just ensure wallet has USDC for gas
- No ETH needed at all on Arc

PAYMASTER:
- EURC can also be used as gas via paymaster contracts
- Account abstraction (ERC-4337) supported via Pimlico, ZeroDev

Docs: docs.arc.io/arc/references/gas-and-fees
`,
  },

  // DEPLOY ON ARC
  {
    id: "arc-deploy-contracts",
    keywords: ["deploy contract", "hardhat arc", "foundry arc", "remix arc", "deploy solidity", "contract deployment", "deploy dapp"],
    title: "Deploy Smart Contracts on Arc MAINNET",
    content: `
SHORT_ANSWER:
Arc is fully EVM-compatible. Use Hardhat, Foundry, or Remix with Arc MAINNET config.

HARDHAT CONFIG:
\`\`\`javascript
networks: {
  arcMAINNET: {
    url: "https://rpc.mainnet.arc.io",
    chainId: 5042,
    accounts: [process.env.PRIVATE_KEY],
  }
}
\`\`\`

FOUNDRY:
\`\`\`bash
forge create --rpc-url https://rpc.mainnet.arc.io \\
  --private-key $PRIVATE_KEY \\
  src/MyContract.sol:MyContract
\`\`\`

REQUIREMENTS:
1. Arc MAINNET USDC in wallet (for gas) — get from faucet.circle.com
2. Private key of your deployer wallet
3. Standard Solidity (0.8.x works perfectly)

Tutorial: docs.arc.io/arc/tutorials/deploy-on-arc
`,
  },

  // CIRCLE DEVELOPER CONTROLLED WALLETS
  {
    id: "circle-dev-wallets",
    keywords: ["developer controlled wallet", "circle wallet", "programmable wallet", "custodial wallet", "circle api wallet", "wallet api"],
    title: "Circle Developer-Controlled Wallets",
    content: `
SHORT_ANSWER:
Circle's Developer-Controlled Wallets let you create and manage wallets programmatically via API — no user MetaMask needed.

USE CASES:
- Backend wallets for dApps
- AI agent wallets (agents can hold and send USDC autonomously)
- Custodial wallet infrastructure
- Pay-per-use flows without user wallet setup

KEY FEATURES:
- REST API for wallet creation, transfers, signing
- Supports Arc, Ethereum, Base, Solana, and more
- MPC security (no single private key)
- USDC transfers via simple API call

HOW TO USE:
1. Sign up at developers.circle.com
2. Create API key
3. POST /wallets to create wallet
4. POST /wallets/{id}/transfers to send USDC

Docs: developers.circle.com/w3s/developer-controlled-wallets
`,
  },

  // PRIVACY
  {
    id: "arc-opt-in-privacy",
    keywords: ["privacy arc", "confidential transfer", "private transaction", "opt in privacy", "confidential balance", "hide amount"],
    title: "Opt-in Privacy on Arc — Confidential Transfers",
    content: `
SHORT_ANSWER:
Arc supports opt-in privacy for confidential transfers — shields transaction AMOUNTS while keeping addresses visible.

HOW IT WORKS:
- Default: Fully transparent (amounts + addresses public)
- Opt-in: Confidential transfers hide the amount transferred
- Addresses remain visible for compliance
- Built using ZK cryptography

USE CASES:
- B2B payments where amounts are sensitive
- Treasury operations
- Institutional trades

Note: This is a premium/enterprise feature. Full privacy (hiding addresses too) is on the roadmap.
Docs: docs.arc.io/arc/concepts/opt-in-privacy
`,
  },

  // MICROAI SPECIFIC
  {
    id: "microai-project-details",
    keywords: ["microai", "micro ai", "this app", "what is this", "about microai", "how does this work", "who built this"],
    title: "About MicroAI — The Arc & Circle Intelligence Hub",
    content: `
SHORT_ANSWER:
MicroAI is a pay-per-use AI chatbot dApp on Arc MAINNET. You pay $0.001 USDC per question answered.

TECHNICAL DETAILS:
- Built by: @auronxbt (BuildOrbit) — solo developer
- Stack: Next.js 15, Groq AI, Arc MAINNET, Circle USDC
- Live at: microai-tan.vercel.app
- GitHub: github.com/sahmedonchain/microai
- Agent ID (ERC-8004): 69168
- Job ID (ERC-8183): 110278

HOW IT WORKS:
1. Connect EVM wallet (MetaMask) on Arc MAINNET
2. Ask any Arc or Circle question
3. Wallet auto-signs 0.001 USDC payment to receiver wallet
4. AI responds instantly with verified knowledge

BUILT FOR: Arc Office Hours submission + Stablecoin Commerce Stack Challenge (Circle/Arc), Track 4 — Agentic Economy.
`,
  },

];