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
  if (streamReady && streamUrl) {
    const resolvedStreamUrl=resolveBackendUrl(streamUrl);
    const separator=resolvedStreamUrl.includes("?")?"&":"?";
    const revision=streamRevision ? `&revision=${streamRevision}` : "";
    const configured=`${resolvedStreamUrl}${separator}boxes=${showBoxes}&identity=${showIdentity}${revision}`;
    const streamClassName=["camera-stream-image",className].filter(Boolean).join(" ");
    return <img className={streamClassName} src={configured} alt={`Luồng trực tiếp ${cameraId}`} onError={onError} />;
  }
  return null;
}
