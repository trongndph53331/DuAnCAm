import { describe, expect, it, vi } from "vitest";
import { AlertSpeechController, buildAlertSpeechMessage, findVietnameseVoice, type AlertSpeechPreferences } from "./alertSpeech";

const enabled: AlertSpeechPreferences = { enabled: true, activated: true, volume: 0.8, speed: "normal" };
function harness(preferences = enabled) {
  const spoken: Array<{ text: string; utterance: SpeechSynthesisUtterance }> = [];
  const fallbackVoice = { lang: "en-US", name: "Default" } as SpeechSynthesisVoice;
  const synthesis = { speak: vi.fn((utterance: SpeechSynthesisUtterance) => spoken.push({ text: utterance.text, utterance })), cancel: vi.fn(), getVoices: vi.fn(() => [fallbackVoice]), addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as SpeechSynthesis;
  const factory = (text: string) => ({ text, onend: null, onerror: null } as unknown as SpeechSynthesisUtterance);
  return { spoken, synthesis, controller: new AlertSpeechController(preferences, synthesis, factory) };
}
const alert = (id: string, event_type: string, camera_id = id) => ({ type: "alert_created", alert: { id, event_type, camera_id, camera_location: "Phòng khách" } });

describe("Vietnamese alert speech", () => {
  it("ưu tiên chính xác giọng vi-VN", () => { const vi={lang:"vi-VN",name:"Vietnamese"} as SpeechSynthesisVoice; const other={lang:"en-US",name:"English"} as SpeechSynthesisVoice; expect(findVietnameseVoice([other,vi])).toBe(vi); });
  it("tạo đúng câu người lạ", () => expect(buildAlertSpeechMessage(alert("1", "UNKNOWN_PERSON").alert)).toBe("Cảnh báo, phát hiện người lạ tại Phòng khách."));
  it("tạo đúng câu té ngã", () => expect(buildAlertSpeechMessage(alert("1", "FALL_CONFIRMED").alert)).toBe("Cảnh báo khẩn cấp, phát hiện có người có khả năng té ngã tại Phòng khách. Vui lòng kiểm tra ngay."));
  it("không đọc event cũ, cập nhật hoặc ID trùng", () => { const h=harness(); h.controller.handle({type:"ready"}); h.controller.handle({...alert("a","UNKNOWN_PERSON"),type:"alert_updated"}); h.controller.handle(alert("a","UNKNOWN_PERSON")); h.controller.handle(alert("a","UNKNOWN_PERSON")); expect(h.spoken).toHaveLength(1); });
  it("không đọc khi tắt", () => { const h=harness({...enabled,enabled:false}); expect(h.controller.handle(alert("a","UNKNOWN_PERSON"))).toBe("muted"); expect(h.spoken).toHaveLength(0); });
  it("xếp hàng và ưu tiên té ngã", () => { const h=harness(); h.controller.handle(alert("a","UNKNOWN_PERSON")); h.controller.handle(alert("b","UNKNOWN_PERSON")); h.controller.handle(alert("c","FALL_CONFIRMED")); expect(h.controller.pendingCount).toBe(2); h.spoken[0].utterance.onend?.({} as SpeechSynthesisEvent); expect(h.spoken[1].text).toContain("khẩn cấp"); });
  it("đăng xuất dừng đọc và xóa hàng đợi", () => { const h=harness(); h.controller.handle(alert("a","UNKNOWN_PERSON")); h.controller.handle(alert("b","UNKNOWN_PERSON")); h.controller.stop(); expect(h.controller.pendingCount).toBe(0); expect(h.synthesis.cancel).toHaveBeenCalledOnce(); });
  it("không hỗ trợ Speech API thì xử lý an toàn", () => { const controller=new AlertSpeechController(enabled,null); expect(controller.supported).toBe(false); expect(controller.handle(alert("a","UNKNOWN_PERSON"))).toBe("unsupported"); });
});
