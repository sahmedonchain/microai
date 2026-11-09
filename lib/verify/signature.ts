import { verifyTypedData } from "ethers";

// Offline EIP-3009 signature check. It recovers the signer of a
// TransferWithAuthorization from the EIP-712 data and compares it with the
// payer (`authorization.from`). No network call.
//
// The EIP-712 domain is { name, version, chainId, verifyingContract }. The x402
// exact-EVM spec says name and version come from `extra.name` / `extra.version`
// of the payment requirements. So "match" means: the signature is valid for the
// domain the SERVICE declared. It does not prove the token contract uses that
// same domain, that the payer has funds, or that the nonce is unused.

export const TRANSFER_WITH_AUTHORIZATION_TYPES = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
};

export interface SignatureInput {
  authorization: { from: string; to: string; value: string; validAfter: string; validBefore: string; nonce: string };
  signature: string;
  chainId: number;
  verifyingContract: string;
  name?: string;
  version?: string;
}

export type SignatureResult =
  | { status: "match"; recovered: string }
  | { status: "mismatch"; recovered?: string }
  | { status: "no_domain" }
  | { status: "unsupported"; reason: string };

export function checkEip3009Signature(i: SignatureInput): SignatureResult {
  if (!i.name || !i.version) return { status: "no_domain" };
  // A plain account signature is 65 bytes. Smart-wallet (ERC-1271) and other
  // signatures need an on-chain call, which this offline check does not make.
  if (!/^0x[0-9a-fA-F]{130}$/.test(i.signature)) return { status: "unsupported", reason: "Not a 65-byte signature. Smart-wallet signatures need an on-chain check." };
  try {
    const a = i.authorization;
    const recovered = verifyTypedData(
      { name: i.name, version: i.version, chainId: i.chainId, verifyingContract: i.verifyingContract.toLowerCase() },
      TRANSFER_WITH_AUTHORIZATION_TYPES,
      { from: a.from.toLowerCase(), to: a.to.toLowerCase(), value: a.value, validAfter: a.validAfter, validBefore: a.validBefore, nonce: a.nonce },
      i.signature
    );
    return recovered.toLowerCase() === a.from.toLowerCase() ? { status: "match", recovered } : { status: "mismatch", recovered };
  } catch {
    return { status: "mismatch" };
  }
}
