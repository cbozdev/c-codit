"use client";

import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X } from "lucide-react";
import { useState } from "react";

export function WhatsAppButton() {
  const [dismissed, setDismissed] = useState(false);
  const [tooltipVisible, setTooltipVisible] = useState(true);

  const phone = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/[^0-9]/g, "") ?? "";
  const message = encodeURIComponent(
    process.env.NEXT_PUBLIC_WHATSAPP_MESSAGE ??
      "Hello! I'm interested in a product from RI Hair Collectables."
  );
  const href = `https://wa.me/${phone}?text=${message}`;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      <AnimatePresence>
        {tooltipVisible && !dismissed && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="relative bg-surface-elevated border border-border-default rounded-2xl px-4 py-3 shadow-elevation-3 max-w-[220px]"
          >
            <button
              onClick={() => setDismissed(true)}
              className="absolute -top-2 -right-2 w-5 h-5 bg-surface-tertiary border border-border-subtle rounded-full flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
              aria-label="Dismiss WhatsApp tooltip"
            >
              <X className="w-3 h-3" />
            </button>
            <p className="text-xs font-medium text-text-primary leading-snug">
              Need help choosing? Chat with us on WhatsApp 👋
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat with us on WhatsApp"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20, delay: 2 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setTooltipVisible(false)}
        className="w-14 h-14 bg-[#25D366] rounded-full flex items-center justify-center shadow-elevation-3 hover:shadow-elevation-4 transition-shadow"
      >
        <MessageCircle className="w-7 h-7 text-white fill-white" />
      </motion.a>
    </div>
  );
}
