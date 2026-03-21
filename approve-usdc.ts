import { Wallet, ethers } from "ethers";

const PK = process.env.POLYMARKET_PRIVATE_KEY!;
const RPC = "https://polygon.drpc.org";
const USDC = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
const SPENDERS = [
  ["CTF Exchange", "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E"],
  ["NegRisk Adapter", "0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296"],
  ["NegRisk Exchange", "0xC5d563A36AE78145C45a50134d48A1215220f80a"],
];
const ABI = [
  "function approve(address,uint256) returns (bool)",
  "function allowance(address,address) view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
];

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(RPC);
  const wallet = new Wallet(PK, provider);
  const usdc = new ethers.Contract(USDC, ABI, wallet);

  const bal = await usdc.balanceOf(wallet.address);
  const polBal = await provider.getBalance(wallet.address);
  console.log("Wallet:", wallet.address);
  console.log("USDC:", ethers.utils.formatUnits(bal, 6));
  console.log("POL:", ethers.utils.formatEther(polBal));

  for (const [name, sp] of SPENDERS) {
    const a = await usdc.allowance(wallet.address, sp);
    const formatted = ethers.utils.formatUnits(a, 6);
    console.log(`${name} allowance: ${formatted}`);
    if (a.lt(ethers.utils.parseUnits("1000", 6))) {
      console.log(`  Approving ${name}...`);
      try {
        const tx = await usdc.approve(sp, ethers.constants.MaxUint256);
        console.log(`  TX: ${tx.hash}`);
        const receipt = await tx.wait();
        console.log(`  Confirmed! Gas: ${receipt.gasUsed.toString()}`);
      } catch (e: any) {
        console.error(`  FAILED: ${e.message?.slice(0, 200)}`);
      }
    } else {
      console.log("  Already approved");
    }
  }
  console.log("Done!");
}
main().catch(e => console.error(e.message || e));
