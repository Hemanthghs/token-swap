import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, Wallet, BN } from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  getAssociatedTokenAddress,
  getAccount,
} from "@solana/spl-token";
import { SimpleSwap } from "../target/types/simple_swap";

const simpleSwapIdl = require("../target/idl/simple_swap.json");

class SwapClient {
  connection: Connection;
  provider: AnchorProvider;
  program: Program<SimpleSwap>;
  payer: Keypair;
  liquidityProvider: Keypair; // User who provides liquidity
  trader: Keypair; // User who performs swaps
  mintA: PublicKey;
  mintB: PublicKey;
  mintAuthority: Keypair;

  // Add decimals constant for better management
  readonly TOKEN_DECIMALS = 6; // Reduce from 9 to 6 to prevent overflow

  constructor() {
    // Connect to devnet
    this.connection = new Connection("http://localhost:8899", "confirmed");

    // Create keypairs
    this.payer = Keypair.generate();
    this.liquidityProvider = Keypair.generate(); // LP user
    this.trader = Keypair.generate(); // Trading user
    this.mintAuthority = Keypair.generate();

    // Setup provider and program
    const wallet = new Wallet(this.payer);
    this.provider = new AnchorProvider(this.connection, wallet, {});
    anchor.setProvider(this.provider);
    this.program = new Program<SimpleSwap>(simpleSwapIdl, this.provider);
  }

  // Helper function to convert tokens to lamports for Anchor (returns BN)
  private tokenToLamports(amount: number): BN {
    return new BN(amount * Math.pow(10, this.TOKEN_DECIMALS));
  }

  // Helper function to convert tokens to lamports for SPL Token (returns number)
  private tokenToLamportsNumber(amount: number): number {
    return amount * Math.pow(10, this.TOKEN_DECIMALS);
  }

  // Helper function to convert lamports to tokens
  private lamportsToToken(lamports: BN | bigint | number): number {
    return Number(lamports) / Math.pow(10, this.TOKEN_DECIMALS);
  }

  async initialize() {
    console.log("🚀 Initializing swap demo with separate users...\n");

    // Airdrop SOL to accounts
    await this.airdropSol(this.payer.publicKey, 2);
    await this.airdropSol(this.liquidityProvider.publicKey, 1);
    await this.airdropSol(this.trader.publicKey, 1);
    await this.airdropSol(this.mintAuthority.publicKey, 1);

    console.log("💰 Airdropped SOL to accounts");
    console.log(`Payer: ${this.payer.publicKey.toBase58()}`);
    console.log(
      `Liquidity Provider: ${this.liquidityProvider.publicKey.toBase58()}`
    );
    console.log(`Trader: ${this.trader.publicKey.toBase58()}`);
    console.log(`Mint Authority: ${this.mintAuthority.publicKey.toBase58()}\n`);

    // Create token mints
    await this.createTokenMints();
    await this.setupLiquidityProviderTokenAccounts();
    await this.setupTraderTokenAccounts();
  }

  async airdropSol(publicKey: PublicKey, amount: number) {
    const signature = await this.connection.requestAirdrop(
      publicKey,
      amount * LAMPORTS_PER_SOL
    );
    await this.connection.confirmTransaction(signature, "confirmed");
  }

  async createTokenMints() {
    console.log("🪙 Creating token mints...");

    // Create Token A with reduced decimals
    this.mintA = await createMint(
      this.connection,
      this.payer,
      this.mintAuthority.publicKey,
      null,
      this.TOKEN_DECIMALS // Use consistent decimals
    );

    // Create Token B with reduced decimals
    this.mintB = await createMint(
      this.connection,
      this.payer,
      this.mintAuthority.publicKey,
      null,
      this.TOKEN_DECIMALS // Use consistent decimals
    );

    console.log(`Token A Mint: ${this.mintA.toBase58()}`);
    console.log(`Token B Mint: ${this.mintB.toBase58()}\n`);
  }

  async setupLiquidityProviderTokenAccounts() {
    console.log("📦 Setting up Liquidity Provider token accounts...");

    // Create associated token accounts for liquidity provider
    const lpTokenA = await createAssociatedTokenAccount(
      this.connection,
      this.payer,
      this.mintA,
      this.liquidityProvider.publicKey
    );

    const lpTokenB = await createAssociatedTokenAccount(
      this.connection,
      this.payer,
      this.mintB,
      this.liquidityProvider.publicKey
    );

    // Mint tokens to liquidity provider (they need both tokens to provide liquidity)
    const mintAmount = this.tokenToLamportsNumber(1000); // 1000 tokens each

    await mintTo(
      this.connection,
      this.payer,
      this.mintA,
      lpTokenA,
      this.mintAuthority,
      mintAmount
    );

    await mintTo(
      this.connection,
      this.payer,
      this.mintB,
      lpTokenB,
      this.mintAuthority,
      mintAmount
    );

    console.log(`LP Token A Account: ${lpTokenA.toBase58()}`);
    console.log(`LP Token B Account: ${lpTokenB.toBase58()}`);
    console.log(
      "💰 Minted 1000 Token A and 1000 Token B to Liquidity Provider\n"
    );
  }

