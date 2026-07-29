import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, Camera, CameraOff, ChevronLeft, ChevronRight,
  Expand, Maximize, Pause, Play, Plus, RotateCcw, Volume2, VolumeX,
} from "lucide-react";

type Mode = "live" | "playback";
type Layout = 1 | 4 | 9 | 16;

type Feed = {
  id: string;
  name: string;
  location: string;
  kind: "webcam" | "video" | "offline";
  src?: string;
};

const feeds: Feed[] = [
  { id: "home", name: "Camera trong nhà", location: "Thiết bị hiện tại", kind: "webcam" },
  { id: "living", name: "Camera phòng khách", location: "Phòng khách", kind: "video", src: "/videos/45353-448489443_medium.mp4" },
  { id: "entrance", name: "Camera cửa chính", location: "Lối vào", kind: "video", src: "/videos/76621-559757958.mp4" },
  { id: "bedroom", name: "Camera phòng ngủ", location: "Phòng ngủ", kind: "offline" },
];

export default function CameraPage() {
  const [mode, setMode] = useState<Mode>("live");
  const [layout, setLayout] = useState<Layout>(4);
  const [previousLayout, setPreviousLayout] = useState<Layout>(4);
  const [focused, setFocused] = useState<string | null>(null);
  const [singleFeedIndex, setSingleFeedIndex] = useState(0);
  const [selectedFeedId, setSelectedFeedId] = useState(feeds[0].id);
  const [webcamActive, setWebcamActive] = useState(false);
  const [webcamError, setWebcamError] = useState("");
  const [muted, setMuted] = useState<Record<string, boolean>>({});
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [timeline, setTimeline] = useState(58);
  const [now, setNow] = useState(new Date());
  const gridRef = useRef<HTMLDivElement>(null);
  const webcamRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), []);

  const visibleFeeds = useMemo(() => {
    if (focused) return feeds.filter((feed) => feed.id === focused);
    if (layout === 1) return [feeds[singleFeedIndex]];
    return feeds;
  }, [focused, layout, singleFeedIndex]);
  const selectedFeed = feeds.find((feed) => feed.id === selectedFeedId) ?? feeds[0];

  const setGridLayout = (next: Layout) => {
    setFocused(null);
    setLayout(next);
    setPreviousLayout(next);
  };

  const toggleFocus = (id: string) => {
    if (focused === id) {
      setFocused(null);
      setLayout(previousLayout);
    } else {
      setPreviousLayout(layout);
      setFocused(id);
      setLayout(1);
    }
  };

  const changeSingleFeed = (direction: -1 | 1) => {
    const currentIndex = focused ? feeds.findIndex((feed) => feed.id === focused) : singleFeedIndex;
    const nextIndex = (currentIndex + direction + feeds.length) % feeds.length;
    setSingleFeedIndex(nextIndex);
    setSelectedFeedId(feeds[nextIndex].id);
    if (focused) setFocused(feeds[nextIndex].id);
  };

  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = stream;
      if (webcamRef.current) {
        webcamRef.current.srcObject = stream;
        await webcamRef.current.play();
      }
      setWebcamError("");
      setWebcamActive(true);
      window.localStorage.setItem("antam_webcam_auto", "true");
    } catch {
      setWebcamError("Chưa được cấp quyền camera");
    }
  };

  useEffect(() => {
    const reconnectAllowedWebcam = async () => {
      if (window.localStorage.getItem("antam_webcam_auto") !== "true") return;
      try {
        const permission = await navigator.permissions?.query({ name: "camera" } as PermissionDescriptor);
        if (!permission || permission.state === "granted") await startWebcam();
      } catch {
        await startWebcam();
      }
    };
    void reconnectAllowedWebcam();
  }, []);

  const capture = (feed: Feed) => {
    const video = feed.kind === "webcam" ? webcamRef.current : document.querySelector<HTMLVideoElement>(`[data-feed="${feed.id}"] video`);
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/jpeg", .9);
    link.download = `${feed.id}-${Date.now()}.jpg`;
    link.click();
  };

  const fullscreen = async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await gridRef.current?.requestFullscreen();
  };

  const columns = layout === 1 ? 1 : layout === 4 ? 2 : layout === 9 ? 3 : 4;
  const rows = columns;
  const cells = Array.from({ length: focused ? 1 : layout }, (_, index) => visibleFeeds[index] ?? null);
  const clock = now.toLocaleTimeString("vi-VN", { hour12: false });

  return (
    <section className="nvr-page">
      <style>{styles}</style>
      <div className="nvr-shell">
        <div className="compact-layout-bar" role="group" aria-label="Chọn bố cục camera">
          <span>Bố cục</span>
          {([1, 4, 9, 16] as Layout[]).map((item) => (
            <button key={item} className={!focused && layout === item ? "active" : ""} onClick={() => setGridLayout(item)}>{item}</button>
          ))}
        </div>
        <div className="nvr-stage" ref={gridRef}>
          <div className="nvr-grid" style={{ "--nvr-columns": columns, "--nvr-rows": rows } as React.CSSProperties}>
            {cells.map((feed, index) => feed ? (
              <CameraCell
                key={feed.id}
                feed={feed}
                clock={clock}
                mode={mode}
                webcamRef={feed.kind === "webcam" ? webcamRef : undefined}
                webcamActive={webcamActive}
                webcamError={webcamError}
                muted={muted[feed.id] ?? true}
                selected={selectedFeedId === feed.id}
                onStartWebcam={startWebcam}
                onSelect={() => setSelectedFeedId(feed.id)}
                onFocus={() => toggleFocus(feed.id)}
                onCapture={() => capture(feed)}
                onSound={() => setMuted((state) => ({ ...state, [feed.id]: !(state[feed.id] ?? true) }))}
              />
            ) : <button className="empty-cell" key={`empty-${index}`}><Plus /><span>Thêm camera</span></button>)}
          </div>

          {layout === 1 && feeds.length > 1 && (
            <>
              <button className="single-feed-nav previous" onClick={() => changeSingleFeed(-1)} aria-label="Xem camera trước"><ChevronLeft /></button>
              <button className="single-feed-nav next" onClick={() => changeSingleFeed(1)} aria-label="Xem camera tiếp theo"><ChevronRight /></button>
              <div className="single-feed-counter">{(focused ? feeds.findIndex((feed) => feed.id === focused) : singleFeedIndex) + 1} / {feeds.length}</div>
            </>
          )}

          {mode === "playback" && (
            <section className="timeline-panel" aria-label="Dòng thời gian xem lại">
              <div className="playback-controls">
                <button aria-label="Tua lùi"><ChevronLeft /></button>
                <button className="play-button" onClick={() => setPaused((value) => !value)} aria-label={paused ? "Phát" : "Tạm dừng"}>{paused ? <Play /> : <Pause />}</button>
                <button aria-label="Tua tới"><ChevronRight /></button>
                <button className="speed-button" onClick={() => setSpeed((value) => value === 4 ? 1 : value * 2)}>{speed}x</button>
              </div>
              <div className="timeline-track-wrap">
                <div className="time-labels"><span>09:00</span><span>10:00</span><span>11:00</span><span>12:00</span></div>
                <div className="timeline-track"><span className="event-marker danger" style={{ left: "28%" }} title="Cảnh báo"/><span className="event-marker safe" style={{ left: "53%" }} title="Bình thường"/><span className="event-marker danger" style={{ left: "78%" }} title="Cảnh báo"/><input type="range" min="0" max="100" value={timeline} onChange={(event) => setTimeline(Number(event.target.value))} aria-label="Chọn thời gian xem lại" /></div>
              </div>
            </section>
          )}
        </div>
        <p className="nvr-hint">Nhấp đúp vào một ô để phóng to · Nhấp lại vào ô đã phóng to để trở về lưới</p>
      </div>

      <aside className="mobile-camera-actions" aria-label={`Hành động cho ${selectedFeed.name}`}>
        <div className="selected-camera-copy"><span className={`status-dot ${selectedFeed.kind === "offline" ? "offline" : ""}`} /><div><small>Camera đang chọn</small><strong>{selectedFeed.name}</strong></div></div>
        <div className="mobile-action-buttons">
          <button disabled={selectedFeed.kind === "offline"} onClick={() => toggleFocus(selectedFeed.id)}><Expand /><span>{focused === selectedFeed.id ? "Thu nhỏ" : "Phóng to"}</span></button>
          <button disabled={selectedFeed.kind === "offline"} onClick={() => capture(selectedFeed)}><Camera /><span>Chụp ảnh</span></button>
          <button disabled={selectedFeed.kind === "offline"} onClick={() => setMuted((state) => ({ ...state, [selectedFeed.id]: !(state[selectedFeed.id] ?? true) }))}>{(muted[selectedFeed.id] ?? true) ? <VolumeX /> : <Volume2 />}<span>Âm thanh</span></button>
        </div>
      </aside>
    </section>
  );
}

