import { useEffect, useRef, useState } from "react";
import { resolveBackendUrl } from "../api/client";

interface CameraStreamProps {
  cameraId: string;
  streamReady?: boolean;
  streamUrl?: string | null;
  playbackUrl?: string | null; // Compatibility only; production viewing uses MJPEG.
  className?: string;
  onError?: () => void;
  showBoxes?: boolean;
  showIdentity?: boolean;
  streamRevision?: number;
}

export function CameraStream({ cameraId, streamReady, streamUrl, className, onError, showBoxes=true, showIdentity=true, streamRevision }: CameraStreamProps) {
  const [retryNonce, setRetryNonce] = useState(0);
  const retryTimer = useRef<number | null>(null);
  useEffect(() => {
    setRetryNonce(0);
    return () => {
      if (retryTimer.current !== null) window.clearTimeout(retryTimer.current);
    };
  }, [streamUrl, streamRevision]);
  useEffect(() => {
    const reconnect = () => {
      if (document.visibilityState === "visible") {
        setRetryNonce((value) => value + 1);
      }
    };
    const handleVisibility = () => reconnect();
    window.addEventListener("focus", reconnect);
    window.addEventListener("online", reconnect);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("focus", reconnect);
      window.removeEventListener("online", reconnect);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  if (streamReady && streamUrl) {
    const resolvedStreamUrl=resolveBackendUrl(streamUrl);
    const separator=resolvedStreamUrl.includes("?")?"&":"?";
    const revision=streamRevision ? `&revision=${streamRevision}` : "";
    const configured=`${resolvedStreamUrl}${separator}boxes=${showBoxes}&identity=${showIdentity}${revision}&retry=${retryNonce}`;
    const streamClassName=["camera-stream-image",className].filter(Boolean).join(" ");
    const retry = () => {
      onError?.();
      if (retryTimer.current !== null) return;
      retryTimer.current = window.setTimeout(() => {
        retryTimer.current = null;
        setRetryNonce((value) => value + 1);
      }, 1500);
    };
    return <img key={configured} className={streamClassName} src={configured} alt={`Luồng trực tiếp ${cameraId}`} onError={retry} />;
  }
  return null;
}
