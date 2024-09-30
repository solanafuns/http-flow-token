//  https://github.com/solana-labs/solana-program-library.git
// cd solana-program-library/token/js 源码部分

import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  createMint,
  getMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";

import fs from "fs";

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

async function main() {
  console.log("payer address : ", payer.publicKey.toBase58());

  // const url = clusterApiUrl("devnet");
  const url = "http://127.0.0.1:8899";

  // 创建连接到本地 Solana 节点
  const connection = new Connection(url, {
    commitment: "finalized",
    confirmTransactionInitialTimeout: 60000, // 设置超时时间为 60 秒
  });

  const balance = await connection.getBalance(payer.publicKey);
  if (balance < 2 * LAMPORTS_PER_SOL) {
    const tx = await connection.requestAirdrop(
      payer.publicKey,
      2 * LAMPORTS_PER_SOL
    );
    // BlockheightBasedTransactionConfirmationStrategy
    await connection.confirmTransaction(tx);
  } else {
    console.log("balance is enough", balance / LAMPORTS_PER_SOL);
  }

  console.log("mint authority address : ", mint_pair.publicKey.toBase58());

  const mint = await createMint(
    connection,
    payer,
    mint_pair.publicKey,
    mint_pair.publicKey,
    9,
    Keypair.generate(),
    {
      commitment: "finalized",
    },
    TOKEN_2022_PROGRAM_ID
  );

  console.log("mint public key", mint.toBase58());

  const info = await getMint(
    connection,
    mint,
    "finalized",
    TOKEN_2022_PROGRAM_ID
  );
  console.log("mint info : ", info);

  // this will create a new account for the token called ata
  const current = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mint,
    payer.publicKey,
    true,
    "finalized",
    {
      commitment: "finalized",
    },
    TOKEN_2022_PROGRAM_ID
  );
  console.log("current spl token account : ", current.address.toBase58());

  // then you can transfer the token to the ata
  const tx = await mintTo(
    connection,
    payer,
    mint,
    current.address,
    mint_pair,
    1000000,
    [],
    {
      commitment: "finalized",
    },
    TOKEN_2022_PROGRAM_ID
  );
  console.log(tx);

  const mintAccount = await getMint(
    connection,
    mint,
    "finalized",
    TOKEN_2022_PROGRAM_ID
  );
  console.log(mintAccount);
}

main().catch((err) => {
  console.error("Error in main function:", err);
});
