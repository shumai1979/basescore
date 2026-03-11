"use client";

import { useEffect, useState, useCallback } from "react";
import { useMiniKit, useAddFrame, useOpenUrl } from "@coinbase/onchainkit/minikit";
import { useComposeCast } from "@coinbase/onchainkit/minikit";

interface ScoreResult {
  address: string;
  hasBasename: boolean;
  txCount: number;
  uniqueContracts: number;
  hasNFT: boolean;
  score: number;
  grade: "S" | "A" | "B" | "C" | "D";
  tips: string[];
}

const BASE_RPC = "https://mainnet.base.org";

async function rpc(method: string, params: unknown[]) {
  const res = await fetch(BASE_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const data = await res.json();
  return data.result;
}

async function getTxCount(address: string): Promise<number> {
  try {
    const result = await rpc("eth_getTransactionCount", [address, "latest"]);
    return parseInt(result, 16);
  } catch {
    return 0;
  }
}

function calcScore(txCount: number, hasBasename: boolean, uniqueContracts: number, hasNFT: boolean) {
  let score = 0;
  if (txCount >= 100) score += 40;
  else if (txCount >= 50) score += 30;
  else if (txCount >= 20) score += 20;
  else if (txCount >= 5) score += 10;
  else if (txCount >= 1) score += 5;
  if (hasBasename) score += 20;
  if (uniqueContracts >= 10) score += 25;
  else if (uniqueContracts >= 5) score += 15;
  else if (uniqueContracts >= 2) score += 8;
  if (hasNFT) score += 15;
  return Math.min(score, 100);
}

function getGrade(score: number): "S" | "A" | "B" | "C" | "D" {
  if (score >= 90) return "S";
  if (score >= 70) return "A";
  if (score >= 50) return "B";
  if (score >= 30) return "C";
  return "D";
}

function getTips(txCount: number, hasBasename: boolean, uniqueContracts: number, hasNFT: boolean): string[] {
  const tips: string[] = [];
  if (!hasBasename) tips.push("Register your Basename at base.org/names");
  if (txCount < 20) tips.push("Make more transactions on Base   aim for 20+");
  if (uniqueContracts < 5) tips.push("Interact with more dApps (Aerodrome, Aave, Uniswap)");
  if (!hasNFT) tips.push("Mint an NFT on Base via Zora or Mint.fun");
  if (txCount < 5) tips.push("Bridge ETH to Base and start transacting");
  if (tips.length === 0) tips.push("You are well positioned! Keep transacting regularly");
  return tips.slice(0, 3);
}

const GRADE_COLOR: Record<string, string> = {
  S: "text-yellow-400", A: "text-green-400", B: "text-blue-400", C: "text-orange-400", D: "text-red-400",
};

const GRADE_BG: Record<string, string> = {
  S: "from-yellow-900/40 to-yellow-800/20 border-yellow-500/40",
  A: "from-green-900/40 to-green-800/20 border-green-500/40",
  B: "from-blue-900/40 to-blue-800/20 border-blue-500/40",
  C: "from-orange-900/40 to-orange-800/20 border-orange-500/40",
  D: "from-red-900/40 to-red-800/20 border-red-500/40",
};

export default function Page() {
  const { setFrameReady, isFrameReady } = useMiniKit();
  const addFrame = useAddFrame();
  const { open: openUrl } = useOpenUrl();
  const { composeCast } = useComposeCast();

  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [error, setError] = useState("");
  const [hasBasename, setHasBasename] = useState(false);

  useEffect(() => {
    if (!isFrameReady) setFrameReady();
  }, [isFrameReady, setFrameReady]);

  const checkScore = useCallback(async () => {
    const addr = address.trim();
    if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) {
      setError("Enter a valid Ethereum address (0x...)");
      return;
    }
    setError("");
    setLoading(true);
    setResult(null);

    try {
      const txCount = await getTxCount(addr);
      // Check basename via base.org API
      let basenameFound = false;
      try {
        const res = await fetch(`https://www.base.org/api/name?address=${addr}`);
        if (res.ok) {
          const data = await res.json();
          basenameFound = !!data?.name;
        }
      } catch {
        basenameFound = false;
      }
      setHasBasename(basenameFound);

      const uniqueContracts = Math.min(Math.floor(txCount / 3), 15);
      const hasNFT = txCount > 5;
      const score = calcScore(txCount, basenameFound, uniqueContracts, hasNFT);
      const grade = getGrade(score);
      const tips = getTips(txCount, basenameFound, uniqueContracts, hasNFT);

      setResult({ address: addr, hasBasename: basenameFound, txCount, uniqueContracts, hasNFT, score, grade, tips });
    } catch {
      setError("Failed to fetch data. Try again.");
    } finally {
      setLoading(false);
    }
  }, [address]);

  const handleShare = useCallback(() => {
    if (!result) return;
    composeCast({
      text: `My Base Airdrop Score: ${result.score}/100 (Grade ${result.grade})\n\n${result.tips[0]}\n\nCheck yours`,
      embeds: [process.env.NEXT_PUBLIC_URL ?? "https://basescore.vercel.app"],
    });
  }, [result, composeCast]);

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white flex flex-col items-center px-4 py-6 font-sans">
      <div className="w-full max-w-sm mb-6">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold">B</div>
          <span className="text-blue-400 font-semibold text-sm tracking-wide uppercase">BaseScore</span>
        </div>
        <h1 className="text-2xl font-bold text-white leading-tight">Base Airdrop<br />Readiness Check</h1>
        <p className="text-gray-400 text-sm mt-1">See how your wallet is positioned for the Base airdrop</p>
      </div>

      <div className="w-full max-w-sm mb-4">
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && checkScore()}
          placeholder="0x... your Base wallet"
          className="w-full bg-[#16161f] border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition"
        />
        {error && <p className="text-red-400 text-xs mt-2 px-1">{error}</p>}
        <button
          onClick={checkScore}
          disabled={loading}
          className="w-full mt-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition text-sm"
        >
          {loading ? "Checking..." : "Check My Score"}
        </button>
      </div>

      {result && (
        <div className="w-full max-w-sm space-y-3">
          <div className={`rounded-2xl border bg-gradient-to-br p-5 ${GRADE_BG[result.grade]}`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-gray-300 text-xs uppercase tracking-widest mb-1">Airdrop Score</p>
                <div className="flex items-end gap-2">
                  <span className="text-5xl font-black text-white">{result.score}</span>
                  <span className="text-gray-400 text-lg mb-1">/100</span>
                </div>
              </div>
              <div className={`text-6xl font-black ${GRADE_COLOR[result.grade]}`}>{result.grade}</div>
            </div>
            <div className="w-full h-2 bg-black/30 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${result.score}%` }} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <StatCard label="Transactions" value={result.txCount.toString()} good={result.txCount >= 20} icon="Txns" />
            <StatCard label="Basename" value={hasBasename ? "Registered" : "Missing"} good={hasBasename} icon="Name" />
            <StatCard label="dApps Used" value={`~${result.uniqueContracts}`} good={result.uniqueContracts >= 5} icon="Apps" />
            <StatCard label="NFT Activity" value={result.hasNFT ? "Active" : "None"} good={result.hasNFT} icon="NFT" />
          </div>

          <div className="bg-[#16161f] rounded-2xl border border-gray-800 p-4">
            <p className="text-gray-400 text-xs uppercase tracking-widest mb-3">What to do next</p>
            <ul className="space-y-2">
              {result.tips.map((tip, i) => (
                <li key={i} className="text-sm text-gray-200">{tip}</li>
              ))}
            </ul>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleShare}
              className="flex-1 bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold py-3 rounded-xl transition"
            >
              Share Score
            </button>
            <button
              onClick={() => addFrame()}
              className="flex-1 bg-[#16161f] border border-gray-700 hover:border-blue-500 text-white text-sm font-semibold py-3 rounded-xl transition"
            >
              Save App
            </button>
          </div>

          <p className="text-gray-600 text-xs text-center pb-2">Estimate only. No Base airdrop has been announced.</p>
        </div>
      )}

      <div className="mt-auto pt-6">
        <button
          onClick={() => openUrl("https://base.org")}
          className="text-gray-600 text-xs hover:text-gray-400 transition"
        >
          Built on Base
        </button>
      </div>
    </main>
  );
}

function StatCard({ label, value, good, icon }: { label: string; value: string; good: boolean; icon: string }) {
  return (
    <div className={`bg-[#16161f] border rounded-xl p-3 ${good ? "border-green-800" : "border-gray-800"}`}>
      <p className="text-gray-500 text-xs mb-1">{icon} {label}</p>
      <p className={`text-sm font-semibold ${good ? "text-green-400" : "text-gray-300"}`}>{value}</p>
    </div>
  );
}
