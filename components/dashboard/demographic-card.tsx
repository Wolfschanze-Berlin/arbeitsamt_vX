"use client";

import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type CountryData = {
  name: string;
  flag: string;
  customers: number;
  percentage: number;
};

const countries: CountryData[] = [
  { name: "Berlin", flag: "/images/country/country-03.svg", customers: 2379, percentage: 79 },
  { name: "Bayern", flag: "/images/country/country-03.svg", customers: 589, percentage: 23 },
  { name: "NRW", flag: "/images/country/country-03.svg", customers: 410, percentage: 15 },
  { name: "Hamburg", flag: "/images/country/country-03.svg", customers: 312, percentage: 11 },
];

export function DemographicCard() {
  return (
    <div className="rounded-2xl border bg-card p-5 sm:p-6">
      <div className="flex justify-between">
        <div>
          <h3 className="text-lg font-semibold">Applicant Demographic</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Number of applicants based on region
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8">
              <MoreHorizontal className="size-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>View More</DropdownMenuItem>
            <DropdownMenuItem>Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Placeholder for map */}
      <div className="my-6 flex h-[212px] items-center justify-center rounded-2xl border bg-muted">
        <span className="text-sm text-muted-foreground">World Map Placeholder</span>
      </div>

      <div className="space-y-5">
        {countries.map((country) => (
          <CountryRow key={country.name} {...country} />
        ))}
      </div>
    </div>
  );
}

function CountryRow({ name, flag, customers, percentage }: CountryData) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <img src={flag} alt={name} className="size-8 rounded-full" />
        <div>
          <p className="text-sm font-semibold">{name}</p>
          <span className="text-xs text-muted-foreground">
            {customers.toLocaleString()} Applicants
          </span>
        </div>
      </div>
      <div className="flex w-full max-w-[140px] items-center gap-3">
        <Progress value={percentage} className="h-2" />
        <p className="text-sm font-medium">{percentage}%</p>
      </div>
    </div>
  );
}
