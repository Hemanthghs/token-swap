# Token Swap Program on Solana

A decentralized token swap program built on Solana using the Anchor framework. This program implements a simple automated market maker (AMM) with constant product formula for token swapping.

## Features

- **Pool Initialization**: Create liquidity pools for any SPL token pair
- **Add Liquidity**: Deposit tokens into existing pools
- **Token Swapping**: Swap between tokens using constant product formula (x × y = k)
- **Slippage Protection**: Minimum output amount protection for swaps

## Prerequisites

Before you begin, ensure you have the following installed:

- [Rust](https://rustup.rs/) (latest stable version)
- [Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools) (v1.14.0 or higher)
- [Anchor CLI](https://www.anchor-lang.com/docs/installation) (v0.31.1)
- [Node.js](https://nodejs.org/) (v16 or higher)
- [Yarn](https://yarnpkg.com/) or [npm](https://www.npmjs.com/)

## Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Hemanthghs/token-swap
   cd token-swap
   ```

2. **Install dependencies:**
   ```bash
   yarn install
   # or
   npm install
   ```

## Configuration

1. **Set up Solana CLI for local development:**
   ```bash
   # Set to localhost for local testing
   solana config set --url localhost
   
   # Generate a new keypair (if you don't have one)
   solana-keygen new
   ```

2. **Configure Anchor:**
   ```bash
   # Check your wallet address
   solana address
   
   # Update Anchor.toml with your program ID and wallet
   anchor keys list
   ```


## Deployment

### Deploy to Local Testnet

1. **Start the local Solana test validator:**
   ```bash
   # Start local validator in a new terminal window
   solana-test-validator
   ```
   Keep this terminal open - the validator needs to run continuously.

2. **In a new terminal, configure for localhost:**
   ```bash
   solana config set --url localhost
   
   # Check that you have SOL (local validator provides test SOL automatically)
   solana balance
   ```

3. **Deploy the program to local testnet:**
   ```bash
   anchor deploy
   ```

4. **Verify deployment:**
   ```bash
   solana program show <PROGRAM_ID>
   ```





## Client Usage

### Setup Client for Local Testing

1. **Deploy your program (if not already deployed):**
   ```bash
   # In another terminal
   anchor deploy
   ```

3. **Compile TypeScript:**
   ```bash
   npx tsc
   ```

4. **Run the client:**
   ```bash
   node app/client.js
   ```

### Client Configuration

Make sure your client connects to the local cluster:

```typescript
// In your client code
import * as anchor from "@coral-xyz/anchor";

// Connect to local cluster
const connection = new anchor.web3.Connection("http://localhost:8899", "confirmed");
const provider = new anchor.AnchorProvider(connection, wallet, {});
anchor.setProvider(provider);
```

## Program Instructions

### 1. Initialize Pool
Creates a new liquidity pool for a token pair.

**Parameters:**
- `mint_a`: First token mint
- `mint_b`: Second token mint

### 2. Add Liquidity
Adds tokens to an existing pool.

**Parameters:**
- `amount_a`: Amount of token A to add
- `amount_b`: Amount of token B to add

### 3. Swap
Swaps tokens using the constant product formula.

**Parameters:**
- `amount_in`: Amount of input tokens
- `minimum_amount_out`: Minimum acceptable output amount
- `a_to_b`: Direction of swap (true for A→B, false for B→A)

## Account Structure

### Pool Account
- `authority`: Pool creator's public key
- `mint_a`: First token mint address
- `mint_b`: Second token mint address
- `bump`: PDA bump seed


## Resources

- [Anchor Documentation](https://www.anchor-lang.com/)
- [Solana Documentation](https://docs.solana.com/)
- [SPL Token Documentation](https://spl.solana.com/token)
- [Solana Cookbook](https://solanacookbook.com/)

