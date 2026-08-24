import { apiClient, apiCommand } from "./client";

export interface CameraEventDto {
  id: string;
  event_id: string;
  event_type: string;
  title: string;
  description: string;
  occurred_at: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "open" | "acknowledged" | "resolved" | "dismissed";
  confidence?: number | null;
}

export interface CameraDto {
  id: string;
  name: string;
  location: string;
  status: "connecting" | "online" | "offline" | "ended" | "error";
  error?: string | null;
  last_seen_at?: string | null;
  active: boolean;
  vision_enabled: boolean;
  vision_status?: "disabled" | "waiting_for_source" | "running" | "error" | null;
  identity_enabled: boolean;
  source_kind: "video_file" | "webcam" | "rtsp";
  source: string;
  playback_url?: string | null;
  stream_url: string;
  stream_ready: boolean;
  preview_url?: string | null;
  preview_version?: number | null;
  events?: CameraEventDto[];
}

export async function getCameras(): Promise<CameraDto[]> {
  const response = await apiClient<{ items: CameraDto[]; total: number }>("/cameras");
  return response.items;
}

export interface DemoScenarioDto { id: string; name: string }

export async function getDemoScenarios(): Promise<DemoScenarioDto[]> {
  const response = await apiClient<{ items: DemoScenarioDto[] }>("/cameras/demo-scenarios");
  return response.items;
}

export function selectDemoScenario(scenarioId: string): Promise<CameraDto> {
  return apiClient("/cameras/demo-scenario", {
    method: "POST",
    body: JSON.stringify({ scenario_id: scenarioId }),
  });
}

export interface PendingDemoUploadDto { upload_id: string; filename: string }

export function uploadDemoVideo(video: File): Promise<PendingDemoUploadDto> {
  const data = new FormData();
  data.append("video", video);
  return apiClient("/cameras/demo-video", { method: "POST", body: data });
}

export function completeDemoVideo(uploadId: string, name: string): Promise<{ camera: CameraDto; scenario: DemoScenarioDto }> {
  return apiClient(`/cameras/demo-video/${encodeURIComponent(uploadId)}/complete`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function discardDemoVideo(uploadId: string): Promise<void> {
  return apiCommand(`/cameras/demo-video/${encodeURIComponent(uploadId)}`, { method: "DELETE" });
}

export function getCamera(id: string): Promise<CameraDto> {
  return apiClient(`/cameras/${encodeURIComponent(id)}`);
}

export function setCameraEnabled(id: string, enabled: boolean): Promise<unknown> {
  return apiClient(`/cameras/${encodeURIComponent(id)}/${enabled ? "start" : "stop"}`, { method: "POST" });
}

export function setCameraVision(id: string, enabled: boolean): Promise<unknown> {
  return apiClient(`/cameras/${encodeURIComponent(id)}/vision/${enabled ? "enable" : "disable"}`, { method: "POST" });
}

export function setCameraIdentity(id:string,enabled:boolean):Promise<unknown>{
  return apiClient(`/cameras/${encodeURIComponent(id)}/vision/identity`,{method:"PATCH",body:JSON.stringify({enabled})});
}