function CameraCell({ feed, clock, mode, webcamRef, webcamActive, webcamError, muted, selected, onStartWebcam, onSelect, onFocus, onCapture, onSound }: {
  feed: Feed; clock: string; mode: Mode; webcamRef?: React.RefObject<HTMLVideoElement | null>; webcamActive: boolean; webcamError: string; muted: boolean; selected: boolean;
  onStartWebcam: () => void; onSelect: () => void; onFocus: () => void; onCapture: () => void; onSound: () => void;
}) {
  const offline = feed.kind === "offline";
  return (
    <article className={`nvr-cell ${selected ? "selected" : ""}`} data-feed={feed.id} onDoubleClick={onFocus} onClick={(event) => { onSelect(); if ((event.currentTarget.parentElement?.children.length ?? 2) === 1) onFocus(); }}>
      {feed.kind === "video" && <video src={feed.src} autoPlay muted={muted} loop playsInline />}
      {feed.kind === "webcam" && <video ref={webcamRef} autoPlay muted playsInline className="mirror" />}
      {feed.kind === "webcam" && !webcamActive && <button className="webcam-placeholder" onClick={(event) => { event.stopPropagation(); onStartWebcam(); }}><Camera /><strong>{webcamError || "Bật camera trong nhà"}</strong><span>Không sử dụng micro</span></button>}
      {offline && <div className="offline-state"><CameraOff /><strong>Mất kết nối</strong><span>Hình ảnh gần nhất lúc 09:12</span></div>}
      <div className="bottom-overlay"><span className={`status-dot ${offline ? "offline" : ""}`} /><strong>{feed.name}</strong><span className="camera-location">· {feed.location}</span><time>{clock}</time></div>
      {!offline && <div className="cell-actions"><button onClick={(e) => { e.stopPropagation(); onFocus(); }} aria-label="Phóng to"><Expand /></button><button onClick={(e) => { e.stopPropagation(); onCapture(); }} aria-label="Chụp ảnh"><Camera /></button><button onClick={(e) => { e.stopPropagation(); onSound(); }} aria-label="Bật tắt âm thanh">{muted ? <VolumeX /> : <Volume2 />}</button></div>}
    </article>
  );
}

