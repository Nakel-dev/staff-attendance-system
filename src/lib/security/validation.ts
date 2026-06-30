import { z } from "zod";

export const checkInInputSchema = z.object({
  latitude: z.number().finite().optional(),
  longitude: z.number().finite().optional(),
  photoPath: z.string().max(500).optional(),
  videoPath: z.string().max(500).optional(),
  qrToken: z.string().max(12).optional(),
  faceDescriptor: z.array(z.number().finite()).length(128).optional(),
  frameDescriptors: z.array(z.array(z.number().finite()).length(128)).min(8).max(20).optional(),
  motionScore: z.number().finite().min(0).max(1).optional(),
});

export const faceEnrollmentSchema = z.object({
  descriptor: z.array(z.number().finite()).length(128),
  referencePhotoPath: z.string().max(500).optional(),
  referenceVideoPath: z.string().max(500).optional(),
  motionScore: z.number().finite().min(0).max(1),
  frameDescriptors: z.array(z.array(z.number().finite()).length(128)).min(8).max(20),
});

export const attendanceSecuritySchema = z.object({
  attendanceMode: z.enum(["trust", "standard", "strict", "admin_only"]),
  officeLatitude: z.number().finite().nullable(),
  officeLongitude: z.number().finite().nullable(),
  geofenceRadiusM: z.number().int().min(50).max(5000),
});

export const signInSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
});

export function parseInput<T>(schema: z.ZodSchema<T>, input: unknown): T {
  return schema.parse(input);
}
