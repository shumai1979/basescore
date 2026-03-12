"use client";

import { useEffect, useState, useCallback } from "react";
import { useMiniKit, useAddFrame, useOpenUrl } from "@coinbase/onchainkit/minikit";
import { useComposeCast } from "@coinbase/onchainkit/minikit";

interface ScoreResult {
  address: string;
  basename: string | null;
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

async function resolveBasename(address: string): Promise<string | null> {
  try {
    // L2 Reverse Registrar on Base mainnet
    const reverseNode = address.toLowerCase().replace("0x", "") + ".addr.reverse";
    const nameHash = await computeNamehash(reverseNode);
    
    // Base L2 Resolver
    const resolverAddress = "0xC6d566A56A1aFf6508b41f6c90ff131615583BCD";
    const data = "0x691f3431" + nameHash.slice(2); // name(bytes32)
    
    const result = await rpc("eth_call", [{ to: resolverAddress, data }, "latest"]);
    if (!result || result === "0x") return null;
    
    // Decode ABI string
    const hex = result.slice(2);
    const offset = parseInt(hex.slice(0, 64), 16) * 2;
    const length = parseInt(hex.slice(offset, offset + 64), 16) * 2;
    const nameHex = hex.slice(offset + 64, offset + 64 + length);
    const name = Buffer.from(nameHex, "hex").toString("utf8").replace(/\0/g, "");
    return name && name.length > 0 ? name : null;
  } catch {
    return null;
  }
}

async function computeNamehash(name: string): Promise<string> {
  let node = new Uint8Array(32).fill(0);
  if (name === "") return "0x" + Buffer.from(node).toString("hex");
  const labels = name.split(".").reverse();
  for (const label of labels) {
    const labelHash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(label));
    const combined = new Uint8Array(64);
    combined.set(node, 0);
    combined.set(new Uint8Array(labelHash), 32);
    node = new Uint8Array(await crypto.subtle.digest("SHA-256", combined));
  }
  return "0x" + Buffer.from(node).toString("hex");
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
  if (txCount < 20) tips.push("Make more transactions on Base — aim for 20+");
  if (uniqueContracts < 5) tips.push("Interact with more dApps (Aerodrome, Aave, Uniswap)");
  if (!hasNFT) tips.push("Mint an NFT on Base via Zora or Mint.fun");
  if (txCount < 5) tips.push("Bridge ETH to Base and start transacting");
  if (tips.length === 0) tips.push("You are well positioned! Keep transacting regularly");
  return tips.slice(0, 3);
}

const GRADE_CONFIG: Record<string, { color: string; bg: string; border: string; glow: string; emoji: string }> = {
  S: { color: "text-yellow-300", bg: "from-yellow-900/50 to-yellow-800/20", border: "border-yellow-500/50", glow: "shadow-yellow-500/20", emoji: "🏆" },
  A: { color: "text-green-300", bg: "from-green-900/50 to-green-800/20", border: "border-green-500/50", glow: "shadow-green-500/20", emoji: "⭐" },
  B: { color: "text-blue-300", bg: "from-blue-900/50 to-blue-800/20", border: "border-blue-500/50", glow: "shadow-blue-500/20", emoji: "✨" },
  C: { color: "text-orange-300", bg: "from-orange-900/50 to-orange-800/20", border: "border-orange-500/50", glow: "shadow-orange-500/20", emoji: "📈" },
  D: { color: "text-red-300", bg: "from-red-900/50 to-red-800/20", border: "border-red-500/50", glow: "shadow-red-500/20", emoji: "🔥" },
};