const styles = `
.nvr-page{padding:32px 34px 44px;max-width:1600px;margin:0 auto;color:#172033}.nvr-heading{display:flex;justify-content:space-between;align-items:end;margin-bottom:20px}.nvr-heading p{margin:0;color:#5d7998;font-size:14px;font-weight:800;text-transform:uppercase;letter-spacing:.06em}.nvr-heading h1{font-size:32px;margin:5px 0 9px}.nvr-heading span{display:flex;align-items:center;gap:7px;color:#18743b;font-size:14px;font-weight:700}.nvr-heading span svg{width:17px}.nvr-shell{border:1px solid #dbe5f0;border-radius:16px;background:#fff;box-shadow:0 12px 32px rgba(44,80,120,.08);overflow:hidden}.nvr-toolbar{min-height:68px;padding:10px 14px;display:flex;align-items:center;gap:18px;border-bottom:1px solid #dbe5f0;background:#fff}.mode-toggle,.layout-group{display:flex;align-items:center;gap:5px}.mode-toggle{padding:4px;border:1px solid #d5e1ee;border-radius:10px}.mode-toggle button,.layout-group button,.fullscreen-button{height:40px;border:0;border-radius:8px;background:#fff;color:#52657b;font-size:14px;font-weight:750;display:flex;align-items:center;justify-content:center;gap:7px;cursor:pointer}.mode-toggle button{padding:0 13px}.mode-toggle button.active,.layout-group button.active{background:#e1efff;color:#1e65bb}.mode-toggle svg,.fullscreen-button svg{width:18px}.layout-group{border-left:1px solid #dbe5f0;padding-left:18px}.layout-group>span{font-size:14px;color:#718095;margin-right:3px}.layout-group button{width:40px;border:1px solid #d5e1ee}.fullscreen-button{margin-left:auto;padding:0 13px;border:1px solid #d5e1ee}.nvr-stage{background:#1a1a1a;padding:4px}.nvr-grid{--nvr-columns:2;display:grid;grid-template-columns:repeat(var(--nvr-columns),minmax(0,1fr));gap:4px;transition:grid-template-columns .25s ease}.nvr-cell,.empty-cell{position:relative;aspect-ratio:16/9;min-width:0;overflow:hidden;background:#25282d;border:0;color:#fff;transition:transform .22s ease,opacity .22s ease}.nvr-cell{cursor:pointer}.nvr-cell>video{width:100%;height:100%;object-fit:cover;display:block}.nvr-cell>video.mirror{transform:scaleX(-1)}.top-overlay,.bottom-overlay{position:absolute;z-index:3;left:0;right:0;display:flex;align-items:center;gap:8px;padding:10px 12px;background:linear-gradient(180deg,rgba(0,0,0,.72),transparent);font-size:14px;pointer-events:none}.top-overlay{top:0}.top-overlay strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bottom-overlay{bottom:0;padding-top:28px;background:linear-gradient(0deg,rgba(0,0,0,.78),transparent);color:#e8edf3}.bottom-overlay time{margin-left:auto;font-variant-numeric:tabular-nums}.live-badge,.offline-badge{padding:4px 6px;border-radius:5px;background:#d72d2d;font-size:14px;font-weight:900;letter-spacing:.04em}.offline-badge{background:#68717d}.status-dot{width:9px;height:9px;border-radius:50%;background:#31d26d;box-shadow:0 0 0 3px rgba(49,210,109,.2)}.status-dot.offline{background:#ef4444;box-shadow:0 0 0 3px rgba(239,68,68,.2)}.cell-actions{position:absolute;z-index:5;right:10px;bottom:43px;display:flex;gap:5px;opacity:0;transform:translateY(5px);transition:.18s}.nvr-cell:hover .cell-actions,.nvr-cell:focus-within .cell-actions{opacity:1;transform:none}.cell-actions button{width:38px;height:38px;border:1px solid rgba(255,255,255,.24);border-radius:7px;background:rgba(8,12,17,.72);color:#fff;display:grid;place-items:center;cursor:pointer}.cell-actions svg{width:18px}.offline-state{position:absolute;inset:0;z-index:2;background:rgba(15,17,20,.8);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;color:#d8dee6}.offline-state svg{width:38px;height:38px;color:#f87171}.offline-state strong{font-size:17px}.offline-state span{font-size:14px;color:#aab3bf}.webcam-placeholder{position:absolute;inset:0;width:100%;border:0;background:#25282d;color:#dce5ef;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;cursor:pointer}.webcam-placeholder svg{width:36px;height:36px;color:#72adf2}.webcam-placeholder strong{font-size:16px}.webcam-placeholder span{font-size:14px;color:#9da9b8}.empty-cell{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;background:#30343a;color:#aeb8c4;cursor:pointer}.empty-cell:hover{background:#373c43;color:#fff}.empty-cell svg{width:30px;height:30px}.empty-cell span{font-size:14px;font-weight:700}.timeline-panel{display:grid;grid-template-columns:auto 1fr;align-items:center;gap:20px;padding:15px 18px;background:#fff;border-top:1px solid #dbe5f0}.playback-controls{display:flex;align-items:center;gap:6px}.playback-controls button{width:40px;height:40px;border:1px solid #d6e1ed;border-radius:8px;background:#fff;color:#47617e;display:grid;place-items:center;cursor:pointer}.playback-controls .play-button{background:#3178ce;color:#fff;border-color:#3178ce}.playback-controls .speed-button{font-weight:800;font-size:14px}.timeline-track-wrap{min-width:0}.time-labels{display:flex;justify-content:space-between;color:#68788c;font-size:14px;margin-bottom:7px}.timeline-track{height:24px;position:relative;background:#e7eef6;border-radius:6px}.timeline-track input{position:absolute;inset:0;width:100%;margin:0;accent-color:#3b82f6;background:transparent}.event-marker{position:absolute;top:2px;width:6px;height:20px;border-radius:3px;z-index:2;pointer-events:none}.event-marker.danger{background:#ef4444}.event-marker.safe{background:#22c55e}.nvr-hint{margin:0;padding:11px 16px;background:#f8fbff;border-top:1px solid #dbe5f0;color:#65768b;font-size:14px;text-align:center}.nvr-stage:fullscreen{display:grid;align-content:center;background:#111;padding:8px}.nvr-stage:fullscreen .nvr-grid{width:100vw}.nvr-stage:fullscreen .timeline-panel{position:absolute;left:0;right:0;bottom:0}
@media(max-width:860px){.nvr-page{padding:24px 20px 110px}.nvr-toolbar{flex-wrap:wrap;gap:10px}.layout-group{order:3;width:100%;border-left:0;padding-left:0;border-top:1px solid #e1e8f0;padding-top:10px}.fullscreen-button span{display:none}.nvr-grid{grid-template-columns:repeat(min(var(--nvr-columns),2),minmax(0,1fr))}.timeline-panel{grid-template-columns:1fr;gap:12px}.playback-controls{justify-content:center}}
@media(max-width:600px){.nvr-page{padding:20px 12px 100px}.nvr-heading h1{font-size:28px}.nvr-shell{border-radius:12px}.nvr-toolbar{padding:9px}.mode-toggle{flex:1}.mode-toggle button{flex:1;padding:0 8px}.layout-group{justify-content:space-between}.layout-group>span{display:none}.layout-group button{flex:1}.nvr-stage{padding:3px}.nvr-grid{gap:3px}.nvr-grid[style*="--nvr-columns: 1"]{grid-template-columns:1fr}.top-overlay,.bottom-overlay{padding-left:8px;padding-right:8px;gap:5px}.top-overlay strong{font-size:14px}.bottom-overlay span:not(.status-dot){max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cell-actions{opacity:1;transform:none;right:6px;bottom:39px}.cell-actions button{width:34px;height:34px}.timeline-panel{padding:12px 10px}.nvr-hint{line-height:1.45}}
.nvr-stage{position:relative}.single-feed-nav{position:absolute;z-index:8;top:50%;transform:translateY(-50%);width:48px;height:64px;border:1px solid rgba(255,255,255,.28);border-radius:10px;background:rgba(4,8,13,.7);color:#fff;display:grid;place-items:center;cursor:pointer;opacity:.78;transition:.18s}.single-feed-nav:hover{opacity:1;background:rgba(30,101,184,.9)}.single-feed-nav.previous{left:14px}.single-feed-nav.next{right:14px}.single-feed-nav svg{width:28px;height:28px}.single-feed-counter{position:absolute;z-index:8;left:50%;bottom:50px;transform:translateX(-50%);padding:5px 11px;border-radius:999px;background:rgba(4,8,13,.72);color:#fff;font-size:14px;font-weight:800;pointer-events:none}@media(max-width:600px){.single-feed-nav{width:42px;height:56px}.single-feed-nav.previous{left:8px}.single-feed-nav.next{right:8px}.single-feed-counter{bottom:44px}}
.mobile-camera-actions{display:none}.nvr-cell.selected{box-shadow:inset 0 0 0 3px #60a5fa;z-index:6}@media(max-width:600px){.nvr-page{padding-bottom:220px}.cell-actions{display:none}.mobile-camera-actions{position:fixed;z-index:900;left:12px;right:12px;bottom:calc(80px + env(safe-area-inset-bottom));display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:12px;padding:11px 12px;background:rgba(255,255,255,.98);border:1px solid #cdddeb;border-radius:14px;box-shadow:0 -8px 30px rgba(27,58,94,.16)}.selected-camera-copy{min-width:0;display:flex;align-items:center;gap:10px}.selected-camera-copy>div{min-width:0}.selected-camera-copy small{display:block;color:#64748b;font-size:14px}.selected-camera-copy strong{display:block;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:15px}.mobile-action-buttons{display:flex;gap:6px}.mobile-action-buttons button{width:58px;min-height:58px;padding:5px 2px;border:1px solid #cfdeed;border-radius:10px;background:#f7fbff;color:#245f9f;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;font-size:14px;font-weight:700}.mobile-action-buttons button:disabled{color:#9aa7b5;background:#f1f3f5}.mobile-action-buttons svg{width:20px;height:20px}.mobile-action-buttons span{font-size:14px;line-height:1.1}}
.nvr-stage{overflow:hidden}.nvr-grid{--nvr-rows:2;width:100%;height:auto;max-height:calc(100dvh - 250px);aspect-ratio:16/9;grid-template-rows:repeat(var(--nvr-rows),minmax(0,1fr));overflow:hidden}.nvr-cell,.empty-cell{width:100%;height:100%;aspect-ratio:auto}.nvr-cell>video{position:absolute;inset:0}@media(max-width:860px){.nvr-grid{max-height:none;aspect-ratio:16/9}}@media(max-width:600px){html,body,#root{overflow-x:hidden}.nvr-page,.nvr-shell,.nvr-stage,.nvr-grid{max-width:100%;min-width:0}.nvr-grid{width:100%;aspect-ratio:16/9}.nvr-cell,.empty-cell{min-width:0;min-height:0}}
.nvr-page{padding-top:12px}@media(max-width:860px){.nvr-page{padding-top:10px}}@media(max-width:600px){.nvr-page{padding-top:8px}}
.compact-layout-bar{min-height:52px;padding:6px 10px;display:flex;align-items:center;justify-content:center;gap:6px;background:#fff;border-bottom:1px solid #dbe5f0}.compact-layout-bar>span{margin-right:3px;color:#64748b;font-size:14px;font-weight:700}.compact-layout-bar button{width:46px;height:38px;border:1px solid #d2dfec;border-radius:8px;background:#fff;color:#506278;font-size:15px;font-weight:800;cursor:pointer}.compact-layout-bar button.active{border-color:#b8d4f4;background:#dcecff;color:#1f67b8}@media(max-width:600px){.compact-layout-bar{min-height:48px;padding:5px 8px;justify-content:stretch}.compact-layout-bar>span{display:none}.compact-layout-bar button{flex:1;height:38px}}
.bottom-overlay{min-height:34px;padding:6px 10px;background:rgba(5,9,14,.7);backdrop-filter:blur(3px)}.bottom-overlay strong{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.camera-location{color:#c7d0da;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}@media(max-width:600px){.bottom-overlay{min-height:31px;padding:5px 7px}.camera-location{display:none}.bottom-overlay time{font-size:14px}}
.bottom-overlay{min-height:0;padding:7px 10px;background:transparent;backdrop-filter:none;text-shadow:0 1px 3px #000,0 0 6px rgba(0,0,0,.95)}.bottom-overlay strong,.bottom-overlay span,.bottom-overlay time{filter:drop-shadow(0 1px 2px #000)}@media(max-width:600px){.bottom-overlay{min-height:0;padding:6px 7px;background:transparent}}
.nvr-cell{container-type:inline-size}.bottom-overlay{font-size:clamp(14px,4cqw,18px)}.bottom-overlay time{font-size:clamp(14px,3.2cqw,16px)}.offline-state strong,.webcam-placeholder strong{font-size:clamp(14px,4.5cqw,18px)}.offline-state span,.webcam-placeholder span{font-size:clamp(14px,3.4cqw,16px)}.compact-layout-bar button{font-size:clamp(14px,1.1vw,16px)}.mobile-camera-actions strong{font-size:clamp(14px,3.8vw,16px)}.mobile-action-buttons button{font-size:clamp(14px,3.3vw,15px)}
`;
