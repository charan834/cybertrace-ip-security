import { useState, useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
export default function GeoMap({ data }) {
  const [failed, setFailed] = useState(false),
    [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (loaded) return;
    const timeout = setTimeout(() => setFailed(true), 10000);
    return () => clearTimeout(timeout);
  }, [loaded]);
  return (
    <div className="leaflet-wrap">
      <MapContainer
        key={`${data.latitude},${data.longitude}`}
        center={[data.latitude, data.longitude]}
        zoom={8}
        scrollWheelZoom={false}
        aria-label="Approximate IP geolocation map"
      >
        <TileLayer
          url={
            import.meta.env.VITE_MAP_TILE_URL ||
            "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          }
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          eventHandlers={{
            tileerror: () => setFailed(true),
            tileload: () => {
              setFailed(false);
              setLoaded(true);
            },
          }}
        />
        <CircleMarker
          center={[data.latitude, data.longitude]}
          radius={12}
          pathOptions={{
            color: "#1caa91",
            fillColor: "#52e0c4",
            fillOpacity: 0.3,
          }}
        >
          <Tooltip permanent direction="top">
            {data.mode === "demo"
              ? "Sample location"
              : "Approximate IP location"}{" "}
            · {data.city || data.country || "Location"}
          </Tooltip>
        </CircleMarker>
      </MapContainer>
      {!loaded && !failed && (
        <div className="map-loading" role="status">
          Loading geographic tiles…
        </div>
      )}
      {failed && (
        <div className="map-error" role="status">
          Map tiles unavailable. Approximate coordinates are shown below.
        </div>
      )}
    </div>
  );
}
