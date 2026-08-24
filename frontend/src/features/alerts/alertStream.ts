import { API_BASE_URL, getAuthToken } from "../../api/client";

type AlertStreamHandlers = {
  onReady: () => void;
  onAlert: (data: string) => void;
};

export function subscribeToAlertStream(handlers: AlertStreamHandlers): () => void {
  const controller = new AbortController();
  let stopped = false;
  let reconnectTimer: number | undefined;

  const connect = async () => {
    const token = getAuthToken();
    if (!token || stopped) return;
    try {
      const response = await fetch(`${API_BASE_URL}/alerts/stream`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      if (!response.ok || !response.body) throw new Error(`SSE ${response.status}`);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (!stopped) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
        let boundary = buffer.indexOf("\n\n");
        while (boundary >= 0) {
          const block = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const lines = block.split("\n");
          const event = lines.find((line) => line.startsWith("event:"))?.slice(6).trim();
          const data = lines
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trimStart())
            .join("\n");
          if (event === "ready") handlers.onReady();
          if (event === "alert") handlers.onAlert(data);
          boundary = buffer.indexOf("\n\n");
        }
      }
    } catch {
      // Reconnect below unless logout/unmount aborted the stream.
    }
    if (!stopped) reconnectTimer = window.setTimeout(connect, 2000);
  };

  void connect();
  return () => {
    stopped = true;
    controller.abort();
    if (reconnectTimer) window.clearTimeout(reconnectTimer);
  };
}
