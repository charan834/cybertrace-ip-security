import { useId } from "react";
import { geoNaturalEarth1, geoPath, geoGraticule10 } from "d3-geo";
import { feature } from "topojson-client";
import world from "world-atlas/countries-110m.json";
const land = feature(world, world.objects.countries);
const projection = geoNaturalEarth1().scale(145).translate([440, 240]);
const path = geoPath(projection);
const cities = [
  [-122.42, 37.77],
  [-74, 40.7],
  [-0.12, 51.5],
  [13.4, 52.5],
  [55.27, 25.2],
  [103.8, 1.35],
  [139.7, 35.7],
  [151.2, -33.9],
  [-46.6, -23.5],
];
const names = [
  "SAN FRANCISCO",
  "NEW YORK",
  "LONDON",
  "BERLIN",
  "DUBAI",
  "SINGAPORE",
  "TOKYO",
  "SYDNEY",
  "SÃO PAULO",
];
export default function WorldMap({ animated = true, location }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      className="world-map"
      viewBox="0 0 880 440"
      role="img"
      aria-label="World map with illustrative network connections. Demo visualization, not live threat activity."
    >
      <defs>
        <pattern id={id} width="5" height="5" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r=".85" fill="#42606a" />
        </pattern>
        <radialGradient id={`${id}-glow`}>
          <stop stopColor="#4ce2c1" stopOpacity=".15" />
          <stop offset="1" stopColor="#4ce2c1" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="430" cy="210" rx="350" ry="190" fill={`url(#${id}-glow)`} />
      <path
        d={path(geoGraticule10())}
        fill="none"
        stroke="#23323a"
        strokeWidth=".4"
        opacity=".6"
      />
      <g fill={`url(#${id})`} stroke="#314650" strokeWidth=".35">
        {land.features
          .filter((f) => f.id !== "010")
          .map((f) => (
            <path key={f.id} d={path(f)} />
          ))}
      </g>
      {cities.slice(1).map((city, i) => {
        const a = projection(cities[i % 3]),
          b = projection(city);
        const d = `M${a} Q${(a[0] + b[0]) / 2},${Math.min(a[1], b[1]) - 50 - i * 4} ${b}`;
        return (
          <g key={names[i + 1]}>
            <path
              d={d}
              fill="none"
              stroke={i === 2 ? "#d6a964" : "#4ad7bd"}
              strokeWidth=".8"
              opacity=".32"
            />
            {animated && (
              <circle r="2" fill="#80f9df">
                <animateMotion
                  dur={`${4 + i}s`}
                  repeatCount="indefinite"
                  path={d}
                />
              </circle>
            )}
          </g>
        );
      })}
      {cities.map((city, i) => {
        const [x, y] = projection(city);
        return (
          <g key={names[i]} transform={`translate(${x},${y})`}>
            <circle
              className={animated ? "node-pulse" : ""}
              r="9"
              fill="#4bd6b6"
              opacity=".08"
              style={{ animationDelay: `${i * 0.4}s` }}
            />
            <circle r="3" fill={i === 4 ? "#d6a964" : "#63e0c4"} />
            <circle r="6" fill="none" stroke="#63e0c4" strokeOpacity=".35" />
            {[0, 2, 5, 6].includes(i) && (
              <text
                y={i === 2 ? -13 : 20}
                textAnchor="middle"
                fill="#89a2aa"
                fontSize="8"
                letterSpacing="1"
              >
                {names[i]}
              </text>
            )}
          </g>
        );
      })}
      {location && (
        <g
          transform={`translate(${projection([location.longitude, location.latitude])})`}
        >
          <circle r="14" fill="none" stroke="#f0d491" strokeDasharray="3 3" />
          <circle r="4" fill="#f0d491" />
          <text y="-20" textAnchor="middle" fill="#f0d491" fontSize="9">
            APPROXIMATE LOCATION
          </text>
        </g>
      )}
    </svg>
  );
}
