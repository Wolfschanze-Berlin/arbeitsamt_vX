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

type Product = {
  id: number;
  name: string;
  variants: string;
  category: string;
  price: string;
  status: "Delivered" | "Pending" | "Canceled";
  image: string;
};

const products: Product[] = [
  { id: 1, name: 'MacBook Pro 13"', variants: "2 Variants", category: "Laptop", price: "$2,399.00", status: "Delivered", image: "/images/product/product-01.jpg" },
  { id: 2, name: "Apple Watch Ultra", variants: "1 Variant", category: "Watch", price: "$879.00", status: "Pending", image: "/images/product/product-02.jpg" },
  { id: 3, name: "iPhone 15 Pro Max", variants: "2 Variants", category: "SmartPhone", price: "$1,869.00", status: "Delivered", image: "/images/product/product-03.jpg" },
  { id: 4, name: "iPad Pro 3rd Gen", variants: "2 Variants", category: "Electronics", price: "$1,699.00", status: "Canceled", image: "/images/product/product-04.jpg" },
  { id: 5, name: "AirPods Pro 2nd Gen", variants: "1 Variant", category: "Accessories", price: "$240.00", status: "Delivered", image: "/images/product/product-05.jpg" },
];

const statusVariant = {
  Delivered: "default",
  Pending: "secondary",
  Canceled: "destructive",
} as const;

export function RecentOrdersTable() {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card px-4 pb-3 pt-4 sm:px-6">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-semibold">Recent Orders</h3>
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
              <TableHead>Products</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="size-[50px] overflow-hidden rounded-md">
                      <img
                        src={product.image}
                        alt={product.name}
                        className="size-[50px] object-cover"
                      />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{product.name}</p>
                      <span className="text-xs text-muted-foreground">
                        {product.variants}
                      </span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {product.category}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {product.price}
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant[product.status]}>
                    {product.status}
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