  async setupTraderTokenAccounts() {
    console.log("📦 Setting up Trader token accounts...");

    // Create associated token accounts for trader
    const traderTokenA = await createAssociatedTokenAccount(
      this.connection,
      this.payer,
      this.mintA,
      this.trader.publicKey
    );

    const traderTokenB = await createAssociatedTokenAccount(
      this.connection,
      this.payer,
      this.mintB,
      this.trader.publicKey
    );

    // Mint only Token A to trader (they want to swap A for B)
    const mintAmount = this.tokenToLamportsNumber(100); // 100 Token A only

    await mintTo(
      this.connection,
      this.payer,
      this.mintA,
      traderTokenA,
      this.mintAuthority,
      mintAmount
    );

    // Trader starts with 0 Token B (this is what they want to get)
    console.log(`Trader Token A Account: ${traderTokenA.toBase58()}`);
    console.log(`Trader Token B Account: ${traderTokenB.toBase58()}`);
    console.log(
      "💰 Minted 100 Token A to Trader (0 Token B - they'll get this from swapping)\n"
    );
  }

  async initializePool() {
    console.log("🏊 Initializing swap pool...");

    // Derive PDAs
    const [poolPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("pool"), this.mintA.toBuffer(), this.mintB.toBuffer()],
      this.program.programId
    );

