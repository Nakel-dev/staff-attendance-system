import type { AttendanceMode } from "@/lib/types";

export interface OrganizationSecurityConfig {
  attendance_mode?: string | null;
  require_video_verification?: boolean | null;
  require_face_match?: boolean | null;
  require_geofence?: boolean | null;
  require_qr_code?: boolean | null;
  office_latitude?: number | null;
  office_longitude?: number | null;
  geofence_radius_m?: number | null;
}

export interface ResolvedCheckInPolicy {
  mode: AttendanceMode;
  geofenceRadiusM: number;
  hasOfficeLocation: boolean;
  requiresVideo: boolean;
  requiresQr: boolean;
  requiresFaceMatch: boolean;
  requiresGeofence: boolean;
  selfCheckInEnabled: boolean;
  officeConfiguredForSecureMode: boolean;
}

function modeDefaults(mode: AttendanceMode) {
  switch (mode) {
    case "admin_only":
      return {
        requiresVideo: false,
        requiresFaceMatch: false,
        requiresGeofence: false,
        requiresQr: false,
        selfCheckInEnabled: false,
      };
    case "strict":
      return {
        requiresVideo: true,
        requiresFaceMatch: true,
        requiresGeofence: true,
        requiresQr: true,
        selfCheckInEnabled: true,
      };
    case "standard":
      return {
        requiresVideo: true,
        requiresFaceMatch: true,
        requiresGeofence: true,
        requiresQr: false,
        selfCheckInEnabled: true,
      };
    default:
      return {
        requiresVideo: false,
        requiresFaceMatch: false,
        requiresGeofence: false,
        requiresQr: false,
        selfCheckInEnabled: true,
      };
  }
}

export function resolveCheckInPolicy(org: OrganizationSecurityConfig): ResolvedCheckInPolicy {
  const mode = (org.attendance_mode || "standard") as AttendanceMode;
  const defaults = modeDefaults(mode);
  const hasOfficeLocation =
    org.office_latitude != null && org.office_longitude != null;
  const usesToggles =
    org.require_video_verification != null ||
    org.require_face_match != null ||
    org.require_geofence != null ||
    org.require_qr_code != null;

  const requiresVideo = usesToggles
    ? org.require_video_verification ?? defaults.requiresVideo
    : defaults.requiresVideo;
  const requiresFaceMatch = usesToggles
    ? org.require_face_match ?? defaults.requiresFaceMatch
    : defaults.requiresFaceMatch;
  const requiresGeofence = usesToggles
    ? org.require_geofence ?? defaults.requiresGeofence
    : defaults.requiresGeofence;
  const requiresQr = usesToggles
    ? org.require_qr_code ?? defaults.requiresQr
    : defaults.requiresQr;

  const needsOffice = requiresGeofence || requiresQr;

  return {
    mode,
    geofenceRadiusM: org.geofence_radius_m ?? 150,
    hasOfficeLocation,
    requiresVideo,
    requiresQr,
    requiresFaceMatch,
    requiresGeofence,
    selfCheckInEnabled: defaults.selfCheckInEnabled,
    officeConfiguredForSecureMode:
      !defaults.selfCheckInEnabled || !needsOffice || hasOfficeLocation,
  };
}

export function presetTogglesForMode(mode: AttendanceMode) {
  const defaults = modeDefaults(mode);
  return {
    requireVideoVerification: defaults.requiresVideo,
    requireFaceMatch: defaults.requiresFaceMatch,
    requireGeofence: defaults.requiresGeofence,
    requireQrCode: defaults.requiresQr,
  };
}
