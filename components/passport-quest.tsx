"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Map as LeafletMap } from "leaflet";
import type { Quest, QuestStop } from "../lib/quest";
import { LoginButton } from "./login-button";
import { RewardsPanel } from "./rewards-panel";
import { Tag } from "./tag";

type QuestLength = 3 | 4 | 5 | 6 | 7;
type ChallengeTrackId = "classic" | "roulette" | "crawl";
type ProfileMode = "member" | "guest";
type GuestProfileStatus = "draft" | "created";

type GuestProfile = {
  name: string;
  preferences: string[];
};

type Coordinate = NonNullable<QuestStop["coordinate"]>;

type RoutePoint = {
  kind: "start" | "stop";
  name: string;
  label: string;
  coordinate: Coordinate;
};

type ShareQuestStop = {
  order: number;
  name: string;
  cuisines: string;
  locationLabel: string;
  addressLine: string;
  legLabel: string;
};

type ShareQuestSnapshot = {
  challengeId: string;
  trackLabel: string;
  profileName: string;
  stopCount: number;
  windowLabel: string;
  cadenceLabel: string;
  routeDistanceLabel: string;
  routeTimeLabel: string;
  rewardFly: number;
  completed: boolean;
  directionsUrl: string | null;
  stops: ShareQuestStop[];
};

type ChallengeTrack = {
  id: ChallengeTrackId;
  label: string;
  persona: string;
  description: string;
  stopOptions: QuestLength[];
  defaultStops: QuestLength;
  reward: string;
  baseFlyReward: number;
  icon: "compass" | "dice" | "glass";
};

type QuestWindowPreset = {
  minutes: number;
  label: string;
  detail: string;
};

type StartPointPreset = {
  id: string;
  label: string;
  detail: string;
  coordinate: Coordinate;
};

const DEFAULT_GUEST_PROFILE: GuestProfile = {
  name: "Guest explorer",
  preferences: ["Italian", "Cocktails", "Dessert"],
};

const DEFAULT_MEMBER_TASTE_PROFILE: GuestProfile = {
  name: "Blackbird member",
  preferences: [
    "Japanese",
    "Korean",
    "Thai",
    "Chinese",
    "Filipino",
    "Sushi",
    "Ramen",
  ],
};

const GUEST_PROFILE_STORAGE_KEY = "passport-quest:guest-profile:v1";
const MEMBER_TASTE_PROFILE_STORAGE_KEY = "passport-quest:member-taste-profile:v1";
const MIN_CUSTOM_WINDOW_MINUTES = 30;
const MAX_CUSTOM_WINDOW_MINUTES = 7 * 24 * 60;

const QUEST_WINDOW_PRESETS: QuestWindowPreset[] = [
  { minutes: 120, label: "2h", detail: "Quick" },
  { minutes: 180, label: "3h", detail: "Evening" },
  { minutes: 300, label: "5h", detail: "Half day" },
  { minutes: 24 * 60, label: "1 day", detail: "Day pass" },
  { minutes: 7 * 24 * 60, label: "1 week", detail: "Passport" },
];

const START_POINT_PRESETS: StartPointPreset[] = [
  {
    id: "soho",
    label: "SoHo",
    detail: "Downtown",
    coordinate: { latitude: 40.7243, longitude: -74.0018 },
  },
  {
    id: "union-square",
    label: "Union Sq",
    detail: "Central",
    coordinate: { latitude: 40.7359, longitude: -73.9911 },
  },
  {
    id: "east-village",
    label: "East Village",
    detail: "Night out",
    coordinate: { latitude: 40.7265, longitude: -73.9815 },
  },
  {
    id: "williamsburg",
    label: "Williamsburg",
    detail: "Brooklyn",
    coordinate: { latitude: 40.7143, longitude: -73.9614 },
  },
  {
    id: "midtown",
    label: "Midtown",
    detail: "Hotel",
    coordinate: { latitude: 40.7549, longitude: -73.984 },
  },
];

const PREFERENCE_OPTIONS = [
  "Japanese",
  "Korean",
  "Thai",
  "Chinese",
  "Filipino",
  "Indian",
  "Italian",
  "Mexican",
  "Seafood",
  "Sushi",
  "Ramen",
  "Pizza",
  "Bar",
  "Cocktails",
  "Wine Bar",
  "Dessert",
  "Bakery",
  "Coffee",
  "Vegetarian",
  "Date Night",
];

const NIGHTLIFE_TERMS = [
  "bar",
  "cocktail",
  "wine",
  "beer",
  "sake",
  "pub",
  "lounge",
  "night",
  "tavern",
  "izakaya",
];

const CHALLENGE_TRACKS: ChallengeTrack[] = [
  {
    id: "classic",
    label: "Classic Quest",
    persona: "Planner",
    description: "Flexible passport cadence, from one night to one week.",
    stopOptions: [3, 4, 5, 6, 7],
    defaultStops: 5,
    reward: "Simulated 50 FLY unlock after the final check-in",
    baseFlyReward: 50,
    icon: "compass",
  },
  {
    id: "roulette",
    label: "Roulette Run",
    persona: "Spontaneous",
    description: "A surprise route seeded from your profile and the crowd.",
    stopOptions: [3, 4, 5, 6, 7],
    defaultStops: 5,
    reward: "Simulated mystery bonus after every stop is checked in",
    baseFlyReward: 75,
    icon: "dice",
  },
  {
    id: "crawl",
    label: "Bar Crawl",
    persona: "Group",
    description: "Social stops, drinks-friendly picks, easy walking route.",
    stopOptions: [4, 5, 6, 7],
    defaultStops: 5,
    reward: "Simulated group passport stamp after the last stop",
    baseFlyReward: 60,
    icon: "glass",
  },
];

