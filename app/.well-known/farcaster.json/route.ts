import { withValidManifest } from "@coinbase/onchainkit/minikit";
import { minikitConfig } from "../../../minikit.config";

export async function GET() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return Response.json(withValidManifest(minikitConfig as any));
}
