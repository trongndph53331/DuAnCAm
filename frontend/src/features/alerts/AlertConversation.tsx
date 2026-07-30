import { useEffect, useState } from "react";
import type { AlertEvent, ChatMessage, MessageContentType, QuickAction } from "./alert.types";
import { createInitialMessages } from "./alertMockData";
import { actionContentType, detectIntent, newMessage, responseFor, waitForAssistant } from "./assistantMockEngine";
import { AlertConversationHeader } from "./AlertConversationHeader";
import { AlertSummaryBanner } from "./AlertSummaryBanner";
import { ChatInput } from "./ChatInput";
import { ChatMessageList } from "./ChatMessageList";
import { ConfirmSafeModal } from "./ConfirmSafeModal";
import { FalseAlarmForm } from "./FalseAlarmForm";
import { QuickActionList } from "./QuickActionList";
import { SnapshotModal } from "./SnapshotModal";

export function AlertConversation({ alert, onBack, onStatus }: { alert: AlertEvent; onBack: () => void; onStatus: (status: AlertEvent["status"]) => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => createInitialMessages(alert)); const [typing, setTyping] = useState(false); const [safeModal, setSafeModal] = useState(false); const [falseModal, setFalseModal] = useState(false); const [snapshotModal, setSnapshotModal] = useState(false);
  useEffect(() => { setMessages(createInitialMessages(alert)); setTyping(false); }, [alert.id]);
  const respond = async (userText: string, contentType: MessageContentType) => { setMessages((items) => [...items, newMessage("user", userText, "text")]); if (contentType === "success") { setSafeModal(true); return; } if (contentType === "false_alarm") { setFalseModal(true); return; } setTyping(true); await waitForAssistant(); setTyping(false); setMessages((items) => [...items, newMessage("assistant", responseFor(contentType, alert.subject, alert.location), contentType)]); if (contentType === "help") onStatus("need_help"); };
  const handleAction = (action: QuickAction) => {
    if (action.id === "camera") {
      window.history.pushState({}, "", "/camera");
      window.dispatchEvent(new PopStateEvent("popstate"));
      return;
    }
    void respond(action.label, actionContentType(action.id));
  };
  const confirmSafe = () => { setSafeModal(false); onStatus("safe"); setMessages((items) => [...items, newMessage("assistant", "Cảm ơn bạn đã kiểm tra. Tôi đã đánh dấu sự kiện này là an toàn.", "success")]); };
  const falseAlarm = (_reason: string, _note: string) => { setFalseModal(false); onStatus("false_alarm"); setMessages((items) => [...items, newMessage("assistant", "Đã ghi nhận phản hồi của bạn. Sự kiện được đánh dấu là cảnh báo sai.", "text")]); };
  const helpAction = (label: string) => { if (label === "Mở camera") void respond(label, "camera"); else window.alert(`${label}: Đây là thao tác mô phỏng, không thực hiện liên hệ thật.`); };
  return <section className="alert-conversation"><AlertConversationHeader onBack={onBack} /><AlertSummaryBanner alert={alert} /><ChatMessageList messages={messages} alert={alert} typing={typing} onExpand={() => setSnapshotModal(true)} onCloseCamera={() => setMessages((items) => items.filter((message) => message.contentType !== "camera"))} onHelpAction={helpAction} contextualActions={<div className="mobile-context-actions"><p>Chọn hành động phù hợp</p><QuickActionList disabled={typing} status={alert.status} onAction={handleAction} /></div>} /><div className="desktop-quick-actions"><QuickActionList disabled={typing} status={alert.status} onAction={handleAction} /></div><ChatInput disabled={typing} onSend={(text) => void respond(text, detectIntent(text))} />{safeModal && <ConfirmSafeModal subject={alert.subject} onCancel={() => setSafeModal(false)} onConfirm={confirmSafe} />}{falseModal && <FalseAlarmForm onCancel={() => setFalseModal(false)} onSubmit={falseAlarm} />}{snapshotModal && <SnapshotModal alert={alert} onClose={() => setSnapshotModal(false)} />}</section>;
}
