import { CalendarDays, Camera, User } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function StaffPortalQuickLinks() {
  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Staff portal shortcuts</CardTitle>
        <CardDescription>
          Upload your profile photo for kiosk check-in, then view leave requests. Open these links if
          a menu tab looks blank.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col sm:flex-row gap-2">
        <a
          href="/profile"
          className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Camera className="h-4 w-4" />
          Profile photo
        </a>
        <a
          href="/profile"
          className="inline-flex items-center justify-center gap-2 rounded-md border bg-background px-4 py-2.5 text-sm font-medium hover:bg-accent"
        >
          <User className="h-4 w-4" />
          My Profile
        </a>
        <a
          href="/my-leaves"
          className="inline-flex items-center justify-center gap-2 rounded-md border bg-background px-4 py-2.5 text-sm font-medium hover:bg-accent"
        >
          <CalendarDays className="h-4 w-4" />
          My Leaves
        </a>
      </CardContent>
    </Card>
  );
}
