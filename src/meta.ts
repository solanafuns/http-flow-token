//  https://developers.metaplex.com/token-metadata/getting-started/js
// https://medium.com/@jimsinjaradze/uploading-token-metadata-on-solana-with-umi-33c40358b339

import {
  clusterApiUrl,
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SendTransactionError,
} from "@solana/web3.js";
import { fromWeb3JsPublicKey } from "@metaplex-foundation/umi-web3js-adapters";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  findMetadataPda,
  mplTokenMetadata,
  updateMetadataAccountV2,
} from "@metaplex-foundation/mpl-token-metadata";
import { sol } from "@metaplex-foundation/umi";
import fs from "fs";
import {
  createSignerFromKeypair,
  signerIdentity,
} from "@metaplex-foundation/umi";
import { base58, publicKey } from "@metaplex-foundation/umi/serializers";

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
  const url = clusterApiUrl("devnet");
  // const url = "http://127.0.0.1:8899";
  const umi = createUmi(url).use(mplTokenMetadata());

  const keypair = umi.eddsa.createKeypairFromSecretKey(payer.secretKey);
  const signer = createSignerFromKeypair(umi, keypair);
  umi.use(signerIdentity(signer));
  umi.payer = signer;

  const balance = await umi.rpc.getBalance(signer.publicKey);
  console.log("balance : ", balance);

  if (balance.basisPoints < 0.1 * LAMPORTS_PER_SOL) {
    console.log("airdrop ?");
    await umi.rpc.airdrop(signer.publicKey, sol(2));
  }
  console.log("let's update meta data . ");
  // Create metadata for the token
  let CreateMetadataAccountV3Args = {
    mint: fromWeb3JsPublicKey(
      new PublicKey("D6VyFvQxjY1PpAb2TrEESkWSUSeqE4iS4Juj9yjGXSXk")
    ),
    mintAuthority: umi.eddsa.createKeypairFromSecretKey(
      mint_pair.secretKey
    ) as any,
    updateAuthority: fromWeb3JsPublicKey(mint_pair.publicKey),
    payer: signer,
    data: {
      name: "Http Flow Token",
      symbol: "HFT",
      uri: "https://example.com/metadata.json", // Ensure this points to a valid metadata JSON file
      sellerFeeBasisPoints: 0,
      creators: null,
      collection: null,
      uses: null,
    },
    primarySaleHappened: false,
    isMutable: true,
    collectionDetails: null,
  };

  try {
    let instruction = updateMetadataAccountV2(umi, CreateMetadataAccountV3Args);
    const transaction = await instruction.buildAndSign(umi);
    const transactionSignature = await umi.rpc.sendTransaction(transaction);
    const signature = base58.deserialize(transactionSignature);
    console.log({ signature });
  } catch (err) {
    if (err instanceof SendTransactionError) {
      console.error("SendTransactionError:", err);
      console.error("Logs:", err.logs);
    } else {
      console.error("Unexpected error:", err);
    }
  }
}

main().catch((err) => {
  console.error("Error in main function:", err);
});
