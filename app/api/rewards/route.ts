import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    configured: true,
    mode: "preview",
    message:
      "Passport Quest shows a simulated Rewards API unlock. No FLY is moved.",
  });
}

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Rewards issuance is disabled in this demo. Use merchant-side confirmation before enabling live FLY rewards.",
    },
    { status: 409 },
  );
}
