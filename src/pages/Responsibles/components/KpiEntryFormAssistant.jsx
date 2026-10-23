import { useEffect, useRef, useState } from "react";
import apiClient from "../../../api/client";

// Per-KPI AI assistant, opened from a card's "AI Support" button.
//
// Simplifications vs. the original assistant panel:
//  - non-streaming. The original sent {stream:true} and parsed an SSE stream
//    (event: delta / done / error) plus a typewriter animation; the same
//    endpoint returns {answer, conversation} as plain JSON when stream is
//    false, which is what this uses.
//  - no #assistantLauncher / "All KPIs on this form" mode: that button never
//    existed in the rendered page, so its listener never bound and the mode
//    was unreachable.
// Note on the two ids: GET /kpi-ai-assistant/conversation takes its `kpi_id`
// as an ALLOCATION id and resolves it through kpi_target_allocation, while
// POST /api/kpis/:id/ai-support takes the real kpi_id. Both are passed as the
// backend expects them, same as the original page did.
export default function KpiEntryFormAssistant({ kpi, responsibleId, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setStatus("Loading conversation...");
    apiClient
      .get("/kpi-ai-assistant/conversation", {
        params: { responsible_id: responsibleId, kpi_id: kpi.allocation_id },
      })
      .then((res) => {
        if (cancelled) return;
        const conversation = Array.isArray(res.data?.conversation) ? res.data.conversation : [];
        setMessages(
          conversation
            .map((entry) => ({
              role: entry?.role === "assistant" ? "assistant" : "user",
              text: entry?.content || entry?.text || "",
            }))
            .filter((entry) => entry.text)
        );
        setStatus("");
      })
      .catch(() => {
        if (!cancelled) setStatus("");
      });
    return () => {
      cancelled = true;
    };
  }, [kpi.allocation_id, responsibleId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, sending]);

  const send = async (event) => {
    event.preventDefault();
    const message = input.trim();
    if (!message || sending) return;

    setMessages((current) => [...current, { role: "user", text: message }]);
    setInput("");
    setSending(true);
    setStatus("Thinking...");
    try {
      const res = await apiClient.post(`/api/kpis/${kpi.kpi_id}/ai-support`, {
        message,
        responsible_id: responsibleId,
        stream: false,
      });
      setMessages((current) => [
        ...current,
        { role: "assistant", text: res.data?.answer || "No answer returned." },
      ]);
      setStatus("");
    } catch (err) {
      setStatus(err.response?.data?.error || "The assistant could not answer.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div>
          <div className="text-sm font-bold text-slate-800">AI Support</div>
          <div className="text-xs text-slate-400">{kpi.title}</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-500"
        >
          Close
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
        {messages.length === 0 && !status && (
          <div className="text-xs text-slate-400">
            Ask anything about this KPI — its definition, how to reach the target, or what to write
            as a root cause.
          </div>
        )}
        <div className="flex flex-col gap-3">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`max-w-[90%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm ${
                message.role === "assistant"
                  ? "bg-slate-100 text-slate-700"
                  : "self-end bg-blue-600 text-white"
              }`}
            >
              {message.text}
            </div>
          ))}
        </div>
      </div>

      {status && <div className="px-4 pb-2 text-xs text-slate-400">{status}</div>}

      <form onSubmit={send} className="border-t border-slate-100 p-3">
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask about this KPI..."
          className="min-h-[70px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
        />
        <button
          type="submit"
          disabled={sending}
          className="mt-2 w-full rounded-xl btn-brand px-4 py-2.5 text-sm font-bold"
        >
          {sending ? "Sending..." : "Send"}
        </button>
      </form>
    </div>
  );
}
