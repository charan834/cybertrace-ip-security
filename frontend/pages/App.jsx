import React, { lazy, Suspense, useEffect, useState, useRef } from "react";
import {
  ShieldCheck,
  Activity,
  Globe2,
  Network,
  Search,
  ArrowUpRight,
  ArrowRight,
  RefreshCw,
  Download,
  Printer,
  Clock3,
  MapPin,
  Server,
  ChevronRight,
  Terminal,
  LockKeyhole,
  Info,
  Menu,
  X,
  Pause,
  Play,
  Radio,
  CheckCircle2,
  AlertTriangle,
  ScanLine,
  FileText,
  ExternalLink,
} from "lucide-react";
import WorldMap from "../components/WorldMap.jsx";
import {
  Panel,
  Signal,
  CopyButton,
  Counter,
  Modal,
  display,
} from "../components/UI.jsx";
const GeoMap = lazy(() => import("../components/GeoMap.jsx"));
const disclaimer =
  "IP-based geolocation is approximate and may represent the ISP, network gateway, or a nearby geographic area rather than the exact physical location of the device.";
const utc = (d) => new Date(d).toLocaleTimeString("en-GB", { timeZone: "UTC" });
async function api(path, signal) {
  const response = await fetch(path, { signal });
  let body;
  try {
    body = await response.json();
  } catch {
    throw {
      code: "NETWORK_ERROR",
      message: "The server returned an unreadable response. Please try again.",
    };
  }
  if (!response.ok)
    throw (
      body.error || {
        code: "SERVICE_UNAVAILABLE",
        message: "The service is unavailable.",
      }
    );
  return body;
}
export default function App() {
  const [data, setData] = useState(null),
    [health, setHealth] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(null),
    [query, setQuery] = useState(""),
    [timeline, setTimeline] = useState([]),
    [clock, setClock] = useState(new Date()),
    [active, setActive] = useState("Dashboard"),
    [menu, setMenu] = useState(false),
    [modal, setModal] = useState(null),
    [toast, setToast] = useState(""),
    [animated, setAnimated] = useState(
      !matchMedia("(prefers-reduced-motion: reduce)").matches,
    ),
    [mapLoaded, setMapLoaded] = useState(false),
    [target, setTarget] = useState(null);
  const controller = useRef(),
    geoRef = useRef(),
    requestId = useRef(0);
  const demo = health?.mode === "demo" || data?.mode === "demo";
  const event = (message, kind = "ok") =>
    setTimeline((prev) => [
      ...prev,
      { message, kind, time: new Date().toISOString() },
    ]);
  const notify = (message) => setToast(message);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setMapLoaded(true);
          observer.disconnect();
        }
      },
      { rootMargin: "150px" },
    );
    if (geoRef.current) observer.observe(geoRef.current);
    return () => observer.disconnect();
  }, []);
  async function analyze(ip, initial = false) {
    controller.current?.abort();
    controller.current = new AbortController();
    const signal = controller.current.signal,
      id = ++requestId.current;
    setLoading(true);
    setError(null);
    setData(null);
    setTimeline([]);
    try {
      let selected = ip;
      if (initial || !selected) {
        const status = await api("/api/health", signal);
        setHealth(status);
        const visitor = await api("/api/my-ip", signal);
        selected = visitor.mode === "demo" ? "8.8.8.8" : visitor.ip;
        event(
          visitor.mode === "demo"
            ? "Demo session initialized · visitor IP not collected"
            : "Public connection detected",
        );
      } else event("IP submitted for validation");
      setTarget(selected);
      const result = await api(
        `/api/ip-intelligence?ip=${encodeURIComponent(selected)}`,
        signal,
      );
      if (id !== requestId.current) return;
      event(
        result.mode === "demo"
          ? "Isolated sample intelligence loaded"
          : result.cached
            ? "Intelligence retrieved from cache"
            : "IP intelligence retrieved",
      );
      event(
        result.latitude !== undefined
          ? "Approximate geolocation resolved"
          : "Location coordinates unavailable",
        result.latitude !== undefined ? "ok" : "info",
      );
      event(
        `Security signals evaluated · ${result.risk.availableSignals}/${result.risk.requiredSignals} available`,
      );
      event(
        result.mode === "demo"
          ? "Sample analysis complete"
          : "Security analysis complete",
      );
      setData(result);
      setHealth((prev) => ({
        ...prev,
        status: "online",
        mode: result.mode,
        providerStatus: result.mode === "demo" ? "demo" : "available",
      }));
      if (!initial)
        notify(
          result.mode === "demo"
            ? "Demo analysis complete — fictional sample, not the searched IP"
            : "Analysis complete",
        );
    } catch (e) {
      if (e.name === "AbortError") return;
      const failure = {
        code: e.code || "NETWORK_ERROR",
        message: e.message || "Unable to reach the backend. Please try again.",
      };
      setError(failure);
      event(failure.message, "error");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }
  useEffect(() => {
    analyze(null, true);
    return () => controller.current?.abort();
  }, []);
  const navigate = (label, id) => {
    setActive(label);
    setMenu(false);
    if (id === "about") {
      setModal("About CYBERTRACE");
      return;
    }
    document
      .getElementById(id)
      ?.scrollIntoView({
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "start",
      });
  };
  function submit(e) {
    e.preventDefault();
    if (!query.trim()) {
      setError({
        code: "INVALID_IP_ADDRESS",
        message: "Please enter a valid IPv4 or IPv6 address.",
      });
      return;
    }
    analyze(query.trim());
  }
  function exportReport() {
    if (!data) return;
    const report = {
      title: "IP INTELLIGENCE REPORT",
      classification: demo
        ? "DEMO DATA — NOT REAL-TIME THREAT INTELLIGENCE"
        : "IP-based intelligence; not a device security assessment",
      ...data,
      accuracyDisclaimer: disclaimer,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `cybertrace-${demo ? "DEMO-" : ""}${data.ip.replaceAll(":", "-")}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify("IP intelligence report exported");
  }
  const details = [
    ["IP address", data?.ip, Globe2],
    ["IP version", data?.ipVersion, Network],
    ["Hostname", data?.hostname, Server],
    ["ISP", data?.isp, Radio],
    ["Organization", data?.organization, ShieldCheck],
    ["ASN", data?.asn, Network],
    ["ASN organization", data?.asnOrganization, Server],
    ["Network / CIDR", data?.network, Network],
    ["Timezone", data?.timezone, Clock3],
    ["Country", data?.country, Globe2],
    ["Region", data?.region, MapPin],
    ["City", data?.city, MapPin],
    ["Postal code", data?.postal, MapPin],
    ["Currency", data?.currency, Info],
  ];
  const threats = [
    ["Proxy detection", "is_proxy"],
    ["VPN detection", "is_vpn"],
    ["Tor detection", "is_tor"],
    ["Hosting provider", "is_hosting"],
    ["Datacenter detection", "is_datacenter"],
    ["Known attacker", "is_known_attacker"],
    ["Abuse reputation", "is_known_abuser"],
    ["Bot detection", "is_bot"],
  ];
  const nav = [
    ["Dashboard", "dashboard"],
    ["IP Intelligence", "intelligence"],
    ["Geolocation", "geolocation"],
    ["Threat Analysis", "threats"],
    ["Network", "network"],
    ["About", "about"],
  ];
  const risk = data?.risk,
    hasCoords = data?.latitude !== undefined && data?.longitude !== undefined;
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to intelligence dashboard
      </a>
      <header className="topbar">
        <a className="brand" href="#dashboard" aria-label="CYBERTRACE home">
          <span className="brand-icon">
            <ShieldCheck size={25} />
          </span>
          <span>
            CYBER<span className="brand-light">TRACE</span>
            <small>IP SECURITY & INTELLIGENCE</small>
          </span>
        </a>
        <nav
          className={menu ? "nav open" : "nav"}
          aria-label="Primary navigation"
        >
          {nav.map(([label, id]) => (
            <button
              key={label}
              className={active === label ? "active" : ""}
              onClick={() => navigate(label, id)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="system-status">
          <span className={`dot ${health ? "" : "muted"}`} />
          {health ? "SYSTEM ONLINE" : "CONNECTING"}
          <span className="clock">
            {utc(clock)} <span>UTC</span>
          </span>
        </div>
        <button
          className="mobile-menu icon-button"
          onClick={() => setMenu(!menu)}
          aria-expanded={menu}
          aria-label="Toggle navigation"
        >
          {menu ? <X /> : <Menu />}
        </button>
      </header>
      <main id="main">
        <div id="dashboard" className="page-heading">
          <div>
            <div className="eyebrow">
              <span className="tiny-square" /> SECURITY OPERATIONS / OVERVIEW
            </div>
            <h1>
              Connection intelligence<span>.</span>
            </h1>
            <p>Real-time IP intelligence, geolocation and security analysis.</p>
          </div>
          <div className="heading-actions">
            <span className="last-analysis">
              <Clock3 size={13} />{" "}
              {data
                ? `Last analysis ${utc(data.analyzedAt)} UTC`
                : "Awaiting analysis"}
            </span>
            <button
              className="button secondary"
              disabled={!data || loading}
              onClick={exportReport}
            >
              <Download size={14} />
              Export report
            </button>
            <button
              className="icon-button bordered"
              disabled={!data || loading}
              onClick={() => window.print()}
              aria-label="Print IP intelligence report"
            >
              <Printer size={16} />
            </button>
          </div>
        </div>
        {demo && (
          <div className="demo-banner">
            <span>
              <Info size={14} />
              <strong>DEMO MODE</strong>
              <span className="banner-divider" /> DEMO DATA — NOT REAL-TIME
              THREAT INTELLIGENCE
            </span>
            <button onClick={() => setModal("Provider configuration")}>
              Connect intelligence provider
              <ArrowUpRight size={13} />
            </button>
          </div>
        )}
        <form className="search-console" onSubmit={submit}>
          <div className="search-label">
            <Search size={16} />
            <label htmlFor="ip-search">IP INTELLIGENCE SEARCH</label>
          </div>
          <input
            id="ip-search"
            aria-describedby="search-help"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter a public IPv4 or IPv6 address"
            autoComplete="off"
            spellCheck="false"
            maxLength={80}
          />
          <span className="search-hint" id="search-help">
            IPv4 / IPv6
          </span>
          <button className="button primary" disabled={loading} type="submit">
            {loading ? (
              <RefreshCw className="spin" size={14} />
            ) : (
              <ScanLine size={15} />
            )}
            Analyze IP
            <ArrowRight size={14} />
          </button>
        </form>
        {error && (
          <div className="error-banner" role="alert">
            <AlertTriangle size={20} />
            <div>
              <strong>{error.code.replaceAll("_", " ")}</strong>
              <p>{error.message}</p>
            </div>
            <button
              className="button secondary"
              onClick={() => analyze(target)}
            >
              Retry
            </button>
          </div>
        )}
        <div className="hero-grid">
          <Panel
            className={`connection-panel ${loading ? "analyzing" : ""}`}
            title={demo ? "YOUR CONNECTION · DEMO" : "YOUR CONNECTION"}
            icon={Network}
            tag={
              <span className="tag">
                {demo ? "SAMPLE" : data ? "ANALYZED" : "READY"}
              </span>
            }
          >
            <div className="connection-body">
              <div className="eyebrow">
                {demo ? "SAMPLE PUBLIC IP" : "DETECTED PUBLIC IP"}
              </div>
              <div className="ip-number">
                {loading ? (
                  <span className="loading-text">
                    Analyzing connection<span>...</span>
                  </span>
                ) : (
                  data?.ip || "Not detected"
                )}
                {data && (
                  <CopyButton
                    value={data.ip}
                    label="Copy IP address"
                    notify={notify}
                  />
                )}
              </div>
              <div className="connection-status" aria-live="polite">
                <span className={`dot ${!data ? "muted" : ""}`} />
                {loading
                  ? "ANALYZING CONNECTION"
                  : data
                    ? demo
                      ? "SAMPLE CONNECTION ANALYZED"
                      : "CONNECTION ANALYZED"
                    : "AWAITING CONNECTION"}
                {data && <span className="version-pill">{data.ipVersion}</span>}
              </div>
              <div className="connection-divider" />
              <div className="connection-place">
                <span className="location-icon">
                  <MapPin size={21} />
                </span>
                <div>
                  <strong>
                    {data?.city || "Location unavailable"}
                    {data?.countryCode ? `, ${data.countryCode}` : ""}
                  </strong>
                  <small>
                    Approximate IP Geolocation{demo ? " · sample" : ""}
                  </small>
                </div>
              </div>
              <div className="quick-data">
                <div>
                  <span>NETWORK</span>
                  <strong>{display(data?.asnOrganization)}</strong>
                </div>
                <div>
                  <span>AUTONOMOUS SYSTEM</span>
                  <strong className="mono">{display(data?.asn)}</strong>
                </div>
                <div>
                  <span>TIMEZONE</span>
                  <strong className="mono">{display(data?.timezone)}</strong>
                </div>
              </div>
              <button
                className="button primary run-button"
                onClick={() => analyze(target)}
                disabled={loading}
              >
                <ScanLine size={16} />
                {loading ? "Analyzing connection…" : "Run security analysis"}
                <ArrowRight size={15} />
              </button>
              <div className="passive-note">
                <LockKeyhole size={11} />
                Passive intelligence. No device or network scanning.
              </div>
            </div>
          </Panel>
          <Panel
            title="GLOBAL IP THREAT ACTIVITY"
            icon={Globe2}
            className="global-panel"
            tag={
              <div className="map-controls">
                <span className="tag amber">DEMO VISUALIZATION</span>
                <button
                  className="icon-button"
                  onClick={() => setAnimated(!animated)}
                  aria-label={
                    animated ? "Pause map animation" : "Play map animation"
                  }
                >
                  {animated ? <Pause size={13} /> : <Play size={13} />}
                </button>
              </div>
            }
          >
            <div className="world-stage">
              <div className="map-overlay">
                <span className="dot" />
                ILLUSTRATIVE NETWORK TELEMETRY
                <small>GLOBAL NETWORK / WORLD VIEW</small>
              </div>
              <WorldMap animated={animated} />
              <div className="map-coordinate">
                90° N<span>0°</span>90° S
              </div>
              <div className="map-key">
                <span>
                  <i />
                  Network node
                </span>
                <span>
                  <i className="amber-node" />
                  Illustrative route
                </span>
              </div>
              <span className="map-watermark">
                CYBERTRACE / INTELLIGENCE ENGINE
              </span>
            </div>
            <div className="map-bottom">
              <div>
                <span className="map-stat-icon">
                  <Network size={18} />
                </span>
                <div>
                  <strong>
                    09<span> nodes</span>
                  </strong>
                  <small>ILLUSTRATIVE ENDPOINTS</small>
                </div>
              </div>
              <div>
                <span className="map-stat-icon">
                  <Activity size={18} />
                </span>
                <div>
                  <strong>
                    08<span> routes</span>
                  </strong>
                  <small>ANIMATED CONNECTIONS</small>
                </div>
              </div>
              <div>
                <span className="map-stat-icon">
                  <Globe2 size={18} />
                </span>
                <div>
                  <strong>Global</strong>
                  <small>SIMULATED COVERAGE</small>
                </div>
              </div>
            </div>
            <p className="map-disclaimer">
              Abstract connections for demonstration. No live threat feed is
              connected.
            </p>
          </Panel>
        </div>
        <div className="overview-strip">
          <div>
            <span className="overview-icon">
              <Globe2 />
            </span>
            <div>
              <small>LOCATION</small>
              <strong>
                {display(data?.country)}{" "}
                {data?.countryCode && (
                  <span className="subtle-code">{data.countryCode}</span>
                )}
              </strong>
            </div>
          </div>
          <div>
            <span className="overview-icon">
              <Server />
            </span>
            <div>
              <small>INTERNET SERVICE PROVIDER</small>
              <strong>{display(data?.isp)}</strong>
            </div>
          </div>
          <div>
            <span className="overview-icon">
              <ShieldCheck />
            </span>
            <div>
              <small>REPUTATION ASSESSMENT</small>
              <strong className={risk?.level === "LOW" ? "mint" : ""}>
                {risk?.score == null
                  ? "Insufficient data"
                  : `${risk.level} RISK`}
                {demo && <span className="subtle-code">SAMPLE</span>}
              </strong>
            </div>
          </div>
          <div>
            <span className="overview-icon">
              <Activity />
            </span>
            <div>
              <small>INTELLIGENCE SIGNALS</small>
              <strong>
                {risk
                  ? `${risk.availableSignals} / ${risk.requiredSignals}`
                  : "—"}
                <span className="subtle-code">AVAILABLE</span>
              </strong>
            </div>
          </div>
        </div>
        <div className="section-heading">
          <div>
            <span className="eyebrow">THE COMPLETE PICTURE</span>
            <h2>Intelligence workspace</h2>
          </div>
          <span className="section-caption">
            <LockKeyhole size={12} /> Server-processed intelligence
          </span>
        </div>
        <div className="workspace-grid">
          <Panel
            id="intelligence"
            title="IP INTELLIGENCE"
            icon={Terminal}
            tag={<span className="tag">{data?.ipVersion || "IP"}</span>}
          >
            <dl className="intelligence-list">
              {details.map(([label, value, Icon]) => (
                <div key={label}>
                  <dt>
                    <Icon size={13} />
                    {label}
                  </dt>
                  <dd className={value ? "" : "unavailable"}>
                    {display(value)}
                    {value && (
                      <CopyButton
                        value={value}
                        label={`Copy ${label.toLowerCase()}`}
                        notify={notify}
                      />
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </Panel>
          <div className="middle-column">
            <Panel
              title="IP SECURITY SCORE"
              icon={ShieldCheck}
              tag={
                <button
                  className="icon-button"
                  aria-label="View scoring methodology"
                  onClick={() => setModal("Scoring methodology")}
                >
                  <Info size={14} />
                </button>
              }
            >
              <div className="score-body">
                <div
                  className={`score-ring risk-${risk?.level?.toLowerCase() || "unknown"}`}
                >
                  <svg viewBox="0 0 180 180" aria-hidden="true">
                    <circle className="score-track" cx="90" cy="90" r="74" />
                    <circle className="score-ticks" cx="90" cy="90" r="83" />
                    <circle
                      className="score-fill"
                      cx="90"
                      cy="90"
                      r="74"
                      strokeDasharray={`${(risk?.score || 0) * 4.65} 465`}
                    />
                  </svg>
                  <div className="score-value">
                    <ShieldCheck size={19} />
                    <strong>
                      <Counter value={risk?.score} />
                      <small>/100</small>
                    </strong>
                    <span>
                      {risk?.score == null
                        ? "INSUFFICIENT DATA"
                        : `${risk.level} RISK`}
                    </span>
                  </div>
                </div>
                <p>
                  {demo
                    ? "Illustrative assessment · sample signals"
                    : risk?.score == null
                      ? "Five explicit security signals are required."
                      : "Calculated from available provider signals"}
                </p>
                <div className="risk-scale">
                  {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((level) => (
                    <span
                      key={level}
                      className={risk?.level === level ? "selected" : ""}
                    >
                      {level}
                    </span>
                  ))}
                </div>
                <button
                  className="text-button"
                  onClick={() => setModal("Scoring methodology")}
                >
                  How is this calculated?
                  <ArrowUpRight size={12} />
                </button>
              </div>
            </Panel>
            <Panel
              title="ANALYSIS TIMELINE"
              icon={Activity}
              tag={<span className="tag">UTC</span>}
            >
              <ol className="timeline" aria-live="polite">
                {timeline.map((item, i) => (
                  <li key={`${item.time}-${i}`} className={item.kind}>
                    <span className="timeline-dot" />
                    <time>{utc(item.time)}</time>
                    <span>{item.message}</span>
                  </li>
                ))}
              </ol>
              <div className="timeline-footer">
                <CheckCircle2 size={13} />
                {loading
                  ? "Analysis in progress"
                  : data
                    ? "Analysis complete"
                    : "Analysis awaiting a valid request"}
              </div>
            </Panel>
          </div>
          <Panel
            id="threats"
            title="THREAT INTELLIGENCE"
            icon={ShieldCheck}
            tag={
              <span className="tag">
                {demo ? "SAMPLE" : "PROVIDER SIGNALS"}
              </span>
            }
          >
            <div className="threat-summary">
              <span className="threat-shield">
                <ShieldCheck size={28} />
              </span>
              <div>
                <strong>
                  {data?.threat?.is_threat === true
                    ? "Threat reported"
                    : data?.threat?.is_threat === false
                      ? "No known threat reported"
                      : "Threat status unavailable"}
                </strong>
                <p>
                  {demo
                    ? "Sample provider response"
                    : "A negative result does not guarantee safety."}
                </p>
              </div>
            </div>
            <div className="threat-list">
              {threats.map(([label, key]) => (
                <div key={key}>
                  <span>{label}</span>
                  <Signal value={data?.threat?.[key]} />
                </div>
              ))}
            </div>
            <div className="signal-note">
              <Info size={15} />
              <p>
                Intelligence reflects the IP’s reputation, not the security of
                your device. Unavailable signals are never assumed safe.
              </p>
            </div>
            <button
              className="text-button threat-method"
              onClick={() => setModal("Scoring methodology")}
            >
              View risk factors
              <ArrowUpRight size={13} />
            </button>
          </Panel>
        </div>
        <div className="lower-grid">
          <div ref={geoRef}>
            <Panel
              id="geolocation"
              title="APPROXIMATE GEOLOCATION"
              icon={MapPin}
              tag={
                <span className="tag">
                  {demo ? "SAMPLE LOCATION" : "IP-BASED"}
                </span>
              }
            >
              {hasCoords ? (
                <>
                  <div className="geo-map">
                    {mapLoaded ? (
                      <Suspense
                        fallback={
                          <div className="map-placeholder">
                            Loading geographic tiles…
                          </div>
                        }
                      >
                        <GeoMap data={data} />
                      </Suspense>
                    ) : (
                      <div className="map-placeholder">
                        Map loads when visible
                      </div>
                    )}
                  </div>
                  <div className="geo-details">
                    {[
                      ["Country", data.country],
                      [
                        "Region / City",
                        [data.region, data.city].filter(Boolean).join(" / "),
                      ],
                      ["Latitude", data.latitude.toFixed(4)],
                      ["Longitude", data.longitude.toFixed(4)],
                      ["Timezone", data.timezone],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <small>{label}</small>
                        <strong>{display(value)}</strong>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="map-placeholder">
                  <MapPin size={28} />
                  Location coordinates unavailable
                </div>
              )}
              <p className="geo-disclaimer">
                <Info size={14} />
                {disclaimer}
              </p>
            </Panel>
          </div>
          <Panel id="network" title="NETWORK INTELLIGENCE" icon={Network}>
            <div className="network-heading">
              <span className="overview-icon">
                <Network size={25} />
              </span>
              <div>
                <strong>{display(data?.asnOrganization)}</strong>
                <p>
                  {display(data?.asn)}
                  <span> / </span>
                  {display(data?.connectionType)}
                </p>
              </div>
            </div>
            <div className="network-grid">
              {[
                ["ISP", data?.isp],
                ["Organization", data?.organization],
                ["ASN name", data?.asnOrganization],
                ["Network / CIDR", data?.network],
                ["Connection type", data?.connectionType],
              ].map(([label, value]) => (
                <div key={label}>
                  <small>{label}</small>
                  <strong>{display(value)}</strong>
                </div>
              ))}
            </div>
            <div className="network-signals">
              {[
                ["Hosting", "is_hosting"],
                ["Datacenter", "is_datacenter"],
                ["VPN", "is_vpn"],
                ["Proxy", "is_proxy"],
                ["Tor", "is_tor"],
              ].map(([label, key]) => (
                <div key={key}>
                  <span>{label}</span>
                  <Signal value={data?.threat?.[key]} />
                </div>
              ))}
            </div>
          </Panel>
        </div>
        <div className="privacy-strip">
          <ShieldCheck size={20} />
          <div>
            <strong>Intelligence with boundaries.</strong>
            <p>
              Public IP data only. No GPS, device access, port scanning, or
              private network discovery.
            </p>
          </div>
          <button className="text-button" onClick={() => setModal("Privacy")}>
            Our privacy approach
            <ArrowRight size={14} />
          </button>
        </div>
        <div className="print-only">
          <h2>IP INTELLIGENCE REPORT</h2>
          <p>
            {demo
              ? "DEMO DATA — NOT REAL-TIME THREAT INTELLIGENCE"
              : "Live provider data"}
          </p>
          <p>Analysis timestamp: {data?.analyzedAt}</p>
          <p>{risk?.explanation}</p>
        </div>
      </main>
      <footer>
        <div>
          <a href="#dashboard" className="footer-brand">
            <ShieldCheck size={17} />
            CYBERTRACE
          </a>
          <p>IP Security & Intelligence Platform</p>
        </div>
        <div className="footer-links">
          {["Privacy", "Terms", "API Status", "Documentation"].map((label) => (
            <button
              key={label}
              onClick={async () => {
                setModal(label);
                if (label === "API Status") {
                  try {
                    setHealth(await api("/api/health"));
                  } catch {
                    setHealth({
                      status: "unavailable",
                      providerStatus: "unknown",
                    });
                  }
                }
              }}
            >
              {label}
              {label === "Documentation" && <ArrowUpRight size={12} />}
            </button>
          ))}
        </div>
        <div className="footer-right">
          <span>
            <span
              className={`dot ${health?.status === "online" ? "" : "muted"}`}
            />
            {health?.status === "online"
              ? "API operational"
              : "API status unknown"}
            <span className="version">v1.0.0</span>
          </span>
          <small>
            IP geolocation is approximate, not an exact physical location.
          </small>
        </div>
      </footer>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={16} />
          {toast}
        </div>
      )}
      {modal && (
        <Modal title={modal} onClose={() => setModal(null)}>
          {modal === "Scoring methodology" ? (
            <>
              <p>
                {risk?.explanation ||
                  "All five security signals must be supplied as explicit booleans before a score is calculated."}
              </p>
              <h3>Risk factors</h3>
              {risk?.riskFactors.length ? (
                <ul>
                  {risk.riskFactors.map((f) => (
                    <li key={f.key}>
                      {f.label}: −{f.weight} points
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No risk factors available or reported.</p>
              )}
              <h3>Protective factors</h3>
              <p>
                Explicit negative reports retain baseline points. They are not
                proof that an address is safe.
              </p>
              <ul>
                {risk?.protectiveFactors.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <div className="formula">
                100 baseline −{" "}
                {risk?.riskFactors.reduce((n, f) => n + f.weight, 0) || 0} risk
                deductions = {risk?.score ?? "INSUFFICIENT DATA"}
              </div>
              <p>
                Thresholds: 85–100 LOW · 60–84 MEDIUM · 30–59 HIGH · 0–29
                CRITICAL. Missing any required signal: UNKNOWN.
              </p>
              {demo && (
                <p className="amber-text">
                  This score uses fictional demonstration signals.
                </p>
              )}
            </>
          ) : modal === "API Status" ? (
            <>
              <p>
                Backend: <strong>{health?.status || "Unknown"}</strong>
              </p>
              <p>
                Mode: <strong>{health?.mode || "Unknown"}</strong>
              </p>
              <p>
                Provider: ipdata ·{" "}
                <strong>{health?.providerStatus || "Not checked"}</strong>
              </p>
              <p>
                Health reports the last provider request outcome; it does not
                continuously poll the provider.
              </p>
              <a href="/api/health" target="_blank" rel="noreferrer">
                Open health endpoint <ExternalLink size={12} />
              </a>
            </>
          ) : modal === "Provider configuration" ||
            modal === "Documentation" ? (
            <>
              <p>
                Configure your server’s <code>.env</code> with{" "}
                <code>IP_API_KEY</code> and{" "}
                <code>IP_API_URL=https://api.ipdata.co/</code>, then restart the
                server. No key means isolated demo mode.
              </p>
              <p>
                For visitor detection behind a reverse proxy, set{" "}
                <code>TRUSTED_PROXY_CIDRS</code> to the actual proxy addresses.
                Localhost cannot identify a visitor’s public address; use a
                public IP search in live mode.
              </p>
              <p>
                Endpoints: <code>/api/my-ip</code>,{" "}
                <code>/api/ip-intelligence?ip=</code>,{" "}
                <code>/api/geolocation?ip=</code>,{" "}
                <code>/api/threat-intelligence?ip=</code>,{" "}
                <code>/api/health</code>.
              </p>
              <p>
                The project README includes installation, deployment, tests,
                caching, and scoring documentation.
              </p>
              <a
                href="https://docs.ipdata.co/docs"
                target="_blank"
                rel="noreferrer"
              >
                ipdata documentation <ExternalLink size={12} />
              </a>
            </>
          ) : modal === "Privacy" ? (
            <>
              <p>
                Live lookups send the requested public IP address to ipdata
                through this server. Results remain in a bounded memory cache
                for five minutes by default. This application does not persist
                search history or use analytics.
              </p>
              <p>
                The map requests tiles from OpenStreetMap (or the configured
                tile provider), which receives your browser IP and the viewed
                map area. Deployment proxies and external providers may keep
                their own logs.
              </p>
              <p>
                Demo mode does not detect or enrich your public IP; all
                displayed intelligence belongs to a fictional sample.
              </p>
              <p>{disclaimer}</p>
              <p>
                No GPS, camera, microphone, files, browsing history, LAN
                discovery, or scanning is accessed.
              </p>
            </>
          ) : modal === "Terms" ? (
            <>
              <p>
                CYBERTRACE provides informational IP intelligence. Provider
                coverage, freshness, and accuracy vary. Do not use this score
                alone to make access, identity, safety, or enforcement
                decisions.
              </p>
              <p>
                VPN, proxy, Tor, hosting, and shared network use do not
                establish malicious intent. A low risk score is not a security
                guarantee.
              </p>
              <p>{disclaimer}</p>
            </>
          ) : (
            <>
              <p>
                CYBERTRACE is an IP Security & Intelligence Platform for
                understanding public network identifiers, approximate
                geolocation, and available reputation signals.
              </p>
              <p>
                Every signal has an explicit source or an unavailable state. The
                global network animation is always a demo visualization.
              </p>
              <p>React · Express · ipdata · OpenStreetMap</p>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
