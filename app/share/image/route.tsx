import { ImageResponse } from "next/og";

export const runtime = "edge";

const size = {
  width: 1200,
  height: 630,
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const title = getParam(url, "title", "Passport Quest");
  const track = getParam(url, "track", "Blackbird route");
  const stopCount = getParam(url, "stops", "3");
  const windowLabel = getParam(url, "window", "Tonight");
  const route = getParam(url, "route", "Ordered restaurant route");
  const reward = getParam(url, "reward", "FLY reward preview");
  const state = getParam(url, "state", "preview");
  const names = getListParam(url, "names");
  const stops =
    names.length > 0
      ? names.slice(0, 7)
      : ["First stop", "Second stop", "Final stop"];
  const markUrl = new URL("/blackbird-mark.svg", request.url).toString();

  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "stretch",
          background: "#0b0b0b",
          color: "#fcfcfc",
          display: "flex",
          fontFamily:
            'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          height: "100%",
          overflow: "hidden",
          padding: 48,
          position: "relative",
          width: "100%",
        }}
      >
        <div
          style={{
            background:
              "radial-gradient(circle at 16% 16%, rgba(117,91,255,0.54), transparent 34%), radial-gradient(circle at 88% 12%, rgba(255,240,102,0.22), transparent 26%), linear-gradient(135deg, #0b0b0b 0%, #141414 56%, #1b1b1b 100%)",
            display: "flex",
            inset: 0,
            opacity: 1,
            position: "absolute",
          }}
        />
        <div
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
            display: "flex",
            inset: 0,
            opacity: 0.36,
            position: "absolute",
          }}
        />
        <div
          style={{
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 38,
            display: "flex",
            flex: 1,
            overflow: "hidden",
            position: "relative",
          }}
        >
          <section
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              padding: 46,
              width: 670,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  alignItems: "center",
                  display: "flex",
                  gap: 18,
                }}
              >
                <div
                  style={{
                    alignItems: "center",
                    background: "#070707",
                    border: "1px solid rgba(255,255,255,0.18)",
                    borderRadius: 22,
                    display: "flex",
                    height: 82,
                    justifyContent: "center",
                    width: 96,
                  }}
                >
                  <img
                    alt="Blackbird"
                    height="50"
                    src={markUrl}
                    style={{ objectFit: "contain" }}
                    width="64"
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div
                    style={{
                      color: "#fff066",
                      fontSize: 24,
                      fontWeight: 900,
                      letterSpacing: 0,
                      lineHeight: 1,
                    }}
                  >
                    Passport Quest
                  </div>
                  <div
                    style={{
                      color: "#ababab",
                      fontSize: 22,
                      fontWeight: 700,
                      marginTop: 8,
                    }}
                  >
                    Blackbird route pass
                  </div>
                </div>
              </div>

              <div
                style={{
                  alignItems: "center",
                  display: "flex",
                  gap: 12,
                  marginTop: 42,
                }}
              >
                <Pill label={track} tone="purple" />
                <Pill label={`${stopCount} stops`} tone="dark" />
                <Pill
                  label={state === "unlocked" ? "Reward unlocked" : "Reward preview"}
                  tone={state === "unlocked" ? "green" : "yellow"}
                />
              </div>

              <h1
                style={{
                  color: "#fcfcfc",
                  fontSize: title.length > 44 ? 62 : 76,
                  fontWeight: 950,
                  letterSpacing: 0,
                  lineHeight: 0.93,
                  margin: "34px 0 0",
                  maxWidth: 570,
                }}
              >
                {title}
              </h1>

              <p
                style={{
                  color: "#c8bfff",
                  fontSize: 30,
                  fontWeight: 800,
                  lineHeight: 1.22,
                  margin: "28px 0 0",
                  maxWidth: 560,
                }}
              >
                {windowLabel}. {route}.
              </p>
            </div>

            <div
              style={{
                alignItems: "center",
                display: "flex",
                gap: 18,
              }}
            >
              <div
                style={{
                  background: "#fff066",
                  borderRadius: 999,
                  color: "#0b0b0b",
                  fontSize: 24,
                  fontWeight: 950,
                  padding: "16px 22px",
                  whiteSpace: "nowrap",
                }}
              >
                {reward}
              </div>
              <div
                style={{
                  color: "#ababab",
                  fontSize: 22,
                  fontWeight: 700,
                }}
              >
                Share the route, then open Maps.
              </div>
            </div>
          </section>

          <section
            style={{
              background: "rgba(7,7,7,0.72)",
              borderLeft: "1px solid rgba(255,255,255,0.12)",
              display: "flex",
              flex: 1,
              padding: 34,
            }}
          >
            <div
              style={{
                background: "#141414",
                border: "1px solid rgba(255,255,255,0.14)",
                borderRadius: 32,
                display: "flex",
                flex: 1,
                flexDirection: "column",
                padding: 28,
              }}
            >
              <div
                style={{
                  alignItems: "center",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div
                    style={{
                      color: "#c8bfff",
                      fontSize: 20,
                      fontWeight: 900,
                    }}
                  >
                    Route order
                  </div>
                  <div
                    style={{
                      color: "#fcfcfc",
                      fontSize: 34,
                      fontWeight: 950,
                      marginTop: 4,
                    }}
                  >
                    Route pass
                  </div>
                </div>
                <div
                  style={{
                    alignItems: "center",
                    border: "1px solid rgba(255,240,102,0.48)",
                    borderRadius: 999,
                    color: "#fff066",
                    display: "flex",
                    fontSize: 20,
                    fontWeight: 900,
                    height: 44,
                    padding: "0 16px",
                  }}
                >
                  Mapped
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                  marginTop: 30,
                }}
              >
                {stops.map((stop, index) => (
                  <div
                    key={`${stop}-${index}`}
                    style={{
                      alignItems: "center",
                      background: index === 0 ? "#222222" : "#1b1b1b",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 22,
                      display: "flex",
                      gap: 16,
                      minHeight: 70,
                      padding: "12px 16px",
                    }}
                  >
                    <div
                      style={{
                        alignItems: "center",
                        background: index === 0 ? "#fff066" : "#755bff",
                        borderRadius: 999,
                        color: index === 0 ? "#0b0b0b" : "#fcfcfc",
                        display: "flex",
                        flexShrink: 0,
                        fontSize: 22,
                        fontWeight: 950,
                        height: 44,
                        justifyContent: "center",
                        width: 44,
                      }}
                    >
                      {index + 1}
                    </div>
                    <div
                      style={{
                        color: "#fcfcfc",
                        display: "flex",
                        flex: 1,
                        fontSize: 27,
                        fontWeight: 900,
                        lineHeight: 1.04,
                      }}
                    >
                      {stop}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    ),
    size,
  );
}

