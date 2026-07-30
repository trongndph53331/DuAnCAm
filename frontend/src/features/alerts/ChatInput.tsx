import { Send } from "lucide-react";
import { useState } from "react";
export function ChatInput({ disabled, onSend }: { disabled: boolean; onSend: (text: string) => void }) {
  const [value, setValue] = useState("");
  const submit = () => { const text = value.trim(); if (!text || disabled) return; onSend(text); setValue(""); };
  return <div className="chat-input-wrap"><textarea rows={1} value={value} disabled={disabled} placeholder="Hỏi An Tâm về cảnh báo này..." onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submit(); } }} /><button disabled={disabled || !value.trim()} onClick={submit} aria-label="Gửi"><Send /></button></div>;
}

