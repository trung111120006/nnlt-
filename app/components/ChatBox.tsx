"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send } from "lucide-react";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

export function ChatBox() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [isOpen, messages]);

  async function sendMessage(e?: React.FormEvent) {
    e?.preventDefault();
    if (isLoading) return;
    const text = input.trim();
    if (!text) return;
    // Extract a lightweight text snapshot of the current page as context
    const extractPageText = (limit = 6000) => {
      try {
        const clone = document.body.cloneNode(true) as HTMLElement;
        const remove = (sel: string) => clone.querySelectorAll(sel).forEach((el) => el.remove());
        remove('script, style, noscript');
        // Optionally strip common layout chrome
        remove('header, footer, nav');
        const txt = (clone as HTMLElement).innerText.replace(/\s+/g, ' ').trim();
        return txt.slice(0, limit);
      } catch {
        return '';
      }
    };
    const context = {
      url: typeof window !== 'undefined' ? window.location.href : '',
      pageText: extractPageText(),
    };
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text, context }),
      });
      const data = await res.json();
      if (!res.ok) {
        const message = data?.error || "Chat request failed";
        throw new Error(message);
      }
      const replyText =
        data.reply ??
        data.text ??
        data.candidates?.[0]?.content?.parts?.[0]?.text ??
        "(No response)";
      const botMsg: ChatMessage = { id: crypto.randomUUID(), role: "assistant", text: replyText };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      const botMsg: ChatMessage = { id: crypto.randomUUID(), role: "assistant", text: err instanceof Error ? err.message : "Sorry, something went wrong." };
      setMessages((prev) => [...prev, botMsg]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-green-500 text-white flex items-center justify-center shadow-lg hover:shadow-xl transition-all hover:scale-110 focus:outline-none"
          aria-label="Open Chatbot"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      ) : (
        <div className="w-80 sm:w-96 h-96 bg-white rounded-xl border shadow-xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-blue-500 to-green-500 text-white">
            <div className="font-semibold flex items-center gap-2">
              <MessageCircle className="w-4 h-4" />
              AI Assistant
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded hover:bg-white/20 transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50">
            {messages.length === 0 ? (
              <div className="text-sm text-gray-800 font-medium text-center mt-10">Ask me anything about the app.</div>
            ) : null}
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                    m.role === "user" 
                      ? "bg-gradient-to-r from-blue-500 to-green-500 text-white shadow-sm" 
                      : "bg-white border-2 border-gray-200 text-gray-800 shadow-sm"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {isLoading ? (
              <div className="text-sm text-blue-600 font-medium">AI is typing…</div>
            ) : null}
          </div>
          <form onSubmit={sendMessage} className="p-3 border-t bg-white flex items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 h-9 px-3 rounded-md border border-gray-300 text-gray-800 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-200"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="h-9 px-3 rounded-md bg-gradient-to-r from-blue-500 to-green-500 text-white hover:from-blue-600 hover:to-green-600 disabled:opacity-50 flex items-center gap-1 transition-all shadow-sm"
            >
              <Send className="w-4 h-4" />
              Send
            </button>
          </form>
        </div>
      )}
    </div>
  );
}