function Pill({
  label,
  tone,
}: {
  label: string;
  tone: "dark" | "green" | "purple" | "yellow";
}) {
  const styles =
    tone === "purple"
      ? { background: "rgba(117,91,255,0.22)", color: "#c8bfff" }
      : tone === "green"
        ? { background: "rgba(44,225,152,0.16)", color: "#2ce198" }
        : tone === "yellow"
          ? { background: "rgba(255,240,102,0.14)", color: "#fff066" }
          : { background: "rgba(255,255,255,0.08)", color: "#fcfcfc" };

  return (
    <div
      style={{
        alignItems: "center",
        border: "1px solid rgba(255,255,255,0.14)",
        borderRadius: 999,
        display: "flex",
        fontSize: 22,
        fontWeight: 900,
        height: 44,
        padding: "0 18px",
        ...styles,
      }}
    >
      {label}
    </div>
  );
}

function getParam(url: URL, key: string, fallback: string): string {
  const value = url.searchParams.get(key)?.replace(/\s+/g, " ").trim();
  return value ? value.slice(0, 110) : fallback;
}

function getListParam(url: URL, key: string): string[] {
  return (url.searchParams.get(key) ?? "")
    .split("|")
    .map((value) => value.replace(/\s+/g, " ").trim().slice(0, 34))
    .filter(Boolean);
}
