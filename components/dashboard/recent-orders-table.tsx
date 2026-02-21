"use client";

import { Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Application = {
  id: number;
  applicant: string;
  role: string;
  department: string;
  date: string;
  status: "Approved" | "Pending" | "Rejected";
  image: string;
};

const applications: Application[] = [
  { id: 1, applicant: "Anna Müller", role: "Software Engineer", department: "Engineering", date: "2026-02-18", status: "Approved", image: "/images/user/user-01.jpg" },
  { id: 2, applicant: "Thomas Weber", role: "Product Manager", department: "Product", date: "2026-02-17", status: "Pending", image: "/images/user/user-02.jpg" },
  { id: 3, applicant: "Sarah Klein", role: "Data Analyst", department: "Analytics", date: "2026-02-16", status: "Approved", image: "/images/user/user-03.jpg" },
  { id: 4, applicant: "Max Fischer", role: "UX Designer", department: "Design", date: "2026-02-15", status: "Rejected", image: "/images/user/user-04.jpg" },
  { id: 5, applicant: "Lena Schmidt", role: "DevOps Engineer", department: "Infrastructure", date: "2026-02-14", status: "Approved", image: "/images/user/user-05.jpg" },
];

const statusVariant = {
  Approved: "default",
  Pending: "secondary",
  Rejected: "destructive",
} as const;

export function RecentOrdersTable() {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card px-4 pb-3 pt-4 sm:px-6">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-semibold">Recent Applications</h3>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="size-4" />
            Filter
          </Button>
          <Button variant="outline" size="sm">
            See all
          </Button>
        </div>
      </div>
      <div className="max-w-full overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Applicant</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {applications.map((app) => (
              <TableRow key={app.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="size-[50px] overflow-hidden rounded-full">
                      <img
                        src={app.image}
                        alt={app.applicant}
                        className="size-[50px] object-cover"
                      />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{app.applicant}</p>
                      <span className="text-xs text-muted-foreground">
                        {app.role}
                      </span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {app.department}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {app.date}
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant[app.status]}>
                    {app.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
