import { NextResponse } from "next/server";

const ARC_RPC = "https://rpc.mainnet.arc.io";
const USDC_CONTRACT = "0x3600000000000000000000000000000000000000";
const RECEIVER = "0x9a318CD2BC533B5B2e96F7f5b499738732492b15";

function hexPad(value: string, bytes = 32): string {
  return value.replace("0x", "").padStart(bytes * 2, "0");
}

async function rpcCall(method: string, params: unknown[]) {
  const res = await fetch(ARC_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    cache: "no-store",
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  return data.result;
}

export async function POST(req: Request) {
  try {
    const { userAddress, amount } = await req.json();

    if (!userAddress || !amount) {
      return NextResponse.json({ error: "Missing userAddress or amount" }, { status: 400 });
    }

    const privateKey = process.env.OPERATOR_PRIVATE_KEY;
    if (!privateKey) {
      return NextResponse.json({ error: "Operator not configured" }, { status: 500 });
    }

    const { ethers } = await import("ethers");

    // Static network — no eth_chainId call
    const network = new ethers.Network("arc-MAINNET", 5042002);
    const provider = new ethers.JsonRpcProvider(ARC_RPC, network, {
      staticNetwork: network,
    });

    const operatorKey = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
    const operator = new ethers.Wallet(operatorKey, provider);

    // Check allowance via raw RPC (no ethers provider call)
    const allowanceData = "0xdd62ed3e" +
      hexPad(userAddress) +
      hexPad(operator.address);

    const allowanceHex = await rpcCall("eth_call", [
      { to: USDC_CONTRACT, data: allowanceData },
      "latest",
    ]);

    const allowance = BigInt(allowanceHex || "0x0");
    const amountBigInt = BigInt(amount);

    if (allowance < amountBigInt) {
      return NextResponse.json(
        { error: "Insufficient allowance. User needs to approve first." },
        { status: 400 }
      );
    }

    // Build transferFrom calldata
    const amountHex = amountBigInt.toString(16).padStart(64, "0");
    const transferData = "0x23b872dd" +
      hexPad(userAddress) +
      hexPad(RECEIVER) +
      amountHex;

    // Get nonce via raw RPC
    const nonceHex = await rpcCall("eth_getTransactionCount", [operator.address, "latest"]);
    const nonce = parseInt(nonceHex, 16);

    // Get gas price via raw RPC
    const gasPriceHex = await rpcCall("eth_gasPrice", []);
    const gasPrice = BigInt(gasPriceHex);

    // Build + sign tx (operator signs, no MetaMask)
    const tx = {
  type: 0,
  to: USDC_CONTRACT,
  data: transferData,
  nonce,
  gasPrice,
  gasLimit: BigInt(150000),
  chainId: 5042002,
  value: BigInt(0),
};

    const signedTx = await operator.signTransaction(tx);

    // Send via raw RPC
    const txHash = await rpcCall("eth_sendRawTransaction", [signedTx]);

    return NextResponse.json({ success: true, txHash });

  } catch (err: unknown) {
    const error = err as { message?: string };
    console.error("Payment error:", error?.message);
    return NextResponse.json(
      { error: error?.message || "Payment failed" },
      { status: 500 }
    );
  }
}