    const [vaultA] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault_a"), poolPda.toBuffer()],
      this.program.programId
    );

    const [vaultB] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault_b"), poolPda.toBuffer()],
      this.program.programId
    );

    try {
      const tx = await this.program.methods
        .initializePool()
        .accounts({
          authority: this.payer.publicKey,
          pool: poolPda,
          mintA: this.mintA,
          mintB: this.mintB,
          vaultA: vaultA,
          vaultB: vaultB,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        } as any)
        .signers([this.payer])
        .rpc();

      console.log(`✅ Pool initialized! Transaction: ${tx}`);
      console.log(`Pool PDA: ${poolPda.toBase58()}`);
      console.log(`Vault A: ${vaultA.toBase58()}`);
      console.log(`Vault B: ${vaultB.toBase58()}\n`);

      return { poolPda, vaultA, vaultB };
    } catch (error) {
      console.error("❌ Error initializing pool:", error);
      throw error;
    }
  }

  async addLiquidity(
    poolPda: PublicKey,
    vaultA: PublicKey,
    vaultB: PublicKey,
    amountA: number,
    amountB: number
  ) {
    console.log(
      `💧 Liquidity Provider adding liquidity: ${amountA} Token A, ${amountB} Token B...`
    );

    const lpTokenA = await getAssociatedTokenAddress(
      this.mintA,
      this.liquidityProvider.publicKey
    );
    const lpTokenB = await getAssociatedTokenAddress(
      this.mintB,
      this.liquidityProvider.publicKey
    );

    // Show LP balances before adding liquidity
    await this.showUserBalances(
      lpTokenA,
      lpTokenB,
      "Liquidity Provider before adding liquidity:",
      "LP"
    );

    try {
      const tx = await this.program.methods
        .addLiquidity(
          this.tokenToLamports(amountA),
          this.tokenToLamports(amountB)
        )
        .accounts({
          user: this.liquidityProvider.publicKey,
          pool: poolPda,
          userTokenA: lpTokenA,
          userTokenB: lpTokenB,
          vaultA: vaultA,
          vaultB: vaultB,
          tokenProgram: TOKEN_PROGRAM_ID,
        } as any)
        .signers([this.liquidityProvider])
        .rpc();

      console.log(`✅ Liquidity added! Transaction: ${tx}`);

      // Show LP balances after adding liquidity
      await this.showUserBalances(
        lpTokenA,
        lpTokenB,
        "Liquidity Provider after adding liquidity:",
        "LP"
      );

      // Show vault balances
      await this.showVaultBalances(vaultA, vaultB);
    } catch (error) {
      console.error("❌ Error adding liquidity:", error);
      throw error;
    }
  }

  async swap(
    poolPda: PublicKey,
    vaultA: PublicKey,
    vaultB: PublicKey,
    amountIn: number,
    minAmountOut: number,
    aToB: boolean
  ) {
    console.log(
      `🔄 Trader swapping ${amountIn} ${aToB ? "Token A" : "Token B"} for ${
        aToB ? "Token B" : "Token A"
      }...`
    );

    const traderTokenA = await getAssociatedTokenAddress(
      this.mintA,
      this.trader.publicKey
    );
    const traderTokenB = await getAssociatedTokenAddress(
      this.mintB,
      this.trader.publicKey
    );

    // Show trader balances before swap
    await this.showUserBalances(
      traderTokenA,
      traderTokenB,
      "Trader before swap:",
      "Trader"
    );

    // Calculate expected output for verification
    const expectedOutput = await this.calculateSwapOutput(
      vaultA,
      vaultB,
      amountIn,
      aToB
    );
    console.log(`Expected output: ~${expectedOutput.toFixed(4)} tokens`);

    try {
      const tx = await this.program.methods
        .swap(
          this.tokenToLamports(amountIn),
          this.tokenToLamports(minAmountOut),
          aToB
        )
        .accounts({
          user: this.trader.publicKey,
          pool: poolPda,
          userTokenA: traderTokenA,
          userTokenB: traderTokenB,
          vaultA: vaultA,
          vaultB: vaultB,
          tokenProgram: TOKEN_PROGRAM_ID,
        } as any)
        .signers([this.trader])
        .rpc();

      console.log(`✅ Swap completed! Transaction: ${tx}`);

      // Show balances after swap
      await this.showUserBalances(
        traderTokenA,
        traderTokenB,
        "Trader after swap:",
        "Trader"
      );
      await this.showVaultBalances(vaultA, vaultB);
    } catch (error) {
      console.error("❌ Error performing swap:", error);
      throw error;
    }
  }

  // Helper function to calculate expected swap output
  async calculateSwapOutput(
    vaultA: PublicKey,
    vaultB: PublicKey,
    amountIn: number,
    aToB: boolean
  ): Promise<number> {
    try {
      const accountA = await getAccount(this.connection, vaultA);
      const accountB = await getAccount(this.connection, vaultB);

      const vaultABalance = this.lamportsToToken(accountA.amount);
      const vaultBBalance = this.lamportsToToken(accountB.amount);

      if (aToB) {
        // amount_out = (amount_in * vault_b) / (vault_a + amount_in)
        return (amountIn * vaultBBalance) / (vaultABalance + amountIn);
      } else {
        // amount_out = (amount_in * vault_a) / (vault_b + amount_in)
        return (amountIn * vaultABalance) / (vaultBBalance + amountIn);
      }
    } catch (error) {
      console.log("Could not calculate expected output:", error);
      return 0;
    }
  }

  async showUserBalances(
    userTokenA: PublicKey,
    userTokenB: PublicKey,
    label: string,
    userType: string
  ) {
    try {
      const accountA = await getAccount(this.connection, userTokenA);
      const accountB = await getAccount(this.connection, userTokenB);

      console.log(`📊 ${label}`);
      console.log(
        `  ${userType} Token A: ${this.lamportsToToken(accountA.amount)}`
      );
      console.log(
        `  ${userType} Token B: ${this.lamportsToToken(accountB.amount)}`
      );
    } catch (error) {
      console.log(`❌ Error fetching ${userType} balances: ${error}`);
    }
  }

  async showVaultBalances(vaultA: PublicKey, vaultB: PublicKey) {
    try {
      const accountA = await getAccount(this.connection, vaultA);
      const accountB = await getAccount(this.connection, vaultB);

      console.log(`🏦 Pool Vault Balances:`);
      console.log(`  Vault A: ${this.lamportsToToken(accountA.amount)}`);
      console.log(`  Vault B: ${this.lamportsToToken(accountB.amount)}\n`);
    } catch (error) {
      console.log(`❌ Error fetching vault balances: ${error}`);
    }
  }

  async demonstrateSwap() {
    try {
      console.log("🎭 DEMO SCENARIO:");
      console.log(
        "👤 Liquidity Provider: Has both Token A & B, will provide liquidity"
      );
      console.log("🤝 Trader: Has only Token A, wants to swap for Token B");
      console.log(
        "======================================================" + "\n"
      );

      // Initialize everything
      await this.initialize();

      // Initialize pool
      const { poolPda, vaultA, vaultB } = await this.initializePool();

      // Liquidity Provider adds liquidity
      await this.addLiquidity(poolPda, vaultA, vaultB, 50, 50);

      console.log("⏳ Waiting 2 seconds before first swap...\n");
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Trader swaps Token A for Token B
      await this.swap(poolPda, vaultA, vaultB, 10, 5, true);

      console.log("⏳ Waiting 2 seconds before second swap...\n");
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Trader swaps some Token B back for Token A (if they have any B now)
      await this.swap(poolPda, vaultA, vaultB, 3, 1, false);

      console.log("🎉 Demo completed successfully!");
    } catch (error) {
      console.error("💥 Demo failed:", error);
    }
  }
}

// Run the demo
async function main() {
  const client = new SwapClient();
  await client.demonstrateSwap();
}

main().catch(console.error);