export function PassportQuest({
  quest,
  signedIn,
}: {
  quest: Quest;
  signedIn: boolean;
}) {
  const [profileMode, setProfileMode] = useState<ProfileMode>(
    signedIn ? "member" : "guest",
  );
  const [guestProfile, setGuestProfile] =
    useState<GuestProfile>(DEFAULT_GUEST_PROFILE);
  const [guestProfileStatus, setGuestProfileStatus] =
    useState<GuestProfileStatus>("draft");
  const [memberTasteProfile, setMemberTasteProfile] =
    useState<GuestProfile>(DEFAULT_MEMBER_TASTE_PROFILE);
  const [memberTasteProfileStatus, setMemberTasteProfileStatus] =
    useState<GuestProfileStatus>("draft");
  const [trackId, setTrackId] = useState<ChallengeTrackId>("classic");
  const [questLength, setQuestLength] = useState<QuestLength>(5);
  const [durationMinutes, setDurationMinutes] = useState(180);
  const [generation, setGeneration] = useState(0);
  const [challengeVersion, setChallengeVersion] = useState(1);
  const [manualStartPoint, setManualStartPoint] = useState<RoutePoint | null>(
    null,
  );
  const [isPickingStartPoint, setIsPickingStartPoint] = useState(false);
  const [checkedStopKeys, setCheckedStopKeys] = useState<string[]>([]);

  const activeTrack =
    CHALLENGE_TRACKS.find((track) => track.id === trackId) ??
    CHALLENGE_TRACKS[0];
  const usingMemberProfile = signedIn && profileMode === "member";
  const activePreferences = usingMemberProfile
    ? memberTasteProfile.preferences
    : guestProfile.preferences;
  const activeProfileName = usingMemberProfile
    ? memberTasteProfileStatus === "created"
      ? "Blackbird taste profile"
      : "Blackbird member"
    : guestProfile.name;
  const startCoordinate = manualStartPoint?.coordinate ?? null;

  useEffect(() => {
    if (!signedIn && profileMode === "member") setProfileMode("guest");
  }, [profileMode, signedIn]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(GUEST_PROFILE_STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored) as Partial<GuestProfile> & {
        status?: GuestProfileStatus;
      };
      if (!parsed.name || !Array.isArray(parsed.preferences)) return;
      setGuestProfile({
        name: parsed.name,
        preferences: parsed.preferences.filter(
          (preference): preference is string => typeof preference === "string",
        ),
      });
      setGuestProfileStatus(parsed.status === "created" ? "created" : "draft");
    } catch {
      window.localStorage.removeItem(GUEST_PROFILE_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      GUEST_PROFILE_STORAGE_KEY,
      JSON.stringify({ ...guestProfile, status: guestProfileStatus }),
    );
  }, [guestProfile, guestProfileStatus]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(MEMBER_TASTE_PROFILE_STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored) as Partial<GuestProfile> & {
        status?: GuestProfileStatus;
      };
      if (!parsed.name || !Array.isArray(parsed.preferences)) return;
      setMemberTasteProfile({
        name: parsed.name,
        preferences: parsed.preferences.filter(
          (preference): preference is string => typeof preference === "string",
        ),
      });
      setMemberTasteProfileStatus(
        parsed.status === "created" ? "created" : "draft",
      );
    } catch {
      window.localStorage.removeItem(MEMBER_TASTE_PROFILE_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      MEMBER_TASTE_PROFILE_STORAGE_KEY,
      JSON.stringify({
        ...memberTasteProfile,
        status: memberTasteProfileStatus,
      }),
    );
  }, [memberTasteProfile, memberTasteProfileStatus]);

  useEffect(() => {
    if (!activeTrack.stopOptions.includes(questLength)) {
      setQuestLength(activeTrack.defaultStops);
    }
  }, [activeTrack, questLength]);

  const selectedStops = useMemo(
    () =>
      selectStops({
        stops: quest.stops,
        track: activeTrack,
        count: questLength,
        durationMinutes,
        generation,
        preferences: activePreferences,
        startCoordinate,
      }).map((stop, index) => ({ ...stop, order: index + 1 })),
    [
      activePreferences,
      activeTrack,
      durationMinutes,
      generation,
      quest.stops,
      questLength,
      startCoordinate,
    ],
  );
  const metrics = useMemo(
    () => buildRouteMetrics(selectedStops, manualStartPoint),
    [manualStartPoint, selectedStops],
  );
  const directionsUrl = buildDirectionsUrl(selectedStops, metrics.startPoint);
  const selectedStopSignature = selectedStops.map(stopKey).join("|");
  const checkedCount = selectedStops.filter((stop) =>
    checkedStopKeys.includes(stopKey(stop)),
  ).length;
  const completed = selectedStops.length > 0 && checkedCount === selectedStops.length;
  const cadenceLabel = buildCadenceLabel(selectedStops.length, durationMinutes);
  const rewardFly = buildRewardFly(
    activeTrack,
    selectedStops.length,
    durationMinutes,
  );
  const mockChallengeId = buildMockChallengeId(
    activeTrack.id,
    selectedStops.length,
    durationMinutes,
    challengeVersion,
  );
  const shareSnapshot = useMemo(
    () =>
      buildShareSnapshot({
        challengeId: mockChallengeId,
        track: activeTrack,
        profileName: activeProfileName,
        stops: selectedStops,
        metrics,
        durationMinutes,
        cadenceLabel,
        rewardFly,
        completed,
        directionsUrl,
      }),
    [
      activeProfileName,
      activeTrack,
      cadenceLabel,
      completed,
      directionsUrl,
      durationMinutes,
      metrics,
      mockChallengeId,
      rewardFly,
      selectedStops,
    ],
  );

  useEffect(() => {
    setCheckedStopKeys([]);
  }, [selectedStopSignature]);

  function togglePreference(preference: string) {
    setGuestProfile((current) => {
      const exists = current.preferences.includes(preference);
      return {
        ...current,
        preferences: exists
          ? current.preferences.filter((item) => item !== preference)
          : [...current.preferences, preference],
      };
    });
    setGuestProfileStatus("draft");
  }

  function toggleMemberPreference(preference: string) {
    setMemberTasteProfile((current) => {
      const exists = current.preferences.includes(preference);
      return {
        ...current,
        preferences: exists
          ? current.preferences.filter((item) => item !== preference)
          : [...current.preferences, preference],
      };
    });
  }

  function generateQuest() {
    setGeneration((current) => current + 1);
    setChallengeVersion((current) => current + 1);
    setCheckedStopKeys([]);
  }

  function selectTrack(nextTrackId: ChallengeTrackId) {
    const nextTrack =
      CHALLENGE_TRACKS.find((track) => track.id === nextTrackId) ??
      CHALLENGE_TRACKS[0];
    setTrackId(nextTrackId);
    if (!nextTrack.stopOptions.includes(questLength)) {
      setQuestLength(nextTrack.defaultStops);
    }
  }

  function regenerateTrack(nextTrackId: ChallengeTrackId) {
    selectTrack(nextTrackId);
    setGeneration((current) => current + 1);
    setChallengeVersion((current) => current + 1);
    setCheckedStopKeys([]);
  }

  function selectStartPreset(preset: StartPointPreset) {
    setManualStartPoint(startPointFromPreset(preset));
    setIsPickingStartPoint(false);
  }

  function useAutoStartPoint() {
    setManualStartPoint(null);
    setIsPickingStartPoint(false);
  }

  const handleMapStartPointPick = useCallback((coordinate: Coordinate) => {
    setManualStartPoint({
      kind: "start",
      name: "Map start",
      label: "Map start",
      coordinate,
    });
    setIsPickingStartPoint(false);
  }, []);

  function checkInStop(stop: QuestStop) {
    const key = stopKey(stop);
    setCheckedStopKeys((current) =>
      current.includes(key) ? current : [...current, key],
    );
  }

  function completeDemoCheckIns() {
    setCheckedStopKeys(selectedStops.map(stopKey));
  }

  function resetCheckIns() {
    setCheckedStopKeys([]);
  }

  return (
    <section className="space-y-5">
      <div className="grid items-start gap-5 xl:grid-cols-[410px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-white/10 bg-surface-low p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                Passport Quest
              </h1>
              <p className="mt-2 max-w-[36ch] text-sm leading-relaxed text-muted">
                Build a timed restaurant route, check in stop by stop, and
                unlock a safe rewards preview.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-background-darker px-3 py-2 text-right text-xs">
              <p className="text-subtle">Profile</p>
              <p className="mt-0.5 font-semibold text-foreground">
                {usingMemberProfile
                  ? memberTasteProfileStatus === "created"
                    ? "Member taste"
                    : "Connected"
                  : "Guest"}
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-5">
            <ProfileBuilder
              signedIn={signedIn}
              profileMode={profileMode}
              onProfileModeChange={setProfileMode}
              guestProfile={guestProfile}
              guestStatus={guestProfileStatus}
              memberTasteProfile={memberTasteProfile}
              memberTasteStatus={memberTasteProfileStatus}
              onGuestNameChange={(name) => {
                setGuestProfile((current) => ({ ...current, name }));
                setGuestProfileStatus("draft");
              }}
              onTogglePreference={togglePreference}
              onCreateGuestProfile={() => setGuestProfileStatus("created")}
              onToggleMemberPreference={toggleMemberPreference}
              onCreateMemberTasteProfile={() =>
                setMemberTasteProfileStatus("created")
              }
            />

            <ControlGroup label="Challenge track">
              <div className="grid gap-2">
                {CHALLENGE_TRACKS.map((track) => {
                  const selected = trackId === track.id;
                  return (
                    <div
                      key={track.id}
                      className={`flex items-stretch gap-2 rounded-xl border p-2 transition duration-150 ease-standard ${
                        selected
                          ? "border-primary bg-primary/15 text-foreground"
                          : "border-white/10 bg-background-darker text-muted hover:border-white/20 hover:bg-surface"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => selectTrack(track.id)}
                        className="min-w-0 flex-1 rounded-lg px-1 py-1 text-left"
                      >
                        <span className="flex items-start gap-3">
                          <TrackIcon
                            icon={track.icon}
                            className="mt-0.5 h-5 w-5 shrink-0"
                          />
                          <span>
                            <span className="block text-sm font-semibold text-foreground">
                              {track.label}
                            </span>
                            <span className="mt-1 block text-xs leading-relaxed">
                              {track.description}
                            </span>
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => regenerateTrack(track.id)}
                        title={`Regenerate ${track.label}`}
                        aria-label={`Regenerate ${track.label}`}
                        className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border transition ${
                          selected
                            ? "border-primary/40 bg-primary/20 text-primary-bright hover:bg-primary/25"
                            : "border-white/10 bg-white/5 text-muted hover:border-white/20 hover:text-foreground"
                        }`}
                      >
                        <RefreshIcon className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </ControlGroup>

            <ControlGroup label="Stops">
              <div className="grid rounded-xl border border-white/10 bg-background-darker p-1" style={{ gridTemplateColumns: `repeat(${activeTrack.stopOptions.length}, minmax(0, 1fr))` }}>
                {activeTrack.stopOptions.map((length) => (
                  <button
                    key={length}
                    type="button"
                    onClick={() => setQuestLength(length)}
                    className={`h-10 rounded-lg text-sm font-semibold transition duration-150 ease-standard ${
                      questLength === length
                        ? "bg-foreground text-background"
                        : "text-muted hover:bg-surface hover:text-foreground"
                    }`}
                  >
                    {length}
                  </button>
                ))}
              </div>
            </ControlGroup>

            <QuestWindowControl
              durationMinutes={durationMinutes}
              onDurationChange={setDurationMinutes}
            />

            <StartPointControl
              startPoint={manualStartPoint}
              isPicking={isPickingStartPoint}
              onAutoStart={useAutoStartPoint}
              onPickFromMap={() =>
                setIsPickingStartPoint((current) => !current)
              }
              onPresetStart={selectStartPreset}
            />

            <div className="grid grid-cols-2 gap-2">
              <Metric label="Window" value={formatMinutes(durationMinutes)} />
              <Metric label="Cadence" value={cadenceLabel} />
              <Metric label="Distance" value={formatKm(metrics.totalKm)} />
              <Metric
                label="Mapped"
                value={`${metrics.mappedStops}/${selectedStops.length}`}
              />
            </div>

            <CheckInProgress
              checkedCount={checkedCount}
              totalCount={selectedStops.length}
              completed={completed}
              onCompleteAll={completeDemoCheckIns}
              onReset={resetCheckIns}
            />

            <MockChallengeCard
              challengeId={mockChallengeId}
              track={activeTrack}
              stopCount={selectedStops.length}
              windowLabel={formatMinutes(durationMinutes)}
              cadenceLabel={cadenceLabel}
              rewardFly={rewardFly}
              completed={completed}
            />

            <ShareQuestCard snapshot={shareSnapshot} />

            <div className="flex flex-wrap gap-2">
              {activePreferences.length > 0 ? (
                activePreferences.slice(0, 8).map((preference) => (
                  <Tag key={preference} tone="primary">
                    {preference}
                  </Tag>
                ))
              ) : (
                <Tag>Open profile</Tag>
              )}
              <Tag tone="success">{activeTrack.persona}</Tag>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={generateQuest}
                title="Generate a fresh mock challenge with the current settings"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 active:bg-primary-dim"
              >
                <RefreshIcon className="h-4 w-4" />
                Generate challenge
              </button>
              {directionsUrl ? (
                <a
                  href={directionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-strong px-5 text-sm font-semibold text-foreground transition hover:border-primary/60"
                >
                  <RouteIcon className="h-4 w-4" />
                  Open directions
                </a>
              ) : null}
            </div>

            <p className="rounded-xl border border-white/10 bg-background-darker px-3 py-2 text-xs leading-relaxed text-muted">
              {quest.candidateCount} Flynet restaurants scored for{" "}
              {activeProfileName} on {activeTrack.label}.
            </p>
          </div>
        </aside>

        <LiveQuestMap
          stops={selectedStops}
          metrics={metrics}
          checkedStopKeys={checkedStopKeys}
          track={activeTrack}
          cadenceLabel={cadenceLabel}
          isPickingStartPoint={isPickingStartPoint}
          onStartPointPick={handleMapStartPointPick}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Itinerary
          stops={selectedStops}
          metrics={metrics}
          checkedStopKeys={checkedStopKeys}
          onCheckIn={checkInStop}
          preferences={activePreferences}
          track={activeTrack}
          durationMinutes={durationMinutes}
          cadenceLabel={cadenceLabel}
        />
        <RewardsPanel
          completed={completed}
          completedCount={checkedCount}
          totalCount={selectedStops.length}
          questTitle={`${activeTrack.label}, ${selectedStops.length} stops`}
          rewardPreview={activeTrack.reward}
          challengeId={mockChallengeId}
          rewardFly={rewardFly}
          recipientName={activeProfileName}
        />
      </div>
    </section>
  );
}

function ProfileBuilder({
  signedIn,
  profileMode,
  onProfileModeChange,
  guestProfile,
  guestStatus,
  memberTasteProfile,
  memberTasteStatus,
  onGuestNameChange,
  onTogglePreference,
  onCreateGuestProfile,
  onToggleMemberPreference,
  onCreateMemberTasteProfile,
}: {
  signedIn: boolean;
  profileMode: ProfileMode;
  onProfileModeChange: (mode: ProfileMode) => void;
  guestProfile: GuestProfile;
  guestStatus: GuestProfileStatus;
  memberTasteProfile: GuestProfile;
  memberTasteStatus: GuestProfileStatus;
  onGuestNameChange: (name: string) => void;
  onTogglePreference: (preference: string) => void;
  onCreateGuestProfile: () => void;
  onToggleMemberPreference: (preference: string) => void;
  onCreateMemberTasteProfile: () => void;
}) {
  const showMemberTasteProfile = signedIn && profileMode === "member";

  return (
    <ControlGroup label="Profile">
      <div className="grid gap-2 rounded-xl border border-white/10 bg-background-darker p-2">
        {signedIn ? (
          <button
            type="button"
            onClick={() => onProfileModeChange("member")}
            className={`rounded-lg px-3 py-2 text-left text-sm transition ${
              profileMode === "member"
                ? "bg-success/10 text-success"
                : "text-muted hover:bg-surface hover:text-foreground"
            }`}
          >
            <span className="font-semibold">Blackbird member</span>
            <span className="mt-0.5 block text-xs">
              OAuth profile connected
            </span>
          </button>
        ) : (
          <LoginButton
            href="/api/auth/login"
            label="Log in"
            className="h-10 w-full px-4 text-sm"
          />
        )}
        <button
          type="button"
          onClick={() => onProfileModeChange("guest")}
          className={`rounded-lg px-3 py-2 text-left text-sm transition ${
            profileMode === "guest"
              ? "bg-primary/15 text-primary-bright"
              : "text-muted hover:bg-surface hover:text-foreground"
          }`}
        >
          <span className="font-semibold">Guest profile</span>
          <span className="mt-0.5 block text-xs">Local preferences</span>
        </button>
      </div>

      {showMemberTasteProfile ? (
        <MemberTasteProfilePanel
          profile={memberTasteProfile}
          status={memberTasteStatus}
          onTogglePreference={onToggleMemberPreference}
          onCreateTasteProfile={onCreateMemberTasteProfile}
        />
      ) : (
        <GuestProfilePanel
          profile={guestProfile}
          status={guestStatus}
          onGuestNameChange={onGuestNameChange}
          onTogglePreference={onTogglePreference}
          onCreateGuestProfile={onCreateGuestProfile}
        />
      )}
    </ControlGroup>
  );
}

function GuestProfilePanel({
  profile,
  status,
  onGuestNameChange,
  onTogglePreference,
  onCreateGuestProfile,
}: {
  profile: GuestProfile;
  status: GuestProfileStatus;
  onGuestNameChange: (name: string) => void;
  onTogglePreference: (preference: string) => void;
  onCreateGuestProfile: () => void;
}) {
  const profileLabel = buildGuestProfileLabel(profile.preferences);

  return (
    <>
      <label className="mt-3 block">
        <span className="text-xs font-medium text-subtle">Guest name</span>
        <input
          value={profile.name}
          onChange={(event) => onGuestNameChange(event.target.value)}
          className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-background-darker px-3 text-sm font-medium text-foreground outline-none transition placeholder:text-subtle focus:border-primary"
          placeholder="Guest explorer"
        />
      </label>

      <PreferencePicker
        preferences={profile.preferences}
        onTogglePreference={onTogglePreference}
      />

      <div className="mt-3 rounded-xl border border-white/10 bg-background-darker p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {profileLabel}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              {profile.preferences.length > 0
                ? `${profile.preferences.slice(0, 4).join(", ")} profile`
                : "Pick a few preferences to personalize the route."}
            </p>
          </div>
          <Tag tone={status === "created" ? "success" : "neutral"}>
            {status === "created" ? "Created" : "Draft"}
          </Tag>
        </div>
        <button
          type="button"
          onClick={onCreateGuestProfile}
          className="mt-3 inline-flex h-9 w-full items-center justify-center rounded-full border border-primary/40 bg-primary/10 px-3 text-sm font-semibold text-primary-bright transition hover:bg-primary/15"
        >
          Create guest profile
        </button>
      </div>
    </>
  );
}

function MemberTasteProfilePanel({
  profile,
  status,
  onTogglePreference,
  onCreateTasteProfile,
}: {
  profile: GuestProfile;
  status: GuestProfileStatus;
  onTogglePreference: (preference: string) => void;
  onCreateTasteProfile: () => void;
}) {
  const profileLabel = buildGuestProfileLabel(profile.preferences);

  return (
    <div className="mt-3 rounded-xl border border-success/20 bg-success/5 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">
            Blackbird taste profile
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            {profile.preferences.length > 0
              ? `${profile.preferences.slice(0, 5).join(", ")} profile`
              : "Add taste signals for this member."}
          </p>
        </div>
        <Tag tone={status === "created" ? "success" : "neutral"}>
          {status === "created" ? "Created" : "Not created"}
        </Tag>
      </div>

      <div className="mt-3 rounded-lg border border-white/10 bg-background-darker p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-subtle">
            {profileLabel}
          </span>
          <Tag tone="primary">Live route scoring</Tag>
        </div>
        <PreferencePicker
          preferences={profile.preferences}
          onTogglePreference={onTogglePreference}
        />
      </div>

      <button
        type="button"
        onClick={onCreateTasteProfile}
        className="mt-3 inline-flex h-9 w-full items-center justify-center rounded-full border border-success/40 bg-success/10 px-3 text-sm font-semibold text-success transition hover:bg-success/15"
      >
        {status === "created"
          ? "Update taste profile"
          : "Create taste profile"}
      </button>
    </div>
  );
}

function PreferencePicker({
  preferences,
  onTogglePreference,
}: {
  preferences: string[];
  onTogglePreference: (preference: string) => void;
}) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {PREFERENCE_OPTIONS.map((preference) => {
        const selected = preferences.includes(preference);
        return (
          <button
            key={preference}
            type="button"
            onClick={() => onTogglePreference(preference)}
            className={`h-8 rounded-full px-3 text-xs font-semibold transition ${
              selected
                ? "bg-primary text-primary-foreground"
                : "bg-white/10 text-muted hover:bg-white/15 hover:text-foreground"
            }`}
          >
            {preference}
          </button>
        );
      })}
    </div>
  );
}

function QuestWindowControl({
  durationMinutes,
  onDurationChange,
}: {
  durationMinutes: number;
  onDurationChange: (minutes: number) => void;
}) {
  const selectedPreset = QUEST_WINDOW_PRESETS.find(
    (preset) => preset.minutes === durationMinutes,
  );

  function updateCustomWindow(hoursValue: string) {
    const hours = Number(hoursValue);
    if (!Number.isFinite(hours)) return;
    onDurationChange(clampWindowMinutes(Math.round(hours * 60)));
  }

  return (
    <ControlGroup label="Quest window">
      <div className="grid grid-cols-2 gap-2">
        {QUEST_WINDOW_PRESETS.map((preset) => {
          const selected = preset.minutes === durationMinutes;
          return (
            <button
              key={preset.minutes}
              type="button"
              onClick={() => onDurationChange(preset.minutes)}
              className={`min-h-14 rounded-xl border px-3 py-2 text-left transition duration-150 ease-standard ${
                selected
                  ? "border-primary bg-primary/15 text-foreground"
                  : "border-white/10 bg-background-darker text-muted hover:border-white/20 hover:bg-surface"
              }`}
            >
              <span className="block text-sm font-semibold">{preset.label}</span>
              <span className="mt-0.5 block text-xs">{preset.detail}</span>
            </button>
          );
        })}
      </div>

      <label
        className={`mt-2 block rounded-xl border bg-background-darker p-3 transition ${
          selectedPreset
            ? "border-white/10"
            : "border-primary/50 ring-1 ring-primary/20"
        }`}
      >
        <span className="flex items-center justify-between gap-3">
          <span className="text-xs font-medium text-subtle">Custom hours</span>
          <span className="text-xs font-semibold text-foreground">
            {formatMinutes(durationMinutes)}
          </span>
        </span>
        <input
          type="number"
          min={MIN_CUSTOM_WINDOW_MINUTES / 60}
          max={MAX_CUSTOM_WINDOW_MINUTES / 60}
          step={0.5}
          value={formatWindowHoursInput(durationMinutes)}
          onChange={(event) => updateCustomWindow(event.target.value)}
          className="mt-2 h-10 w-full rounded-lg border border-white/10 bg-surface-lowest px-3 text-sm font-semibold text-foreground outline-none transition placeholder:text-subtle focus:border-primary"
        />
      </label>
    </ControlGroup>
  );
}

function StartPointControl({
  startPoint,
  isPicking,
  onAutoStart,
  onPickFromMap,
  onPresetStart,
}: {
  startPoint: RoutePoint | null;
  isPicking: boolean;
  onAutoStart: () => void;
  onPickFromMap: () => void;
  onPresetStart: (preset: StartPointPreset) => void;
}) {
  return (
    <ControlGroup label="Start point">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onAutoStart}
          className={`min-h-14 rounded-xl border px-3 py-2 text-left transition duration-150 ease-standard ${
            !startPoint && !isPicking
              ? "border-primary bg-primary/15 text-foreground"
              : "border-white/10 bg-background-darker text-muted hover:border-white/20 hover:bg-surface"
          }`}
        >
          <span className="block text-sm font-semibold">Auto</span>
          <span className="mt-0.5 block text-xs">Route edge</span>
        </button>
        {START_POINT_PRESETS.map((preset) => {
          const selected = startPoint?.label === preset.label;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onPresetStart(preset)}
              className={`min-h-14 rounded-xl border px-3 py-2 text-left transition duration-150 ease-standard ${
                selected
                  ? "border-primary bg-primary/15 text-foreground"
                  : "border-white/10 bg-background-darker text-muted hover:border-white/20 hover:bg-surface"
              }`}
            >
              <span className="block text-sm font-semibold">
                {preset.label}
              </span>
              <span className="mt-0.5 block text-xs">{preset.detail}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-2 grid gap-2 rounded-xl border border-white/10 bg-background-darker p-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <MapPinIcon className="h-4 w-4 text-primary-bright" />
          <span>{startPoint?.label ?? "Auto start"}</span>
        </div>
        <p className="text-xs text-subtle">
          {startPoint ? formatCoordinate(startPoint.coordinate) : "Near first stop"}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onPickFromMap}
            className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-semibold transition ${
              isPicking
                ? "border border-primary/40 bg-primary/20 text-primary-bright"
                : "border border-white/10 text-muted hover:border-white/20 hover:text-foreground"
            }`}
          >
            <MapPinIcon className="h-3.5 w-3.5" />
            {isPicking ? "Cancel pick" : "Pick on map"}
          </button>
          {startPoint ? (
            <button
              type="button"
              onClick={onAutoStart}
              className="inline-flex h-8 items-center justify-center rounded-full border border-white/10 px-3 text-xs font-semibold text-muted transition hover:border-white/20 hover:text-foreground"
            >
              Reset
            </button>
          ) : null}
        </div>
      </div>
    </ControlGroup>
  );
}

function ControlGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-subtle">{label}</p>
      {children}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-background-darker p-3">
      <p className="text-[11px] font-medium text-subtle">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function CheckInProgress({
  checkedCount,
  totalCount,
  completed,
  onCompleteAll,
  onReset,
}: {
  checkedCount: number;
  totalCount: number;
  completed: boolean;
  onCompleteAll: () => void;
  onReset: () => void;
}) {
  const progress = totalCount > 0 ? (checkedCount / totalCount) * 100 : 0;

  return (
    <div className="rounded-xl border border-white/10 bg-background-darker p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium text-subtle">Check-ins</p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {checkedCount}/{totalCount} stops completed
          </p>
        </div>
        <Tag tone={completed ? "success" : "neutral"}>
          {completed ? "Ready" : "In progress"}
        </Tag>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-success transition-all duration-300 ease-standard"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onCompleteAll}
          disabled={completed}
          className="inline-flex h-8 items-center justify-center rounded-full border border-success/40 bg-success/10 px-3 text-xs font-semibold text-success transition hover:bg-success/15 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Mark all checked in
        </button>
        {checkedCount > 0 ? (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex h-8 items-center justify-center rounded-full border border-white/10 px-3 text-xs font-semibold text-muted transition hover:border-white/20 hover:text-foreground"
          >
            Reset
          </button>
        ) : null}
      </div>
    </div>
  );
}

function MockChallengeCard({
  challengeId,
  track,
  stopCount,
  windowLabel,
  cadenceLabel,
  rewardFly,
  completed,
}: {
  challengeId: string;
  track: ChallengeTrack;
  stopCount: number;
  windowLabel: string;
  cadenceLabel: string;
  rewardFly: number;
  completed: boolean;
}) {
  const steps = [
    "Profile matched",
    "Route generated",
    completed ? "FLY preview unlocked" : "Reward armed",
  ];

  return (
    <div className="rounded-xl border border-primary/25 bg-primary/10 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium text-primary-bright">
            Mock challenge generation
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {challengeId}
          </p>
        </div>
        <Tag tone={completed ? "success" : "primary"}>
          {completed ? "Completed" : "Generated"}
        </Tag>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg border border-white/10 bg-background-darker p-2">
          <p className="text-subtle">Challenge</p>
          <p className="mt-0.5 font-semibold text-foreground">
            {track.label}
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-background-darker p-2">
          <p className="text-subtle">Reward</p>
          <p className="mt-0.5 font-semibold text-success">
            +{rewardFly} FLY
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-background-darker p-2">
          <p className="text-subtle">Stops</p>
          <p className="mt-0.5 font-semibold text-foreground">
            {stopCount} stops
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-background-darker p-2">
          <p className="text-subtle">Window</p>
          <p className="mt-0.5 font-semibold text-foreground">
            {windowLabel}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {steps.map((step) => (
          <span
            key={step}
            className="inline-flex h-7 items-center rounded-full border border-white/10 bg-background-darker px-2.5 text-[11px] font-semibold text-muted"
          >
            {step}
          </span>
        ))}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted">
        {cadenceLabel} cadence. This is a local demo receipt, no Rewards API
        issuance happens here.
      </p>
    </div>
  );
}

function ShareQuestCard({ snapshot }: { snapshot: ShareQuestSnapshot }) {
  const [status, setStatus] = useState("Ready to share");

  useEffect(() => {
    setStatus("Ready to share");
  }, [snapshot.challengeId]);

  async function copyItinerary() {
    try {
      await writeClipboardText(createShareText(snapshot));
      setStatus("Copied itinerary");
    } catch {
      setStatus("Copy failed");
    }
  }

  async function shareItinerary() {
    const text = createShareText(snapshot);
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: `Passport Quest ${snapshot.challengeId}`,
          text,
          url: snapshot.directionsUrl ?? undefined,
        });
        setStatus("Share sheet opened");
        return;
      } catch {
        setStatus("Share canceled");
        return;
      }
    }
    await copyItinerary();
  }

  function downloadPage() {
    try {
      downloadSharePage(snapshot);
      setStatus("Standalone page downloaded");
    } catch {
      setStatus("Download failed");
    }
  }

  return (
    <div className="rounded-xl border border-white/10 bg-background-darker p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium text-subtle">
            Share package
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            Route link and ordered restaurants
          </p>
        </div>
        <Tag tone={snapshot.completed ? "success" : "primary"}>
          {snapshot.completed ? "Unlocked" : "Shareable"}
        </Tag>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-muted">
        Copy the itinerary for Slack, use the system share sheet, or download a
        static HTML page that opens after this dev server is offline.
      </p>

      <div className="mt-3 grid gap-2">
        <button
          type="button"
          onClick={shareItinerary}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-full bg-foreground px-3 text-sm font-semibold text-background transition hover:opacity-90"
        >
          <ShareIcon className="h-4 w-4" />
          Share
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={copyItinerary}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-strong px-3 text-xs font-semibold text-foreground transition hover:border-primary/60"
          >
            <CopyIcon className="h-3.5 w-3.5" />
            Copy text
          </button>
          <button
            type="button"
            onClick={downloadPage}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 text-xs font-semibold text-primary-bright transition hover:bg-primary/15"
          >
            <DownloadIcon className="h-3.5 w-3.5" />
            Download page
          </button>
        </div>
      </div>

      <p className="mt-2 text-[11px] font-medium text-subtle">{status}</p>
    </div>
  );
}

function LiveQuestMap({
  stops,
  metrics,
  checkedStopKeys,
  track,
  cadenceLabel,
  isPickingStartPoint,
  onStartPointPick,
}: {
  stops: QuestStop[];
  metrics: RouteMetrics;
  checkedStopKeys: string[];
  track: ChallengeTrack;
  cadenceLabel: string;
  isPickingStartPoint: boolean;
  onStartPointPick: (coordinate: Coordinate) => void;
}) {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function mountMap() {
      const mappedStops = stops.filter(hasCoordinate);
      if (!mapEl.current || mappedStops.length === 0) return;
      const L = await import("leaflet");
      if (cancelled || !mapEl.current) return;

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      const map = L.map(mapEl.current, {
        attributionControl: true,
        scrollWheelZoom: false,
        zoomControl: false,
      });
      mapRef.current = map;
      map.getContainer().style.cursor = isPickingStartPoint
        ? "crosshair"
        : "";

      if (isPickingStartPoint) {
        map.on("click", (event: { latlng: { lat: number; lng: number } }) => {
          onStartPointPick({
            latitude: event.latlng.lat,
            longitude: event.latlng.lng,
          });
        });
      }

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);
      L.control.zoom({ position: "bottomright" }).addTo(map);

      const latLngs = mappedStops.map(
        (stop) =>
          [stop.coordinate.latitude, stop.coordinate.longitude] as [
            number,
            number,
          ],
      );
      const routeLatLngs = metrics.startPoint
        ? [
            [
              metrics.startPoint.coordinate.latitude,
              metrics.startPoint.coordinate.longitude,
            ] as [number, number],
            ...latLngs,
          ]
        : latLngs;

      L.polyline(routeLatLngs, {
        color: "rgb(var(--core-primary))",
        opacity: 0.9,
        weight: 4,
      }).addTo(map);

      if (metrics.startPoint) {
        const startMarker = L.marker(
          [
            metrics.startPoint.coordinate.latitude,
            metrics.startPoint.coordinate.longitude,
          ],
          {
            icon: L.divIcon({
              className: "quest-map-marker quest-map-marker--start",
              html: "<span>S</span>",
              iconAnchor: [16, 16],
              iconSize: [32, 32],
            }),
            title: metrics.startPoint.name,
          },
        ).addTo(map);
        startMarker.bindPopup(
          `<strong>${escapeHtml(metrics.startPoint.name)}</strong>`,
        );
      }

      mappedStops.forEach((stop) => {
        const checked = checkedStopKeys.includes(stopKey(stop));
        const marker = L.marker(
          [stop.coordinate.latitude, stop.coordinate.longitude],
          {
            icon: L.divIcon({
              className: `quest-map-marker${checked ? " quest-map-marker--checked" : ""}`,
              html: `<span>${stop.order}</span>`,
              iconAnchor: [16, 16],
              iconSize: [32, 32],
            }),
            title: stop.name,
          },
        ).addTo(map);
        marker.bindPopup(`<strong>${escapeHtml(stop.name)}</strong>`);
      });

      if (routeLatLngs.length === 1) {
        map.setView(routeLatLngs[0], 14);
      } else {
        map.fitBounds(L.latLngBounds(routeLatLngs), { padding: [34, 34] });
      }
    }

    mountMap();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [
    checkedStopKeys,
    isPickingStartPoint,
    metrics.startPoint,
    onStartPointPick,
    stops,
  ]);

  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-background-darker xl:sticky xl:top-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary-bright">
            <TrackIcon icon={track.icon} className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {track.label}
            </p>
            <p className="mt-1 text-sm text-muted">
              {formatKm(metrics.totalKm)} route,{" "}
              {cadenceLabel} cadence
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Tag tone="success">{stops.length} stops</Tag>
          <Tag tone={metrics.mappedStops >= 2 ? "primary" : "neutral"}>
            {metrics.mappedStops} mapped
          </Tag>
        </div>
      </div>
      <div className="relative h-[460px] min-h-[420px] xl:h-[calc(100vh-8rem)] xl:min-h-[560px]">
        <div ref={mapEl} className="h-full w-full" />
        {isPickingStartPoint && metrics.mappedStops > 0 ? (
          <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full border border-primary/30 bg-background-darker/95 px-3 py-2 text-xs font-semibold text-primary-bright shadow-lg">
            <MapPinIcon className="h-3.5 w-3.5" />
            Pick start point
          </div>
        ) : null}
        {metrics.mappedStops === 0 ? (
          <div className="absolute inset-0 grid place-items-center bg-background-darker p-6 text-center">
            <div>
              <p className="text-lg font-semibold text-foreground">
                Coordinates unavailable
              </p>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
                The itinerary still works, but the map needs at least one
                location with latitude and longitude from Flynet.
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function Itinerary({
  stops,
  metrics,
  checkedStopKeys,
  onCheckIn,
  preferences,
  track,
  durationMinutes,
  cadenceLabel,
}: {
  stops: QuestStop[];
  metrics: RouteMetrics;
  checkedStopKeys: string[];
  onCheckIn: (stop: QuestStop) => void;
  preferences: string[];
  track: ChallengeTrack;
  durationMinutes: number;
  cadenceLabel: string;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-surface-low">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-foreground">
            {stops.length} restaurants in route order
          </p>
          <p className="mt-1 text-sm text-muted">
            {formatMinutes(durationMinutes)} window, {cadenceLabel}
          </p>
        </div>
        <p className="text-sm text-muted">
          {formatKm(metrics.totalKm)} - {formatMinutes(metrics.totalMinutes)}
        </p>
      </div>
      <div className="divide-y divide-white/10">
        {stops.map((stop, index) => (
          <ItineraryRow
            key={`${stop.restaurantId}-${stop.order}`}
            stop={stop}
            segment={metrics.segments[index]}
            checked={checkedStopKeys.includes(stopKey(stop))}
            onCheckIn={onCheckIn}
            reason={buildStopReason(stop, preferences, track)}
          />
        ))}
      </div>
    </section>
  );
}

function ItineraryRow({
  stop,
  segment,
  checked,
  onCheckIn,
  reason,
}: {
  stop: QuestStop;
  segment: RouteSegment | null;
  checked: boolean;
  onCheckIn: (stop: QuestStop) => void;
  reason: string;
}) {
  const reserve = stop.location?.reservationUrl;
  const fallbackLink = stop.websiteUrl;
  const directionsUrl = buildSegmentDirectionsUrl(segment);

  return (
    <article className="grid gap-4 px-5 py-4 sm:grid-cols-[56px_1fr_auto] sm:items-center">
      <div className="flex items-center gap-3 sm:block">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-foreground text-sm font-bold text-background">
          {stop.order}
        </span>
        {stop.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={stop.imageUrl}
            alt={stop.name}
            className="h-14 w-14 rounded-xl object-cover sm:mt-3"
          />
        ) : null}
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold text-foreground">{stop.name}</h3>
          {stop.cuisines.slice(0, 2).map((cuisine) => (
            <Tag key={cuisine}>{cuisine}</Tag>
          ))}
        </div>
        <p className="mt-1 text-sm text-muted">
          {stop.location?.label ?? "Location pending"}
        </p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-subtle">
          <span>{reason}</span>
          {segment ? (
            <span>
              {formatMinutes(segment.minutes)} walk from {segment.from.label}
            </span>
          ) : (
            <span>Directions pending</span>
          )}
          {typeof stop.checkInCount === "number" && stop.checkInCount > 0 ? (
            <span>{stop.checkInCount.toLocaleString("en-US")} check-ins</span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 sm:justify-end">
        <button
          type="button"
          onClick={() => onCheckIn(stop)}
          disabled={checked}
          className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-semibold transition ${
            checked
              ? "border border-success/40 bg-success/10 text-success"
              : "bg-primary text-primary-foreground hover:opacity-90"
          }`}
        >
          <CheckIcon className="h-3.5 w-3.5" />
          {checked ? "Checked in" : "Mark check-in"}
        </button>
        {directionsUrl ? (
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center justify-center rounded-full border border-strong px-3 text-sm font-medium text-foreground transition hover:border-primary/60"
          >
            Directions
          </a>
        ) : null}
        {reserve || fallbackLink ? (
          <a
            href={reserve ?? fallbackLink ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center justify-center rounded-full bg-foreground px-3 text-sm font-semibold text-background transition hover:opacity-90"
          >
            {reserve ? "Reserve" : "Website"}
          </a>
        ) : null}
      </div>
    </article>
  );
}

type RouteSegment = {
  from: RoutePoint;
  to: QuestStop;
  km: number;
  minutes: number;
};

type RouteMetrics = {
  segments: Array<RouteSegment | null>;
  totalKm: number;
  totalMinutes: number;
  mappedStops: number;
  startPoint: RoutePoint | null;
};

function selectStops({
  stops,
  track,
  count,
  durationMinutes,
  generation,
  preferences,
  startCoordinate,
}: {
  stops: QuestStop[];
  track: ChallengeTrack;
  count: QuestLength;
  durationMinutes: number;
  generation: number;
  preferences: string[];
  startCoordinate: Coordinate | null;
}): QuestStop[] {
  const scored = stops
    .map((stop) => ({
      stop,
      score: scoreStop(stop, preferences, track, generation),
    }))
    .sort((a, b) => b.score - a.score);
  const pool = buildCompactRoutePool(
    scored,
    count,
    track,
    durationMinutes,
    startCoordinate,
  );

  const selected = pool.slice(0, count).map(({ stop }) => stop);

  return orderStopsByRoute(selected, startCoordinate);
}

function buildCompactRoutePool(
  scored: Array<{ stop: QuestStop; score: number }>,
  count: QuestLength,
  track: ChallengeTrack,
  durationMinutes: number,
  startCoordinate: Coordinate | null,
): Array<{ stop: QuestStop; score: number }> {
  const mapped = scored.filter(({ stop }) => stop.coordinate);
  if (mapped.length < count) {
    return [
      ...mapped,
      ...scored.filter(({ stop }) => !stop.coordinate),
    ];
  }

  const walkingBudgetKm = Math.max(1.5, (durationMinutes / 60) * 4.8);
  const radiusKm = Math.min(
    track.id === "crawl" ? 2.4 : track.id === "classic" ? 3.4 : 2.6,
    Math.max(1.5, walkingBudgetKm * 0.62),
  );
  const anchors = mapped.slice(0, Math.min(40, mapped.length));
  const clusters = anchors.map((anchor) => {
    const items = mapped
      .map((candidate) => ({
        candidate,
        distance:
          anchor.stop.coordinate && candidate.stop.coordinate
            ? distanceKm(anchor.stop.coordinate, candidate.stop.coordinate)
            : Number.POSITIVE_INFINITY,
      }))
      .sort((a, b) => {
        const aBucket = a.distance <= radiusKm ? 0 : 1;
        const bBucket = b.distance <= radiusKm ? 0 : 1;
        const aFit = a.candidate.score - a.distance * 42;
        const bFit = b.candidate.score - b.distance * 42;
        return (
          aBucket - bBucket ||
          bFit - aFit ||
          a.distance - b.distance
        );
      })
      .slice(0, count);
    const selectedStops = items.map(({ candidate }) => candidate.stop);
    const totalDistance = estimateRouteDistanceKm(
      orderStopsByRoute(selectedStops, startCoordinate),
      startCoordinate,
    );
    const signal = items.reduce((sum, item) => sum + item.candidate.score, 0);
    const farthest = Math.max(...items.map((item) => item.distance));
    const outsideCount = items.filter((item) => item.distance > radiusKm).length;
    const spanDistance = maxPairwiseDistanceKm(selectedStops);
    const overBudget = Math.max(0, totalDistance - walkingBudgetKm);
    return {
      items: items.map(({ candidate }) => candidate),
      score:
        signal -
        totalDistance * 65 -
        overBudget * 140 -
        spanDistance * 42 -
        outsideCount * 95 -
        Math.max(0, farthest - radiusKm) * 70,
    };
  });

  return clusters.sort((a, b) => b.score - a.score)[0]?.items ?? mapped;
}

function scoreStop(
  stop: QuestStop,
  preferences: string[],
  track: ChallengeTrack,
  generation: number,
): number {
  const preferenceMatches = matchTerms(stop.cuisines, preferences);
  const preferenceScore = preferenceMatches.length * 80;
  const socialScore =
    typeof stop.checkInCount === "number" && stop.checkInCount > 0
      ? Math.min(75, Math.log10(stop.checkInCount + 1) * 24)
      : 0;
  const mapScore = stop.coordinate ? 28 : 0;
  const nightlifeScore = isNightlifeStop(stop) ? 90 : 0;
  const randomScore = deterministicJitter(
    `${track.id}:${stop.restaurantId}:${generation}`,
    48,
  );

  if (track.id === "crawl") {
    return (
      nightlifeScore +
      preferenceScore * 0.7 +
      socialScore +
      mapScore +
      randomScore * 1.2
    );
  }
  if (track.id === "roulette") {
    return randomScore * 4.4 + preferenceScore * 0.8 + socialScore + mapScore;
  }
  return preferenceScore + socialScore + mapScore + randomScore * 1.4;
}

function orderStopsByRoute(
  stops: QuestStop[],
  startCoordinate: Coordinate | null = null,
): QuestStop[] {
  if (stops.length <= 1) return stops;
  const mapped = stops.filter(hasCoordinate);
  const unmapped = stops.filter((stop) => !stop.coordinate);
  if (mapped.length <= 1) return [...mapped, ...unmapped];

  const route = startCoordinate
    ? shortestRouteFromStart(mapped, startCoordinate)
    : shortestOpenRoute(mapped);
  return [...route, ...unmapped];
}

function shortestOpenRoute(
  stops: Array<QuestStop & { coordinate: Coordinate }>,
): QuestStop[] {
  let bestRoute: Array<QuestStop & { coordinate: Coordinate }> = stops;
  let bestDistance = Number.POSITIVE_INFINITY;
  const route: Array<QuestStop & { coordinate: Coordinate }> = [];
  const remaining = [...stops];

  function visit(distanceSoFar: number) {
    if (distanceSoFar >= bestDistance) return;
    if (remaining.length === 0) {
      bestDistance = distanceSoFar;
      bestRoute = [...route];
      return;
    }

    for (let index = 0; index < remaining.length; index += 1) {
      const next = remaining[index];
      const previous = route[route.length - 1];
      const nextDistance = previous
        ? distanceKm(previous.coordinate, next.coordinate)
        : 0;
      route.push(next);
      remaining.splice(index, 1);
      visit(distanceSoFar + nextDistance);
      remaining.splice(index, 0, next);
      route.pop();
    }
  }

  visit(0);
  return bestRoute;
}

function shortestRouteFromStart(
  stops: Array<QuestStop & { coordinate: Coordinate }>,
  startCoordinate: Coordinate,
): QuestStop[] {
  let bestRoute: Array<QuestStop & { coordinate: Coordinate }> = stops;
  let bestDistance = Number.POSITIVE_INFINITY;
  const route: Array<QuestStop & { coordinate: Coordinate }> = [];
  const remaining = [...stops];

  function visit(distanceSoFar: number) {
    if (distanceSoFar >= bestDistance) return;
    if (remaining.length === 0) {
      bestDistance = distanceSoFar;
      bestRoute = [...route];
      return;
    }

    for (let index = 0; index < remaining.length; index += 1) {
      const next = remaining[index];
      const previous = route[route.length - 1];
      const previousCoordinate = previous?.coordinate ?? startCoordinate;
      const nextDistance = distanceKm(previousCoordinate, next.coordinate);
      route.push(next);
      remaining.splice(index, 1);
      visit(distanceSoFar + nextDistance);
      remaining.splice(index, 0, next);
      route.pop();
    }
  }

  visit(0);
  return bestRoute;
}

function estimateRouteDistanceKm(
  stops: QuestStop[],
  startCoordinate: Coordinate | null = null,
): number {
  let total = 0;
  let previousCoordinate = startCoordinate;

  stops.forEach((stop) => {
    if (!stop.coordinate) return;
    if (previousCoordinate) {
      total += distanceKm(previousCoordinate, stop.coordinate);
    }
    previousCoordinate = stop.coordinate;
  });

  return total;
}

function maxPairwiseDistanceKm(stops: QuestStop[]): number {
  let maxDistance = 0;
  for (let outer = 0; outer < stops.length; outer += 1) {
    const first = stops[outer];
    if (!first.coordinate) continue;
    for (let inner = outer + 1; inner < stops.length; inner += 1) {
      const second = stops[inner];
      if (!second.coordinate) continue;
      maxDistance = Math.max(
        maxDistance,
        distanceKm(first.coordinate, second.coordinate),
      );
    }
  }
  return maxDistance;
}

function buildRouteMetrics(
  stops: QuestStop[],
  startPointOverride: RoutePoint | null = null,
): RouteMetrics {
  const startPoint = startPointOverride ?? buildQuestStartPoint(stops);
  const segments = stops.map((stop, index): RouteSegment | null => {
    if (!stop.coordinate) return null;
    const from =
      index === 0
        ? startPoint
        : routePointFromStop(stops[index - 1], "previous stop");
    if (!from) return null;
    const km = distanceKm(from.coordinate, stop.coordinate);
    return {
      from,
      to: stop,
      km,
      minutes: Math.max(4, Math.round((km / 4.8) * 60)),
    };
  });
  const totalKm = segments.reduce((sum, segment) => sum + (segment?.km ?? 0), 0);
  const totalMinutes = segments.reduce(
    (sum, segment) => sum + (segment?.minutes ?? 0),
    0,
  );
  return {
    segments,
    totalKm,
    totalMinutes,
    mappedStops: stops.filter((stop) => stop.coordinate).length,
    startPoint,
  };
}

function buildDirectionsUrl(
  stops: QuestStop[],
  startPoint: RoutePoint | null,
): string | null {
  const mappedStops = stops.filter(hasCoordinate);
  if (mappedStops.length === 0) return null;
  const origin = startPoint ?? mappedStops[0];
  const destination = mappedStops[mappedStops.length - 1];
  const waypoints = startPoint
    ? mappedStops.slice(0, -1)
    : mappedStops.slice(1, -1);
  const params = new URLSearchParams({
    api: "1",
    origin: coordinateParam(origin),
    destination: coordinateParam(destination),
    travelmode: "walking",
  });
  if (waypoints.length > 0) {
    params.set("waypoints", waypoints.map(coordinateParam).join("|"));
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function buildSegmentDirectionsUrl(segment: RouteSegment | null): string | null {
  if (!segment) return null;
  const params = new URLSearchParams({
    api: "1",
    origin: coordinateParam(segment.from),
    destination: coordinateParam(segment.to),
    travelmode: "walking",
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function buildQuestStartPoint(stops: QuestStop[]): RoutePoint | null {
  const mappedStops = stops.filter(hasCoordinate);
  const first = mappedStops[0];
  if (!first) return null;
  const centroid = centroidCoordinate(mappedStops.map((stop) => stop.coordinate));
  const startCoordinate = offsetAwayFromCentroid(first.coordinate, centroid, 0.35);
  return {
    kind: "start",
    name: "Quest start",
    label: "Quest start",
    coordinate: startCoordinate,
  };
}

function startPointFromPreset(preset: StartPointPreset): RoutePoint {
  return {
    kind: "start",
    name: `${preset.label} start`,
    label: preset.label,
    coordinate: preset.coordinate,
  };
}

function routePointFromStop(stop: QuestStop, label: string): RoutePoint | null {
  if (!stop.coordinate) return null;
  return {
    kind: "stop",
    name: stop.name,
    label,
    coordinate: stop.coordinate,
  };
}

function centroidCoordinate(coordinates: Coordinate[]): Coordinate {
  const total = coordinates.reduce(
    (sum, coordinate) => ({
      latitude: sum.latitude + coordinate.latitude,
      longitude: sum.longitude + coordinate.longitude,
    }),
    { latitude: 0, longitude: 0 },
  );
  return {
    latitude: total.latitude / coordinates.length,
    longitude: total.longitude / coordinates.length,
  };
}

function offsetAwayFromCentroid(
  coordinate: Coordinate,
  centroid: Coordinate,
  distanceKmValue: number,
): Coordinate {
  const latVector = coordinate.latitude - centroid.latitude;
  const lonVector = coordinate.longitude - centroid.longitude;
  const length = Math.hypot(latVector, lonVector);
  const unitLat = length > 0 ? latVector / length : 0;
  const unitLon = length > 0 ? lonVector / length : -1;
  const latKm = 111.32;
  const lonKm = Math.max(1, 111.32 * Math.cos(toRadians(coordinate.latitude)));
  return {
    latitude: coordinate.latitude + (unitLat * distanceKmValue) / latKm,
    longitude: coordinate.longitude + (unitLon * distanceKmValue) / lonKm,
  };
}

function coordinateParam(point: { coordinate: Coordinate | null }): string {
  const coordinate = point.coordinate;
  if (!coordinate) return "";
  return `${coordinate.latitude},${coordinate.longitude}`;
}

function stopKey(stop: QuestStop): string {
  return `${stop.restaurantId}:${stop.location?.id ?? "location-pending"}`;
}

function hasCoordinate(
  stop: QuestStop,
): stop is QuestStop & { coordinate: NonNullable<QuestStop["coordinate"]> } {
  return Boolean(stop.coordinate);
}

function buildStopReason(
  stop: QuestStop,
  preferences: string[],
  track: ChallengeTrack,
): string {
  const preferenceMatches = matchTerms(stop.cuisines, preferences);
  if (preferenceMatches.length > 0) {
    return `Matches ${preferenceMatches.slice(0, 2).join(" and ")}`;
  }
  if (track.id === "crawl" && isNightlifeStop(stop)) return "Good crawl stop";
  if (typeof stop.checkInCount === "number" && stop.checkInCount > 0) {
    return `${stop.checkInCount.toLocaleString("en-US")} Blackbird check-ins`;
  }
  return "Discovery pick";
}

function matchTerms(cuisines: string[], preferences: string[]): string[] {
  const normalizedPreferences = preferences.map(normalize);
  return cuisines.filter((cuisine) => {
    const normalizedCuisine = normalize(cuisine);
    return normalizedPreferences.some(
      (preference) =>
        normalizedCuisine.includes(preference) ||
        preference.includes(normalizedCuisine),
    );
  });
}

function isNightlifeStop(stop: QuestStop): boolean {
  const searchable = [...stop.cuisines, stop.name].map(normalize).join(" ");
  return NIGHTLIFE_TERMS.some((term) => searchable.includes(term));
}

function buildGuestProfileLabel(preferences: string[]): string {
  const normalized = preferences.map(normalize);
  if (
    normalized.some((preference) =>
      ["bar", "cocktails", "wine bar"].includes(preference),
    )
  ) {
    return "Social route profile";
  }
  if (
    normalized.some((preference) =>
      ["date night", "dessert", "wine bar"].includes(preference),
    )
  ) {
    return "Evening planner profile";
  }
  if (
    normalized.some((preference) =>
      ["japanese", "korean", "thai", "chinese", "filipino", "indian"].includes(
        preference,
      ),
    )
  ) {
    return "Cuisine explorer profile";
  }
  if (preferences.length >= 5) return "Open discovery profile";
  return "Guest route profile";
}

function formatKm(km: number): string {
  if (!Number.isFinite(km) || km <= 0) return "Map pending";
  return `${km.toFixed(km >= 10 ? 0 : 1)} km`;
}

function clampWindowMinutes(minutes: number): number {
  return Math.min(
    MAX_CUSTOM_WINDOW_MINUTES,
    Math.max(MIN_CUSTOM_WINDOW_MINUTES, minutes),
  );
}

function formatWindowHoursInput(minutes: number): string {
  const hours = clampWindowMinutes(minutes) / 60;
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}

function formatCoordinate(coordinate: Coordinate): string {
  return `${coordinate.latitude.toFixed(4)}, ${coordinate.longitude.toFixed(4)}`;
}

function buildShareSnapshot({
  challengeId,
  track,
  profileName,
  stops,
  metrics,
  durationMinutes,
  cadenceLabel,
  rewardFly,
  completed,
  directionsUrl,
}: {
  challengeId: string;
  track: ChallengeTrack;
  profileName: string;
  stops: QuestStop[];
  metrics: RouteMetrics;
  durationMinutes: number;
  cadenceLabel: string;
  rewardFly: number;
  completed: boolean;
  directionsUrl: string | null;
}): ShareQuestSnapshot {
  return {
    challengeId,
    trackLabel: track.label,
    profileName,
    stopCount: stops.length,
    windowLabel: formatMinutes(durationMinutes),
    cadenceLabel,
    routeDistanceLabel: formatKm(metrics.totalKm),
    routeTimeLabel: formatMinutes(metrics.totalMinutes),
    rewardFly,
    completed,
    directionsUrl,
    stops: stops.map((stop, index) => {
      const segment = metrics.segments[index];
      return {
        order: stop.order,
        name: stop.name,
        cuisines: stop.cuisines.slice(0, 3).join(", ") || "Restaurant",
        locationLabel: stop.location?.label ?? "Location pending",
        addressLine: stop.location?.addressLine ?? "",
        legLabel: segment
          ? `${formatMinutes(segment.minutes)} walk from ${segment.from.label}`
          : "Directions pending",
      };
    }),
  };
}

function createShareText(snapshot: ShareQuestSnapshot): string {
  const routeUrl = snapshot.directionsUrl ?? "Directions pending";
  const completion = snapshot.completed ? "mock unlocked" : "armed";
  const stops = snapshot.stops
    .map((stop) => {
      const address = stop.addressLine ? `, ${stop.addressLine}` : "";
      return `${stop.order}. ${stop.name} - ${stop.cuisines} - ${stop.locationLabel}${address}\n   ${stop.legLabel}`;
    })
    .join("\n");

  return [
    `Passport Quest: ${snapshot.trackLabel}`,
    `Challenge: ${snapshot.challengeId}`,
    `Profile: ${snapshot.profileName}`,
    `${snapshot.stopCount} stops, ${snapshot.windowLabel}, ${snapshot.cadenceLabel}`,
    `Route: ${snapshot.routeDistanceLabel}, ${snapshot.routeTimeLabel}`,
    `Reward preview: +${snapshot.rewardFly} FLY ${completion}`,
    `Google Maps route: ${routeUrl}`,
    "",
    "Restaurants in order:",
    stops,
  ].join("\n");
}

async function writeClipboardText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "0";
    document.body.append(textarea);
    textarea.focus();
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    if (!copied) throw new Error("copy failed");
  }
}

function downloadSharePage(snapshot: ShareQuestSnapshot) {
  const blob = new Blob([createShareHtml(snapshot)], {
    type: "text/html;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${snapshot.challengeId.toLowerCase()}-passport-quest.html`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function createShareHtml(snapshot: ShareQuestSnapshot): string {
  const directions = snapshot.directionsUrl
    ? `<a class="button" href="${escapeHtml(snapshot.directionsUrl)}" target="_blank" rel="noopener noreferrer">Open Google Maps route</a>`
    : `<span class="button button-muted">Directions pending</span>`;
  const stops = snapshot.stops
    .map(
      (stop) => `
        <li>
          <span class="number">${stop.order}</span>
          <div>
            <h2>${escapeHtml(stop.name)}</h2>
            <p>${escapeHtml(stop.cuisines)}</p>
            <p>${escapeHtml(stop.locationLabel)}</p>
            ${
              stop.addressLine
                ? `<p>${escapeHtml(stop.addressLine)}</p>`
                : ""
            }
            <p class="leg">${escapeHtml(stop.legLabel)}</p>
          </div>
        </li>`,
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(snapshot.trackLabel)} - ${escapeHtml(snapshot.challengeId)}</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #0b0b0b;
      --panel: #171717;
      --line: rgba(255, 255, 255, 0.12);
      --text: #fcfcfc;
      --muted: #ababab;
      --primary: #755bff;
      --primary-soft: #c8bfff;
      --success: #2ce198;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.5;
    }
    main { max-width: 820px; margin: 0 auto; padding: 32px 18px 48px; }
    header {
      border: 1px solid var(--line);
      border-radius: 18px;
      background: linear-gradient(135deg, rgba(117, 91, 255, 0.22), rgba(44, 225, 152, 0.08)), var(--panel);
      padding: 22px;
    }
    .eyebrow { color: var(--primary-soft); font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
    h1 { margin: 6px 0 8px; font-size: clamp(30px, 6vw, 56px); line-height: 0.95; letter-spacing: -0.03em; }
    p { margin: 0; color: var(--muted); }
    .meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(135px, 1fr)); gap: 10px; margin: 18px 0; }
    .meta div { border: 1px solid var(--line); border-radius: 12px; padding: 10px; background: rgba(0, 0, 0, 0.24); }
    .meta span { display: block; color: var(--muted); font-size: 12px; }
    .meta strong { display: block; margin-top: 2px; color: var(--text); }
    .button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 42px;
      border-radius: 999px;
      background: var(--primary);
      color: #000;
      font-weight: 800;
      padding: 0 16px;
      text-decoration: none;
    }
    .button-muted { background: transparent; color: var(--muted); border: 1px solid var(--line); }
    ol { list-style: none; margin: 18px 0 0; padding: 0; display: grid; gap: 12px; }
    li { display: grid; grid-template-columns: 42px 1fr; gap: 12px; border: 1px solid var(--line); border-radius: 16px; background: var(--panel); padding: 14px; }
    .number { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 999px; background: var(--text); color: var(--bg); font-weight: 900; }
    h2 { margin: 0 0 4px; font-size: 18px; }
    .leg { margin-top: 8px; color: var(--success); font-weight: 700; }
    footer { margin-top: 18px; color: var(--muted); font-size: 12px; }
  </style>
</head>
<body>
  <main>
    <header>
      <div class="eyebrow">Passport Quest</div>
      <h1>${escapeHtml(snapshot.trackLabel)}</h1>
      <p>${escapeHtml(snapshot.challengeId)} for ${escapeHtml(snapshot.profileName)}</p>
      <div class="meta">
        <div><span>Stops</span><strong>${snapshot.stopCount}</strong></div>
        <div><span>Window</span><strong>${escapeHtml(snapshot.windowLabel)}</strong></div>
        <div><span>Cadence</span><strong>${escapeHtml(snapshot.cadenceLabel)}</strong></div>
        <div><span>Route</span><strong>${escapeHtml(snapshot.routeDistanceLabel)}, ${escapeHtml(snapshot.routeTimeLabel)}</strong></div>
        <div><span>Reward preview</span><strong>+${snapshot.rewardFly} FLY</strong></div>
        <div><span>Status</span><strong>${snapshot.completed ? "Mock unlocked" : "Armed"}</strong></div>
      </div>
      ${directions}
    </header>
    <ol>${stops}</ol>
    <footer>
      Static share page generated by Passport Quest. No Rewards API issuance is included.
    </footer>
  </main>
</body>
</html>`;
}

function buildRewardFly(
  track: ChallengeTrack,
  stopCount: number,
  minutes: number,
): number {
  const stopBonus = Math.max(0, stopCount - 5) * 10;
  const durationBonus = minutes >= 24 * 60 ? 15 : 0;
  return track.baseFlyReward + stopBonus + durationBonus;
}

function buildMockChallengeId(
  trackId: ChallengeTrackId,
  stopCount: number,
  minutes: number,
  version: number,
): string {
  const trackCode = trackId.slice(0, 3).toUpperCase();
  const windowCode = minutes >= 7 * 24 * 60 ? "WEEK" : `${Math.round(minutes / 60)}H`;
  return `PQ-${trackCode}-${stopCount}-${windowCode}-${String(version).padStart(2, "0")}`;
}

function buildCadenceLabel(stopCount: number, minutes: number): string {
  if (stopCount <= 0 || !Number.isFinite(minutes) || minutes <= 0) {
    return "Open cadence";
  }
  if (minutes >= 7 * 24 * 60) {
    return stopCount >= 7 ? "1 stop/day" : `${stopCount} stops/week`;
  }
  if (minutes >= 24 * 60) {
    const days = minutes / (24 * 60);
    if (days >= stopCount) return "1 stop/day";
    return `${stopCount} stops/${formatMinutes(minutes)}`;
  }
  const minutesPerStop = Math.max(15, Math.round(minutes / stopCount));
  return `Every ${formatMinutes(minutesPerStop)}`;
}

function formatMinutes(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "Time pending";
  if (minutes >= 7 * 24 * 60 && minutes % (7 * 24 * 60) === 0) {
    const weeks = minutes / (7 * 24 * 60);
    return weeks === 1 ? "1 week" : `${weeks} weeks`;
  }
  if (minutes >= 24 * 60 && minutes % (24 * 60) === 0) {
    const days = minutes / (24 * 60);
    return days === 1 ? "1 day" : `${days} days`;
  }
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
  }
  return `${minutes} min`;
}

function distanceKm(
  a: NonNullable<QuestStop["coordinate"]>,
  b: NonNullable<QuestStop["coordinate"]>,
): number {
  const earthRadiusKm = 6371;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function deterministicJitter(id: string, max: number): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return hash % Math.max(1, max);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function TrackIcon({
  icon,
  className = "",
}: {
  icon: ChallengeTrack["icon"];
  className?: string;
}) {
  if (icon === "dice") return <DiceIcon className={className} />;
  if (icon === "glass") return <GlassIcon className={className} />;
  return <CompassIcon className={className} />;
}

function CompassIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" />
      <path
        d="m15.5 8.5-2 5-5 2 2-5 5-2Z"
        fill="currentColor"
      />
    </svg>
  );
}

function DiceIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <rect
        x="4"
        y="4"
        width="16"
        height="16"
        rx="4"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle cx="9" cy="9" r="1.4" fill="currentColor" />
      <circle cx="15" cy="9" r="1.4" fill="currentColor" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" />
      <circle cx="9" cy="15" r="1.4" fill="currentColor" />
      <circle cx="15" cy="15" r="1.4" fill="currentColor" />
    </svg>
  );
}

function GlassIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path
        d="M7 4h10l-1 6a4 4 0 0 1-8 0L7 4Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M12 14v5M9 20h6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MapPinIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path
        d="M12 21s7-5.1 7-11a7 7 0 1 0-14 0c0 5.9 7 11 7 11Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="2.5" fill="currentColor" />
    </svg>
  );
}

function RefreshIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path
        d="M20 12a8 8 0 1 1-2.34-5.66"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M20 4v6h-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RouteIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path
        d="M6 19a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM18 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M8.5 14.5 15.5 9.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path
        d="M20 6 9 17l-5-5"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ShareIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path
        d="M8.5 13.5 15.5 17.5M15.5 6.5 8.5 10.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
      <circle cx="6.5" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
      <circle cx="17.5" cy="5.5" r="3" stroke="currentColor" strokeWidth="2" />
      <circle cx="17.5" cy="18.5" r="3" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function CopyIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <rect
        x="8"
        y="8"
        width="11"
        height="11"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M5 15V7a2 2 0 0 1 2-2h8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function DownloadIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path
        d="M12 4v10M8 10l4 4 4-4M5 19h14"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}
