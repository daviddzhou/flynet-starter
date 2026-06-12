import { NextResponse } from "next/server";

import { isShareSnapshot } from "../../../lib/share";
import {
  getStoredShareSnapshot,
  storeShareSnapshot,
} from "../../../lib/share-store";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const snapshot =
    body && typeof body === "object" && "snapshot" in body
      ? (body as { snapshot?: unknown }).snapshot
      : body;

  if (!isShareSnapshot(snapshot)) {
    return NextResponse.json(
      { error: "Invalid share snapshot" },
      { status: 400 },
    );
  }

  return NextResponse.json(storeShareSnapshot(snapshot));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const snapshot = id ? getStoredShareSnapshot(id) : null;

  if (!snapshot) {
    return NextResponse.json({ error: "Share not found" }, { status: 404 });
  }

  return NextResponse.json({ snapshot });
}
