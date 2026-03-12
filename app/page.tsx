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
  } catch { return 0; }
}

async function resolveBasename(address: string): Promise<string | null> {
  try {
    // Use Basenames subgraph API
    const res = await fetch("https://base.org/api/basenames", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: `{ domains(where: { resolvedAddress: "${address.toLowerCase()}" }) { name } }` }),
    });
    if (res.ok) {
      const data = await res.json();
      const names = data?.data?.domains;
      if (names && names.length > 0) return names[0].name;
    }
    // Fallback: Coinbase API
    const res2 = await fetch(`https://api.coinbase.com/v2/users/${address}/basenames`);
    if (res2.ok) {
      const data2 = await res2.json();
      return data2?.data?.[0]?.name || null;
    }
    return null;
  } catch { return null; }
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
  if (tips.length === 0) tips.push("You are well positioned! Keep transacting regularly");
  return tips.slice(0, 3);
}

const GRADE_COLORS: Record<string, { main: string; bg: string; border: string }> = {
  S: { main: "#fbbf24", bg: "rgba(251,191,36,0.08)", border: "rgba(251,191,36,0.3)" },
  A: { main: "#34d399", bg: "rgba(52,211,153,0.08)", border: "rgba(52,211,153,0.3)" },
  B: { main: "#60a5fa", bg: "rgba(96,165,250,0.08)", border: "rgba(96,165,250,0.3)" },
  C: { main: "#fb923c", bg: "rgba(251,146,60,0.08)", border: "rgba(251,146,60,0.3)" },
  D: { main: "#f87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.3)" },
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
      const [txCount, basename] = await Promise.all([getTxCount(addr), resolveBasename(addr)]);
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
      text: `My Base Airdrop Score: ${result.score}/100 (Grade ${result.grade})\n\n${result.tips[0]}\n\nCheck yours`,
      embeds: [process.env.NEXT_PUBLIC_URL ?? "https://basescore.vercel.app"],
    });
  }, [result, composeCast]);

  const gc = result ? GRADE_COLORS[result.grade] : null;

  return (
    <main style={{ minHeight: "100vh", background: "#08080f", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", padding: "24px 16px", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>

      {/* Header */}
      <div style={{ width: "100%", maxWidth: 380, marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #2563eb, #1d4ed8)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 18, boxShadow: "0 4px 12px rgba(37,99,235,0.4)" }}>B</div>
          <span style={{ color: "#60a5fa", fontWeight: 700, fontSize: 13, letterSpacing: "0.12em", textTransform: "uppercase" }}>BaseScore</span>
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 900, lineHeight: 1.2, margin: 0, letterSpacing: "-0.02em" }}>
          Base Airdrop<br />
          <span style={{ color: "#3b82f6" }}>Readiness Check</span>
        </h1>
        <p style={{ color: "#6b7280", fontSize: 14, marginTop: 8, marginBottom: 0 }}>See how your wallet is positioned for the Base airdrop</p>
      </div>

      {/* Input */}
      <div style={{ width: "100%", maxWidth: 380, marginBottom: 24 }}>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16 }}>👛</span>
          <input
            type="text"
            value={address}
            onChange={(e) => { setAddress(e.target.value); setError(""); }}
            onKeyDown={(e) => e.key === "Enter" && checkScore()}
            placeholder="0x... paste your Base wallet"
            style={{ width: "100%", background: "#12121e", border: "1px solid #1f2937", borderRadius: 16, padding: "14px 14px 14px 42px", fontSize: 14, color: "#fff", outline: "none", boxSizing: "border-box", transition: "border-color 0.2s" }}
            onFocus={e => e.target.style.borderColor = "#3b82f6"}
            onBlur={e => e.target.style.borderColor = "#1f2937"}
          />
        </div>
        {error && <p style={{ color: "#f87171", fontSize: 12, marginTop: 8, marginLeft: 4 }}>⚠️ {error}</p>}
        <button
          onClick={checkScore}
          disabled={loading}
          style={{ width: "100%", marginTop: 12, background: loading ? "#1e3a8a" : "linear-gradient(135deg, #2563eb, #1d4ed8)", border: "none", borderRadius: 16, padding: "16px", color: "#fff", fontWeight: 700, fontSize: 14, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1, boxShadow: "0 4px 16px rgba(37,99,235,0.35)", letterSpacing: "0.02em", transition: "opacity 0.2s" }}
        >
          {loading ? "⟳ Checking your wallet..." : "Check My Score →"}
        </button>
      </div>

      {/* Results */}
      {result && gc && (
        <div style={{ width: "100%", maxWidth: 380, display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Score Card */}
          <div style={{ background: gc.bg, border: `1px solid ${gc.border}`, borderRadius: 24, padding: 24, boxShadow: `0 8px 32px ${gc.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <p style={{ color: "#9ca3af", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 8px 0" }}>Airdrop Score</p>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
                  <span style={{ fontSize: 56, fontWeight: 900, lineHeight: 1, color: "#fff" }}>{result.score}</span>
                  <span style={{ color: "#6b7280", fontSize: 20, marginBottom: 6 }}>/100</span>
                </div>
                {result.basename && <p style={{ color: "#9ca3af", fontSize: 12, margin: "6px 0 0 0" }}>👤 {result.basename}</p>}
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 64, fontWeight: 900, lineHeight: 1, color: gc.main }}>{result.grade}</div>
              </div>
            </div>
            <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 8, height: 8, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${result.score}%`, background: `linear-gradient(90deg, #2563eb, ${gc.main})`, borderRadius: 8, transition: "width 1s ease" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 11, color: "#4b5563" }}>
              <span>0</span><span>50</span><span>100</span>
            </div>
          </div>

          {/* Stats Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              { icon: "⚡", label: "Transactions", value: result.txCount.toLocaleString(), sub: result.txCount >= 100 ? "Excellent" : result.txCount >= 20 ? "Good" : "Low activity", good: result.txCount >= 20 },
              { icon: "🏷️", label: "Basename", value: result.basename ?? "Not found", sub: result.hasBasename ? "Registered ✓" : "Missing", good: result.hasBasename },
              { icon: "🔗", label: "dApps Used", value: `~${result.uniqueContracts}`, sub: result.uniqueContracts >= 10 ? "Power user" : result.uniqueContracts >= 5 ? "Active" : "Low activity", good: result.uniqueContracts >= 5 },
              { icon: "🖼️", label: "NFT Activity", value: result.hasNFT ? "Active" : "None", sub: result.hasNFT ? "NFTs detected" : "No NFTs found", good: result.hasNFT },
            ].map((s, i) => (
              <div key={i} style={{ background: "#12121e", border: `1px solid ${s.good ? "rgba(52,211,153,0.25)" : "#1f2937"}`, borderRadius: 18, padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <span style={{ fontSize: 16 }}>{s.icon}</span>
                  <span style={{ color: "#6b7280", fontSize: 11 }}>{s.label}</span>
                </div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: s.good ? "#fff" : "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.value}</p>
                <p style={{ margin: "3px 0 0 0", fontSize: 11, color: s.good ? "#34d399" : "#4b5563" }}>{s.sub}</p>
              </div>
            ))}
          </div>

          {/* Tips */}
          <div style={{ background: "#12121e", border: "1px solid #1f2937", borderRadius: 20, padding: 18 }}>
            <p style={{ color: "#6b7280", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 14px 0" }}>💡 What to do next</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {result.tips.map((tip, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ color: "#3b82f6", fontWeight: 700, flexShrink: 0, marginTop: 1 }}>→</span>
                  <span style={{ color: "#d1d5db", fontSize: 13, lineHeight: 1.5 }}>{tip}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={handleShare} style={{ flex: 1, background: "linear-gradient(135deg, #7c3aed, #6d28d9)", border: "none", borderRadius: 16, padding: "14px", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", boxShadow: "0 4px 12px rgba(124,58,237,0.3)" }}>
              🔗 Share Score
            </button>
            <button onClick={() => addFrame()} style={{ flex: 1, background: "#12121e", border: "1px solid #1f2937", borderRadius: 16, padding: "14px", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              📌 Save App
            </button>
          </div>

          <p style={{ color: "#374151", fontSize: 11, textAlign: "center", paddingBottom: 8 }}>Estimate only. No Base airdrop has been announced.</p>
        </div>
      )}

      <div style={{ marginTop: "auto", paddingTop: 24 }}>
        <button onClick={() => openUrl("https://base.org")} style={{ background: "none", border: "none", color: "#374151", fontSize: 12, cursor: "pointer" }}>
          ⬡ Built on Base
        </button>
      </div>
    </main>
  );
}


