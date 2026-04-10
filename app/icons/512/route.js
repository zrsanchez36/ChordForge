import { createIconResponse } from "@/lib/chordforge-icon";

export async function GET() {
  return createIconResponse(512);
}
