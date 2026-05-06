"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Star, Copy, Check, Gift, TrendingUp } from "lucide-react";
import toast from "react-hot-toast";
import type { Prisma } from "@prisma/client";

type LoyaltyWithTransactions = Prisma.LoyaltyAccountGetPayload<{
  include: { transactions: true };
}> | null;

const TIERS = [
  { name: "Bronze", min: 0, max: 499, color: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200" },
  { name: "Silver", min: 500, max: 1499, color: "text-neutral-600", bg: "bg-neutral-50", border: "border-neutral-200" },
  { name: "Gold", min: 1500, max: 4999, color: "text-[#C9A84C]", bg: "bg-[#C9A84C]/10", border: "border-[#C9A84C]/30" },
  { name: "Platinum", min: 5000, max: Infinity, color: "text-purple-700", bg: "bg-purple-50", border: "border-purple-200" },
];

export function LoyaltyView({
  loyalty,
  referralCode,
}: {
  loyalty: LoyaltyWithTransactions;
  referralCode: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const points = loyalty?.points ?? 0;

  const currentTier = TIERS.find((t) => points >= t.min && points <= t.max) ?? TIERS[0]!;
  const nextTier = TIERS[TIERS.indexOf(currentTier) + 1];
  const progress = nextTier
    ? ((points - currentTier.min) / (nextTier.min - currentTier.min)) * 100
    : 100;

  const copyReferral = () => {
    if (!referralCode) return;
    navigator.clipboard.writeText(referralCode);
    setCopied(true);
    toast.success("Referral code copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Points card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-elevated p-8 bg-gradient-to-br from-[#0A0A0A] to-neutral-900 text-white"
      >
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-neutral-400 text-sm mb-1">Available Points</p>
            <p className="font-cormorant text-5xl font-semibold">{points.toLocaleString()}</p>
          </div>
          <span
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${currentTier.bg} ${currentTier.color} ${currentTier.border}`}
          >
            {currentTier.name}
          </span>
        </div>

        {nextTier && (
          <div>
            <div className="flex justify-between text-xs text-neutral-400 mb-2">
              <span>{points} pts</span>
              <span>{nextTier.min} pts for {nextTier.name}</span>
            </div>
            <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(progress, 100)}%` }}
                transition={{ delay: 0.4, duration: 0.8, ease: "easeOut" }}
                className="h-full bg-gradient-to-r from-[#C9A84C] to-[#F0C040] rounded-full"
              />
            </div>
            <p className="text-xs text-neutral-400 mt-2">
              {nextTier.min - points} more points to reach{" "}
              <span className={currentTier.color}>{nextTier.name}</span>
            </p>
          </div>
        )}
      </motion.div>

      {/* How to earn */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card-elevated p-6"
      >
        <h2 className="font-cormorant text-xl font-semibold text-[#0A0A0A] mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-[#C9A84C]" />
          How to earn points
        </h2>
        <ul className="space-y-3 text-sm">
          {[
            { action: "Every $1 spent", pts: "+1 pt" },
            { action: "Refer a friend", pts: "+100 pts" },
            { action: "Write a review", pts: "+25 pts" },
            { action: "Complete profile", pts: "+50 pts" },
          ].map((item) => (
            <li key={item.action} className="flex items-center justify-between">
              <span className="text-neutral-600">{item.action}</span>
              <span className="font-semibold text-[#C9A84C]">{item.pts}</span>
            </li>
          ))}
        </ul>
      </motion.div>

      {/* Referral */}
      {referralCode && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card-elevated p-6"
        >
          <h2 className="font-cormorant text-xl font-semibold text-[#0A0A0A] mb-2 flex items-center gap-2">
            <Gift className="w-5 h-5 text-[#C9A84C]" />
            Refer a friend
          </h2>
          <p className="text-sm text-neutral-500 mb-4">
            Share your code. When a friend signs up and makes their first purchase, you both earn
            100 bonus points.
          </p>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-neutral-50 border border-neutral-200 rounded-lg px-4 py-3 font-mono font-semibold text-[#0A0A0A] tracking-wider text-center">
              {referralCode}
            </div>
            <button
              onClick={copyReferral}
              className="btn-primary px-4 py-3 flex-shrink-0"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </motion.div>
      )}

      {/* Transaction history */}
      {loyalty && loyalty.transactions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card-elevated p-6"
        >
          <h2 className="font-cormorant text-xl font-semibold text-[#0A0A0A] mb-4 flex items-center gap-2">
            <Star className="w-5 h-5 text-[#C9A84C]" />
            Points History
          </h2>
          <ul className="divide-y divide-neutral-100">
            {loyalty.transactions.map((tx) => (
              <li key={tx.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <p className="font-medium text-[#0A0A0A]">{tx.description}</p>
                  <p className="text-xs text-neutral-400">
                    {new Date(tx.createdAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <span
                  className={`font-semibold ${tx.points >= 0 ? "text-green-600" : "text-red-500"}`}
                >
                  {tx.points >= 0 ? "+" : ""}
                  {tx.points} pts
                </span>
              </li>
            ))}
          </ul>
        </motion.div>
      )}
    </div>
  );
}
