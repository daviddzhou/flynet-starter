import { decodeShareSnapshot } from "../../lib/share";
import { SharePageClient } from "./share-page-client";

type SharePageProps = {
  searchParams: Promise<{
    id?: string | string[];
    q?: string | string[];
  }>;
};

export default async function SharePage({ searchParams }: SharePageProps) {
  const params = await searchParams;
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const encoded = Array.isArray(params.q) ? params.q[0] : params.q;
  const snapshot = decodeShareSnapshot(encoded);

  return (
    <SharePageClient
      encoded={encoded ?? null}
      id={id ?? null}
      initialSnapshot={snapshot}
    />
  );
}
