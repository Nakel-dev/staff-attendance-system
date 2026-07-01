"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  MoreHorizontal,
  Pencil,
  Search,
  Trash2,
  UserCheck,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DEPARTMENTS } from "@/constants";
import { deactivateStaff, toggleStaffStatus } from "@/lib/actions/staff";
import { formatDate, getInitials } from "@/lib/utils/formatDate";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Profile } from "@/lib/types";

const PAGE_SIZE = 10;

interface StaffTableProps {
  staff: (Profile & { avatarDisplayUrl?: string })[];
}

export function StaffTable({ staff }: StaffTableProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("all");
  const [role, setRole] = useState("all");
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return staff.filter((member) => {
      const matchesSearch =
        !query ||
        member.full_name.toLowerCase().includes(query) ||
        member.email.toLowerCase().includes(query) ||
        member.department.toLowerCase().includes(query);
      const matchesDepartment = department === "all" || member.department === department;
      const matchesRole = role === "all" || member.role === role;
      return matchesSearch && matchesDepartment && matchesRole;
    });
  }, [staff, search, department, role]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleToggleActive = async (member: Profile) => {
    setTogglingId(member.id);
    const result = await toggleStaffStatus(member.id, !member.is_active);
    setTogglingId(null);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(
      member.is_active
        ? `${member.full_name} has been deactivated`
        : `${member.full_name} has been activated`
    );
    router.refresh();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    const result = await deactivateStaff(deleteTarget.id);
    setIsDeleting(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(`${deleteTarget.full_name} has been deactivated`);
    setDeleteTarget(null);
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or department..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <Select
          value={department}
          onValueChange={(value) => {
            setDepartment(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {DEPARTMENTS.map((dept) => (
              <SelectItem key={dept} value={dept}>
                {dept}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={role}
          onValueChange={(value) => {
            setRole(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="staff">Staff</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]" />
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="w-[70px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  No staff members found.
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={member.avatarDisplayUrl || member.avatar_url} alt={member.full_name} />
                      <AvatarFallback>{getInitials(member.full_name)}</AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell className="font-medium">{member.full_name}</TableCell>
                  <TableCell>{member.email}</TableCell>
                  <TableCell>{member.department}</TableCell>
                  <TableCell>
                    <Badge variant={member.role === "admin" ? "default" : "secondary"}>
                      {member.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={member.is_active ? "success" : "danger"}>
                      {member.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(member.date_joined)}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Open menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/staff/${member.id}`}>
                            <Eye className="mr-2 h-4 w-4" />
                            View
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/staff/${member.id}`}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={togglingId === member.id}
                          onClick={() => handleToggleActive(member)}
                        >
                          {member.is_active ? (
                            <>
                              <UserX className="mr-2 h-4 w-4" />
                              Deactivate
                            </>
                          ) : (
                            <>
                              <UserCheck className="mr-2 h-4 w-4" />
                              Activate
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeleteTarget(member)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1}–
          {Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate staff member?</AlertDialogTitle>
            <AlertDialogDescription>
              This will deactivate {deleteTarget?.full_name}&apos;s account. They will no longer be
              able to sign in.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
