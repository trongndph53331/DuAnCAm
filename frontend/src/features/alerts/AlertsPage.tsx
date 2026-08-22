import { useEffect, useMemo, useRef, useState } from "react";
import { PanelLeftOpen, SlidersHorizontal } from "lucide-react";
import { AlertConversation } from "./AlertConversation";
import { AlertList } from "./AlertList";
import { fetchAlerts, markAlertRead, updateAlertStatus } from "./alertService";
import type { AlertEvent, AlertFilter } from "./alert.types";
import "./alerts.css";
import "./snapshotApi.css";
import "./alertsTheme.css";

export default function AlertsPage() {
  const collapseStorageKey = "antam-alert-list-collapsed";
  const routeAlertId = () => decodeURIComponent(window.location.pathname.split("/")[2] ?? "");
  const initialRouteAlertId = routeAlertId();
  const [alerts, setAlerts] = useState<AlertEvent[]>([]); const [selectedId, setSelectedId] = useState(initialRouteAlertId); const [search, setSearch] = useState(""); const [filter, setFilter] = useState<AlertFilter>("all"); const [loading, setLoading] = useState(true); const [error, setError] = useState(false); const [mobileConversation, setMobileConversation] = useState(Boolean(initialRouteAlertId));
  const [readError,setReadError]=useState("");
  const [isAlertListCollapsed, setIsAlertListCollapsed] = useState(() => { try { return localStorage.getItem(collapseStorageKey) === "true"; } catch { return false; } }); const [advancedOpen, setAdvancedOpen] = useState(false); const [timeFilter, setTimeFilter] = useState("all"); const [cameraFilter, setCameraFilter] = useState("all"); const [typeFilter, setTypeFilter] = useState("all"); const [statusFilter, setStatusFilter] = useState("all");
  const collapseButtonRef = useRef<HTMLButtonElement>(null);
  const expandButtonRef = useRef<HTMLButtonElement>(null);
  const focusAfterToggleRef = useRef(false);
  useEffect(() => {
    document.documentElement.classList.add("alerts-viewport-locked");
    document.body.classList.add("alerts-viewport-locked");
    return () => {
      document.documentElement.classList.remove("alerts-viewport-locked");
      document.body.classList.remove("alerts-viewport-locked");
    };
  }, []);
  useEffect(() => {
    document.body.classList.toggle("alerts-conversation-open", mobileConversation);
    return () => document.body.classList.remove("alerts-conversation-open");
  }, [mobileConversation]);
  useEffect(() => { const close=(event:KeyboardEvent)=>{if(event.key==="Escape")setAdvancedOpen(false)};document.addEventListener("keydown",close);return()=>document.removeEventListener("keydown",close)},[]);
  const setAlertListCollapsed = (collapsed: boolean) => {
    focusAfterToggleRef.current = true;
    setIsAlertListCollapsed(collapsed);
    try { localStorage.setItem(collapseStorageKey, String(collapsed)); } catch { /* Keep the in-memory preference when storage is unavailable. */ }
  };
  useEffect(() => { if (!focusAfterToggleRef.current) return; focusAfterToggleRef.current = false; (isAlertListCollapsed ? expandButtonRef.current : collapseButtonRef.current)?.focus(); }, [isAlertListCollapsed]);
  useEffect(() => {
    const syncAlertRoute = () => {
      const id = routeAlertId();
      setSelectedId(id);
      setMobileConversation(Boolean(id));
    };
    window.addEventListener("popstate", syncAlertRoute);
    return () => window.removeEventListener("popstate", syncAlertRoute);
  }, []);
  const load = () => { setLoading(true); setError(false); fetchAlerts().then((items) => { setAlerts(items); setSelectedId((current) => items.some((item) => item.id === current) ? current : items[0]?.id || ""); }).catch(() => setError(true)).finally(() => setLoading(false)); };
  useEffect(load, []);
  useEffect(() => {
    const syncAlerts = () => { void fetchAlerts().then(setAlerts).catch(() => undefined); };
    window.addEventListener("antam:alerts-changed", syncAlerts);
    return () => window.removeEventListener("antam:alerts-changed", syncAlerts);
  }, []);
  const visibleAlerts = useMemo(() => alerts.filter((alert) => { const query = search.trim().toLocaleLowerCase("vi"); const matchesSearch = !query || `${alert.title} ${alert.subject} ${alert.location}`.toLocaleLowerCase("vi").includes(query); const matchesFilter = filter === "all" || (filter === "pending" && ["pending", "checking", "need_help"].includes(alert.status)) || (filter === "critical" && alert.severity === "critical") || (filter === "resolved" && ["resolved", "safe", "false_alarm"].includes(alert.status)); const age=Date.now()-Date.parse(alert.occurredAt); const matchesTime=timeFilter==="all"||(timeFilter==="today"&&age<=86400000)||(timeFilter==="7d"&&age<=604800000); return matchesSearch && matchesFilter && matchesTime && (cameraFilter==="all"||alert.cameraId===cameraFilter) && (typeFilter==="all"||alert.type===typeFilter) && (statusFilter==="all"||alert.status===statusFilter); }), [alerts, search, filter, timeFilter, cameraFilter, typeFilter, statusFilter]);
  const selected = alerts.find((alert) => alert.id === selectedId) ?? alerts[0];
  const selectAlert = (id: string) => { window.history.pushState({}, "", `/alerts/${encodeURIComponent(id)}`); setSelectedId(id); setMobileConversation(true); const target=alerts.find((item)=>item.id===id);if(!target?.unread)return;setReadError("");setAlerts((items)=>items.map((item)=>item.id===id?{...item,unread:false}:item));window.dispatchEvent(new CustomEvent("antam:alert-read",{detail:{id,phase:"pending"}}));void markAlertRead(id).then((updated)=>{setAlerts((items)=>items.map((item)=>item.id===id?updated:item));window.dispatchEvent(new CustomEvent("antam:alert-read",{detail:{id,phase:"committed"}}));window.dispatchEvent(new CustomEvent("antam:alerts-changed"))}).catch(()=>{setAlerts((items)=>items.map((item)=>item.id===id?{...item,unread:true}:item));window.dispatchEvent(new CustomEvent("antam:alert-read",{detail:{id,phase:"rollback"}}));setReadError("Không thể đánh dấu cảnh báo đã xem. Vui lòng thử lại.")}) };
  const backToList = () => { window.history.pushState({}, "", "/alerts"); setMobileConversation(false); };
  const updateStatus = (status: AlertEvent["status"], note?: string) => {
    if (!selected) return;
    const targetId = selected.id;
    const previousStatus = selected.status;
    const wasUnread=selected.unread;
    setAlerts((items) => items.map((item) => item.id === targetId ? { ...item, status, unread: false } : item));
    if(wasUnread)window.dispatchEvent(new CustomEvent("antam:alert-read",{detail:{id:targetId,phase:"pending"}}));
    window.dispatchEvent(new CustomEvent("antam:alert-status", { detail: { id: targetId, status } }));
    void updateAlertStatus(targetId, status, note).then((updated) => {
      setAlerts((items) => items.map((item) => item.id === targetId ? updated : item));
      if(wasUnread)window.dispatchEvent(new CustomEvent("antam:alert-read",{detail:{id:targetId,phase:"committed"}}));
    }).catch(() => {
      setAlerts((items) => items.map((item) => item.id === targetId ? { ...item, status: previousStatus, unread:wasUnread } : item));
      if(wasUnread)window.dispatchEvent(new CustomEvent("antam:alert-read",{detail:{id:targetId,phase:"rollback"}}));
      window.alert("Không thể lưu trạng thái cảnh báo. Vui lòng kiểm tra kết nối backend.");
    });
  };
  const cameras=Array.from(new Map(alerts.map((item)=>[item.cameraId,item.location])).entries());
  const unresolvedCount = alerts.filter((item) => ["pending", "checking", "need_help"].includes(item.status)).length;
  const advancedFilters=<div className="alert-advanced"><button className="alert-advanced-trigger" onClick={()=>setAdvancedOpen(value=>!value)} aria-expanded={advancedOpen}><SlidersHorizontal/> Bộ lọc nâng cao</button>{advancedOpen&&<><button className="alert-filter-backdrop" aria-label="Đóng bộ lọc" onClick={()=>setAdvancedOpen(false)}/><div className="alert-advanced-popover" role="dialog" aria-modal="true" aria-label="Bộ lọc cảnh báo"><header><strong>Bộ lọc nâng cao</strong><button aria-label="Đóng bộ lọc" onClick={()=>setAdvancedOpen(false)}>×</button></header><div className="alert-filter-scroll"><label>Thời gian<select value={timeFilter} onChange={e=>setTimeFilter(e.target.value)}><option value="all">Tất cả</option><option value="today">Hôm nay</option><option value="7d">7 ngày qua</option></select></label><label>Camera<select value={cameraFilter} onChange={e=>setCameraFilter(e.target.value)}><option value="all">Tất cả camera</option>{cameras.map(([id,label])=><option value={id} key={id}>{label}</option>)}</select></label><label>Loại sự kiện<select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}><option value="all">Tất cả loại</option><option value="fall">Té ngã</option><option value="stranger">Người lạ</option><option value="inactivity">Bất động</option><option value="camera">Camera</option><option value="arrival">Xuất hiện</option></select></label><label>Trạng thái<select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="all">Tất cả trạng thái</option><option value="pending">Chờ xử lý</option><option value="checking">Đã xem</option><option value="safe">An toàn</option><option value="false_alarm">Báo sai</option></select></label></div></div></>}</div>;
  return <section className={`alerts-page ${mobileConversation ? "conversation-open" : ""} ${isAlertListCollapsed ? "list-collapsed" : ""}`}>
    {readError&&<div className="alert-read-error" role="alert">{readError}</div>}{isAlertListCollapsed&&<aside className="alert-list-rail" aria-label="Điều khiển danh sách cảnh báo"><button ref={expandButtonRef} className="alert-list-expand" onClick={()=>setAlertListCollapsed(false)} aria-label="Mở danh sách cảnh báo" title="Mở danh sách cảnh báo" aria-expanded="false" aria-controls="alerts-list-panel"><PanelLeftOpen/>{unresolvedCount>0&&<span aria-label={`${unresolvedCount} cảnh báo chưa xử lý`}>{unresolvedCount>99?"99+":unresolvedCount}</span>}</button></aside>}<div className="alerts-workspace"><AlertList alerts={visibleAlerts} selectedId={selectedId} loading={loading} error={error} search={search} filter={filter} advancedFilters={advancedFilters} collapseButtonRef={collapseButtonRef} onCollapse={()=>setAlertListCollapsed(true)} onSearch={setSearch} onFilter={setFilter} onSelect={selectAlert} onRetry={load} />{selected ? <AlertConversation key={selected.id} alert={selected} onBack={backToList} onStatus={updateStatus} /> : <div className="alerts-empty">Chọn một cảnh báo để bắt đầu.</div>}</div>
  </section>;
}
