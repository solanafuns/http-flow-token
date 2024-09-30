import {
  createInitializeMetadataPointerInstruction,
  createInitializeMintInstruction,
  createMintToInstruction,
  ExtensionType,
  getMintLen,
  getOrCreateAssociatedTokenAccount,
  LENGTH_SIZE,
  TOKEN_2022_PROGRAM_ID,
  TYPE_SIZE,
} from "@solana/spl-token";
import {
  createInitializeInstruction,
  createUpdateFieldInstruction,
  pack,
  TokenMetadata,
} from "@solana/spl-token-metadata";
import {
  clusterApiUrl,
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

if (!fs.existsSync("key.json")) {
  const pair = Keypair.generate();
  fs.writeFileSync("key.json", JSON.stringify(Array.from(pair.secretKey)));
}

const payer = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync("key.json", "utf-8")))
);

if (!fs.existsSync("mint.json")) {
  const pair = Keypair.generate();
  fs.writeFileSync("mint.json", JSON.stringify(Array.from(pair.secretKey)));
}

const mint_pair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync("mint.json", "utf-8")))
);

const main = async () => {
  const url = clusterApiUrl(process.env.network as any);
  // const url = "http://localhost:8899";
  const connection = new Connection(url, "confirmed");

  const balance = await connection.getBalance(payer.publicKey);
  if (balance < 2 * LAMPORTS_PER_SOL) {
    const tx = await connection.requestAirdrop(
      payer.publicKey,
      3 * LAMPORTS_PER_SOL
    );
    await connection.confirmTransaction({
      signature: tx,
      ...(await connection.getLatestBlockhash()),
    });
  } else {
    console.log("balance is enough", balance / LAMPORTS_PER_SOL);
  }

  const metaData: TokenMetadata = {
    updateAuthority: mint_pair.publicKey,
    mint: mint_pair.publicKey,
    name: "OPOS",
    symbol: "OPOS",
    uri: "https://raw.githubusercontent.com/solana-developers/opos-asset/main/assets/DeveloperPortal/metadata.json",
    additionalMetadata: [["description", "Only Possible On Solana"]],
  };

  const mintSpace = getMintLen([ExtensionType.MetadataPointer]);
  const mestaSpace = TYPE_SIZE + LENGTH_SIZE + pack(metaData).length;

  const lamports = await connection.getMinimumBalanceForRentExemption(
    mestaSpace + mintSpace
  );

  console.log("need ", lamports);

  const createAccontIx = SystemProgram.createAccount({
    fromPubkey: payer.publicKey,
    newAccountPubkey: mint_pair.publicKey,
    space: mintSpace,
    lamports,
    programId: TOKEN_2022_PROGRAM_ID,
  });

  const initializeMetadataIx = createInitializeMetadataPointerInstruction(
    mint_pair.publicKey,
    payer.publicKey,
    mint_pair.publicKey,
    TOKEN_2022_PROGRAM_ID
  );

  const initialzeMintIx = createInitializeMintInstruction(
    mint_pair.publicKey,
    2,
    payer.publicKey,
    null,
    TOKEN_2022_PROGRAM_ID
  );

  const initialMetadataIx = createInitializeInstruction({
    mint: mint_pair.publicKey,
    metadata: mint_pair.publicKey,
    mintAuthority: payer.publicKey,
    name: metaData.name,
    symbol: metaData.symbol,
    uri: metaData.uri,
    programId: TOKEN_2022_PROGRAM_ID,
    updateAuthority: payer.publicKey,
  });

  const updateMetaField = createUpdateFieldInstruction({
    metadata: mint_pair.publicKey,
    programId: TOKEN_2022_PROGRAM_ID,
    updateAuthority: payer.publicKey,
    field: metaData.additionalMetadata[0][0],
    value: metaData.additionalMetadata[0][1],
  });

  const spl_token_account = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mint_pair.publicKey,
    payer.publicKey
  );

  const mintToTx = createMintToInstruction(
    mint_pair.publicKey,
    spl_token_account.address,
    payer.publicKey,
    1000
  );

  const transaction = new Transaction().add(
    createAccontIx,
    initializeMetadataIx,
    initialzeMintIx,
    initialMetadataIx,
    updateMetaField,
    mintToTx
  );

  const sig = await sendAndConfirmTransaction(connection, transaction, [
    payer,
    mint_pair,
  ]);

  console.log("sig: ", sig);
};

main()
  .then(() => {
    console.log("done!");
  })
  .catch((err) => {
    console.log(err);
  });
