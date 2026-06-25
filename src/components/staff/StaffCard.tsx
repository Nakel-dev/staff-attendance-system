import { Mail, Phone, Building2, Calendar, Shield } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatDate, getInitials } from "@/lib/utils/formatDate";
import type { Profile } from "@/lib/types";

interface StaffCardProps {
  profile: Profile;
}

export function StaffCard({ profile }: StaffCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-4 space-y-0 pb-4">
        <Avatar className="h-16 w-16">
          <AvatarImage src={profile.avatar_url} alt={profile.full_name} />
          <AvatarFallback className="text-lg">{getInitials(profile.full_name)}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <CardTitle className="text-xl truncate">{profile.full_name}</CardTitle>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Badge variant={profile.role === "admin" ? "default" : "secondary"}>
              <Shield className="mr-1 h-3 w-3" />
              {profile.role}
            </Badge>
            <Badge variant={profile.is_active ? "success" : "danger"}>
              {profile.is_active ? "Active" : "Inactive"}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <Separator />
      <CardContent className="pt-4 space-y-4">
        <div className="flex items-center gap-3 text-sm">
          <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="truncate">{profile.email}</span>
        </div>
        {profile.phone && (
          <div className="flex items-center gap-3 text-sm">
            <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
            <span>{profile.phone}</span>
          </div>
        )}
        <div className="flex items-center gap-3 text-sm">
          <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
          <span>{profile.department}</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
          <span>Joined {formatDate(profile.date_joined)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
