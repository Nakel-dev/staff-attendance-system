export const KIOSK_SESSION_COOKIE = "kiosk_session";
export const KIOSK_ID_COOKIE = "kiosk_id";
export const KIOSK_SESSION_TTL_HOURS = 12;
export const FACE_ANGLES = ["front", "left", "right", "up", "down"] as const;
export type FaceAngle = (typeof FACE_ANGLES)[number];

export const FACE_ANGLE_PROMPTS: Record<FaceAngle, string> = {
  front: "Look straight at the camera",
  left: "Slowly turn your head to the left",
  right: "Slowly turn your head to the right",
  up: "Tilt your head up slightly",
  down: "Tilt your head down slightly",
};

export function shuffleAngles(): FaceAngle[] {
  const angles = [...FACE_ANGLES];
  for (let i = angles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [angles[i], angles[j]] = [angles[j], angles[i]];
  }
  return angles;
}