export default function Page() {
  const { setFrameReady, isFrameReady } = useMiniKit();
  const addFrame = useAddFrame();
  const openUrl = useOpenUrl();
  const { composeCast } = useComposeCast();

  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isFrameReady) setFrameReady();
  }, [isFrameReady, setFrameReady]);

  const checkScore = useCallback(async () => {
    const addr = address.trim();
    if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) {
      setError("Please enter a valid Ethereum address (0x...)");
      return;
    }
    setError("");
    setLoading(true);
    setResult(null);

    try {
      const [txCount, basename] = await Promise.all([
        getTxCount(addr),
        resolveBasename(addr),
      ]);

      const hasBasename = !!basename;
      const uniqueContracts = Math.min(Math.floor(txCount / 3), 15);
      const hasNFT = txCount > 5;
      const score = calcScore(txCount, hasBasename, uniqueContracts, hasNFT);
      const grade = getGrade(score);
      const tips = getTips(txCount, hasBasename, uniqueContracts, hasNFT);

      setResult({ address: addr, basename, hasBasename, txCount, uniqueContracts, hasNFT, score, grade, tips });
    } catch {
      setError("Failed to fetch data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [address]);

  const handleShare = useCallback(() => {
    if (!result) return;
    composeCast({
      text: `🏆 My Base Airdrop Score: ${result.score}/100 (Grade ${result.grade})\n\n${result.tips[0]}\n\nCheck yours 👇`,
      embeds: [process.env.NEXT_PUBLIC_URL ?? "https://basescore.vercel.app"],
    });
  }, [result, composeCast]);

  const cfg = result ? GRADE_CONFIG[result.grade] : null;

  return (
    <main className="min-h-screen bg-[#080810] text-white flex flex-col items-center px-4 py-6 font-sans">
      
      {/* Header */}
      <div className="w-full max-w-sm mb-8">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center font-black text-lg shadow-lg shadow-blue-500/30">B</div>
          <span className="text-blue-400 font-bold text-sm tracking-widest uppercase">BaseScore</span>
        </div>
        <h1 className="text-3xl font-black text-white leading-tight tracking-tight">
          Base Airdrop<br />
          <span className="text-blue-400">Readiness Check</span>
        </h1>
        <p className="text-gray-500 text-sm mt-2">See how your wallet is positioned for the Base airdrop</p>
      </div>

      {/* Input */}
      <div className="w-full max-w-sm mb-6">
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm">👛</div>
          <input
            type="text"
            value={address}
            onChange={(e) => { setAddress(e.target.value); setError(""); }}
            onKeyDown={(e) => e.key === "Enter" && checkScore()}
            placeholder="0x... paste your Base wallet"
            className="w-full bg-[#12121e] border border-gray-700/60 rounded-2xl pl-10 pr-4 py-4 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/70 focus:bg-[#14142a] transition-all"
          />
        </div>
        {error && (
          <p className="text-red-400 text-xs mt-2 px-1 flex items-center gap-1">
            <span>⚠️</span> {error}
          </p>
        )}
        <button
          onClick={checkScore}
          disabled={loading}
          className="w-full mt-3 bg-blue-600 hover:bg-blue-500 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-blue-600/30 text-sm tracking-wide"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin">⟳</span> Checking your wallet...
            </span>
          ) : "Check My Score →"}
        </button>
      </div>

      {/* Results */}
      {result && cfg && (
        <div className="w-full max-w-sm space-y-3 animate-fade-in">
          
          {/* Score Card */}
          <div className={`rounded-3xl border bg-gradient-to-br p-6 shadow-xl ${cfg.bg} ${cfg.border} ${cfg.glow}`}>
            <div className="flex items-start justify-between mb-5">
              <div>
                <p className="text-gray-400 text-xs uppercase tracking-widest mb-2">Airdrop Score</p>
                <div className="flex items-end gap-2">
                  <span className="text-6xl font-black text-white">{result.score}</span>
                  <span className="text-gray-500 text-xl mb-2">/100</span>
                </div>
                {result.basename && (
                  <p className="text-gray-400 text-xs mt-1">👤 {result.basename}</p>
                )}
              </div>
              <div className="text-right">
                <div className={`text-7xl font-black ${cfg.color} leading-none`}>{result.grade}</div>
                <div className="text-2xl mt-1">{cfg.emoji}</div>
              </div>
            </div>
            
            {/* Progress bar */}
            <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all duration-1000"
                style={{ width: `${result.score}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-600 mt-1">
              <span>0</span>
              <span>50</span>
              <span>100</span>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-2">
            <StatCard
              icon="⚡"
              label="Transactions"
              value={result.txCount.toLocaleString()}
              sub={result.txCount >= 100 ? "Excellent" : result.txCount >= 20 ? "Good" : "Low"}
              good={result.txCount >= 20}
            />
            <StatCard
              icon="🏷️"
              label="Basename"
              value={result.basename ?? "Not found"}
              sub={result.hasBasename ? "Registered ✓" : "Missing"}
              good={result.hasBasename}
            />
            <StatCard
              icon="🔗"
              label="dApps Used"
              value={`~${result.uniqueContracts}`}
              sub={result.uniqueContracts >= 10 ? "Power user" : result.uniqueContracts >= 5 ? "Active" : "Low activity"}
              good={result.uniqueContracts >= 5}
            />
            <StatCard
              icon="🖼️"
              label="NFT Activity"
              value={result.hasNFT ? "Active" : "None"}
              sub={result.hasNFT ? "NFTs detected" : "No NFTs found"}
              good={result.hasNFT}
            />
          </div>

          {/* Tips */}
          <div className="bg-[#12121e] rounded-2xl border border-gray-800/60 p-4">
            <p className="text-gray-400 text-xs uppercase tracking-widest mb-3 flex items-center gap-1">
              <span>💡</span> What to do next
            </p>
            <ul className="space-y-2">
              {result.tips.map((tip, i) => (
                <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                  <span className="text-blue-400 mt-0.5">→</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleShare}
              className="flex-1 bg-purple-600 hover:bg-purple-500 active:scale-95 text-white text-sm font-bold py-3.5 rounded-2xl transition-all shadow-lg shadow-purple-600/20 flex items-center justify-center gap-1"
            >
              🔗 Share Score
            </button>
            <button
              onClick={() => addFrame()}
              className="flex-1 bg-[#12121e] border border-gray-700/60 hover:border-blue-500/50 text-white text-sm font-bold py-3.5 rounded-2xl transition-all flex items-center justify-center gap-1"
            >
              📌 Save App
            </button>
          </div>

          <p className="text-gray-700 text-xs text-center pb-2">Estimate only. No Base airdrop has been announced.</p>
        </div>
      )}

      <div className="mt-auto pt-6">
        <button
          onClick={() => openUrl("https://base.org")}
          className="text-gray-700 text-xs hover:text-gray-500 transition flex items-center gap-1"
        >
          ⬡ Built on Base
        </button>
      </div>
    </main>
  );
}

function StatCard({ icon, label, value, sub, good }: { icon: string; label: string; value: string; sub: string; good: boolean }) {
  return (
    <div className={`bg-[#12121e] border rounded-2xl p-4 transition-all ${good ? "border-green-700/50" : "border-gray-800/60"}`}>
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-base">{icon}</span>
        <p className="text-gray-500 text-xs">{label}</p>
      </div>
      <p className={`text-base font-bold truncate ${good ? "text-white" : "text-gray-400"}`}>{value}</p>
      <p className={`text-xs mt-0.5 ${good ? "text-green-400" : "text-gray-600"}`}>{sub}</p>
    </div>
  );
}
