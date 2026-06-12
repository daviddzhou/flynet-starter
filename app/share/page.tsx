import type { Metadata } from "next";
import { decodeShareSnapshot, type ShareQuestSnapshot } from "../../lib/share";
import {
  buildShareDescription,
  buildShareImageUrl,
  buildShareTitle,
  getShareSiteUrl,
} from "../../lib/share-meta";
import { getStoredShareSnapshot } from "../../lib/share-store";
import { SharePageClient } from "./share-page-client";

type SharePageProps = {
  searchParams: Promise<{
    id?: string | string[];
    q?: string | string[];
  }>;
};

export async function generateMetadata({
  searchParams,
}: SharePageProps): Promise<Metadata> {
  const params = await searchParams;
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const encoded = Array.isArray(params.q) ? params.q[0] : params.q;
  const snapshot = resolveShareSnapshot({ encoded, id });
  const siteUrl = getShareSiteUrl();
  const title = buildShareTitle(snapshot);
  const description = buildShareDescription(snapshot);
  const imageUrl = buildShareImageUrl(snapshot, siteUrl);
  const pageUrl = new URL("/share", siteUrl);

  if (id) pageUrl.searchParams.set("id", id);
  if (encoded) pageUrl.searchParams.set("q", encoded);

  return {
    title,
    description,
    alternates: {
      canonical: pageUrl.toString(),
    },
    openGraph: {
      title,
      description,
      images: [
        {
          alt: title,
          height: 630,
          url: imageUrl,
          width: 1200,
        },
      ],
      siteName: "Passport Quest",
      type: "website",
      url: pageUrl.toString(),
    },
    twitter: {
      card: "summary_large_image",
      description,
      images: [imageUrl],
      title,
    },
  };
}

export default async function SharePage({ searchParams }: SharePageProps) {
  const params = await searchParams;
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const encoded = Array.isArray(params.q) ? params.q[0] : params.q;
  const snapshot = resolveShareSnapshot({ encoded, id });

  return (
    <SharePageClient
      encoded={encoded ?? null}
      id={id ?? null}
      initialSnapshot={snapshot}
    />
  );
}

function resolveShareSnapshot({
  encoded,
  id,
}: {
  encoded?: string;
  id?: string;
}): ShareQuestSnapshot | null {
  return decodeShareSnapshot(encoded) ?? (id ? getStoredShareSnapshot(id) : null);
}
