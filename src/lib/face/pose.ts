import type { FaceAngle } from "@/lib/kiosk/constants";

export interface HeadPose {
  yaw: number;
  pitch: number;
}

export function estimateHeadPose(landmarks: {
  positions: Array<{ x: number; y: number }>;
}): HeadPose {
  const pts = landmarks.positions;
  if (pts.length < 68) return { yaw: 0, pitch: 0 };

  const nose = pts[30];
  const leftEyeOuter = pts[36];
  const rightEyeOuter = pts[45];
  const chin = pts[8];
  const forehead = pts[27];

  const eyeCenterX = (leftEyeOuter.x + rightEyeOuter.x) / 2;
  const eyeCenterY = (leftEyeOuter.y + rightEyeOuter.y) / 2;
  const faceWidth = Math.max(Math.abs(rightEyeOuter.x - leftEyeOuter.x), 1);
  const faceHeight = Math.max(Math.abs(chin.y - forehead.y), 1);

  const yaw = (nose.x - eyeCenterX) / faceWidth;
  const pitch = (nose.y - (eyeCenterY + faceHeight * 0.15)) / faceHeight;

  return { yaw, pitch };
}

export function matchesTargetAngle(pose: HeadPose, angle: FaceAngle): boolean {
  switch (angle) {
    case "front":
      return Math.abs(pose.yaw) < 0.1 && Math.abs(pose.pitch) < 0.12;
    case "left":
      return pose.yaw > 0.14 && Math.abs(pose.pitch) < 0.18;
    case "right":
      return pose.yaw < -0.14 && Math.abs(pose.pitch) < 0.18;
    case "up":
      return pose.pitch < -0.1 && Math.abs(pose.yaw) < 0.14;
    case "down":
      return pose.pitch > 0.1 && Math.abs(pose.yaw) < 0.14;
    default:
      return false;
  }
}
