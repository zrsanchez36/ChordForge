import { createIconResponse } from "@/lib/chordforge-icon";

export const size = {
  width: 512,
  height: 512,
};

export const contentType = "image/png";

export default function Icon() {
  return createIconResponse(512);
}
