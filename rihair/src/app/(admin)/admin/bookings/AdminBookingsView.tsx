"use client";

import { motion } from "framer-motion";
import { Calendar } from "lucide-react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import type { Prisma } from "@prisma/client";

type BookingRow = Prisma.BookingGetPayload<{
  include: {
    slot: true;
    user: { select: { name: true; email: true } };
  };
}>;

const SERVICE_LABELS: Record<string, string> = {
  WIG_INSTALLATION: "Wig Installation",
  HAIR_CONSULTATION: "Hair Consultation",
  CUSTOM_WIG_CREATION: "Custom Wig Creation",
};

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-yellow-50 text-yellow-700",
  CONFIRMED: "bg-green-50 text-green-700",
  COMPLETED: "bg-blue-50 text-blue-700",
  CANCELLED: "bg-red-50 text-red-600",
  NO_SHOW: "bg-neutral-50 text-neutral-600",
};

export function AdminBookingsView({ bookings }: { bookings: BookingRow[] }) {
  const router = useRouter();

  const updateStatus = async (id: string, status: string) => {
    const res = await fetch(`/api/admin/bookings/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) { toast.error("Update failed."); return; }
    toast.success("Booking updated.");
    router.refresh();
  };

  return (
    <div>
      <h1 className="font-cormorant text-2xl font-semibold text-[#0A0A0A] mb-6">Bookings</h1>

      {bookings.length === 0 ? (
        <div className="text-center py-20">
          <Calendar className="w-12 h-12 text-neutral-200 mx-auto mb-4" />
          <p className="text-neutral-500">No bookings yet.</p>
        </div>
      ) : (
        <div className="card-elevated overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100">
                {["Customer", "Service", "Date", "Time", "Status", "Paid", "Actions"].map((h) => (
                  <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bookings.map((b, i) => (
                <motion.tr
                  key={b.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="border-b border-neutral-50 hover:bg-neutral-50"
                >
                  <td className="py-3 px-4">
                    <p className="font-medium text-[#0A0A0A]">{b.guestName ?? b.user?.name ?? "—"}</p>
                    <p className="text-xs text-neutral-400">{b.guestEmail ?? b.user?.email}</p>
                  </td>
                  <td className="py-3 px-4 text-neutral-600">
                    {SERVICE_LABELS[b.slot.service] ?? b.slot.service}
                  </td>
                  <td className="py-3 px-4 text-neutral-600 text-xs">
                    {new Date(b.slot.date).toLocaleDateString("en-GB", {
                      weekday: "short", day: "numeric", month: "short",
                    })}
                  </td>
                  <td className="py-3 px-4 text-neutral-600">
                    {b.slot.startTime} – {b.slot.endTime}
                  </td>
                  <td className="py-3 px-4">
                    <select
                      defaultValue={b.status}
                      onChange={(e) => updateStatus(b.id, e.target.value)}
                      className={`text-xs px-2 py-1 rounded-full font-medium border-0 outline-none cursor-pointer ${STATUS_STYLES[b.status] ?? ""}`}
                    >
                      {["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"].map((s) => (
                        <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`text-xs font-medium ${b.isPaid ? "text-green-600" : "text-neutral-400"}`}>
                      {b.isPaid ? "Paid" : "Unpaid"}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    {b.notes && (
                      <span className="text-xs text-neutral-400 italic line-clamp-1 max-w-[120px]">
                        {b.notes}
                      </span>
                    )}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
