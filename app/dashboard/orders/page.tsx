"use client";

import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  RowSelectionState,
} from '@tanstack/react-table';
import { ArrowUpDown, ChevronDown, MoreHorizontal, Sync, Eye, Package, Truck, CheckCircle, XCircle, Clock, Download, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

import { Order, OrdersAPI, OrdersQuery } from '@/lib/api/orders';
import { useDebounce } from '@/hooks/use-debounce';

// Status components
const StatusIcon = ({ status }: { status: string }) => {
  const icons = {
    pending: <Clock className="h-4 w-4 text-yellow-500" />,
    processing: <Package className="h-4 w-4 text-blue-500" />,
    shipped: <Truck className="h-4 w-4 text-purple-500" />,
    delivered: <CheckCircle className="h-4 w-4 text-green-500" />,
    cancelled: <XCircle className="h-4 w-4 text-red-500" />,
    refunded: <RefreshCw className="h-4 w-4 text-gray-500" />,
  };

  return icons[status as keyof typeof icons] || <Clock className="h-4 w-4 text-gray-500" />;
};

const StatusBadge = ({ status }: { status: string }) => {
  const variants: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    pending: { label: 'Pending', variant: 'outline' },
    processing: { label: 'Processing', variant: 'default' },
    shipped: { label: 'Shipped', variant: 'secondary' },
    delivered: { label: 'Delivered', variant: 'default' },
    cancelled: { label: 'Cancelled', variant: 'destructive' },
    refunded: { label: 'Refunded', variant: 'outline' },
  };

  const config = variants[status] || variants.pending;

  return (
    <div className="flex items-center gap-2">
      <StatusIcon status={status} />
      <Badge variant={config.variant}>{config.label}</Badge>
    </div>
  );
};

// Order table columns
const columns: ColumnDef<Order>[] = [
  {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && 'indeterminate')
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'orderNumber',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        Order #
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <div className="font-mono text-sm">{row.getValue('orderNumber')}</div>
    ),
  },
  {
    accessorKey: 'customerName',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        Customer
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <div>
        <div className="font-medium">{row.getValue('customerName')}</div>
        {row.original.customerEmail && (
          <div className="text-sm text-gray-500">{row.original.customerEmail}</div>
        )}
      </div>
    ),
  },
  {
    accessorKey: 'platformId',
    header: 'Platform',
    cell: ({ row }) => {
      const platform = row.getValue('platformId') as string;
      return (
        <Badge variant="outline" className="capitalize">
          {platform.replace('-', ' ')}
        </Badge>
      );
    },
  },
  {
    accessorKey: 'total',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        Total
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const total = parseFloat(row.getValue('total'));
      const currency = row.original.currency;

      return (
        <div className="text-right font-medium">
          {currency} {total.toFixed(2)}
        </div>
      );
    },
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.getValue('status') as string;
      return <StatusBadge status={status} />;
    },
  },
  {
    accessorKey: 'fulfillmentStatus',
    header: 'Fulfillment',
    cell: ({ row }) => {
      const status = row.getValue('fulfillmentStatus') as string;
      const variants: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
        unfulfilled: { label: 'Unfulfilled', variant: 'outline' },
        partial: { label: 'Partial', variant: 'secondary' },
        fulfilled: { label: 'Fulfilled', variant: 'default' },
      };

      const config = variants[status] || variants.unfulfilled;
      return <Badge variant={config.variant}>{config.label}</Badge>;
    },
  },
  {
    accessorKey: 'orderDate',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        Order Date
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const orderDate = row.getValue('orderDate') as string;
      return (
        <div className="text-sm">
          {format(new Date(orderDate), 'MMM d, yyyy')}
          <div className="text-gray-500">
            {format(new Date(orderDate), 'HH:mm')}
          </div>
        </div>
      );
    },
  },
  {
    id: 'actions',
    enableHiding: false,
    cell: ({ row }) => {
      const order = row.original;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuItem>
            <OrderDetailsDrawer order={order} />
            <DropdownMenuItem
              onClick={() => navigator.clipboard.writeText(order.orderNumber)}
            >
              Copy order number
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Package className="mr-2 h-4 w-4" />
              Update fulfillment
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Truck className="mr-2 h-4 w-4" />
              Add tracking
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Download className="mr-2 h-4 w-4" />
              Export order
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];

// Order Details Drawer Component
function OrderDetailsDrawer({ order }: { order: Order }) {
  const [details, setDetails] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const loadOrderDetails = async () => {
    try {
      setLoading(true);
      const orderDetails = await OrdersAPI.getOrder(order.id);
      setDetails(orderDetails);
    } catch (error) {
      toast.error('Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
          <Eye className="mr-2 h-4 w-4" />
          View details
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Order Details - {order.orderNumber}</DialogTitle>
          <DialogDescription>
            Order from {format(new Date(order.orderDate), 'PPP')}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))}
          </div>
        ) : details ? (
          <div className="space-y-6">
            {/* Order Status */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <h4 className="text-sm font-medium text-gray-500">Order Status</h4>
                <StatusBadge status={details.order.status} />
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-500">Payment Status</h4>
                <Badge variant={details.order.paymentStatus === 'paid' ? 'default' : 'outline'}>
                  {details.order.paymentStatus}
                </Badge>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-500">Fulfillment Status</h4>
                <Badge variant={details.order.fulfillmentStatus === 'fulfilled' ? 'default' : 'outline'}>
                  {details.order.fulfillmentStatus}
                </Badge>
              </div>
            </div>

            <Separator />

            {/* Customer Information */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Customer Information</h3>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-2">Contact</h4>
                  <p className="font-medium">{details.order.customerName}</p>
                  {details.order.customerEmail && (
                    <p className="text-sm text-gray-600">{details.order.customerEmail}</p>
                  )}
                  {details.order.customerPhone && (
                    <p className="text-sm text-gray-600">{details.order.customerPhone}</p>
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-2">Shipping Address</h4>
                  {details.order.shippingAddress && (
                    <div className="text-sm">
                      <p className="font-medium">{details.order.shippingAddress.name}</p>
                      <p>{details.order.shippingAddress.address1}</p>
                      {details.order.shippingAddress.address2 && (
                        <p>{details.order.shippingAddress.address2}</p>
                      )}
                      <p>
                        {details.order.shippingAddress.city}, {details.order.shippingAddress.province} {details.order.shippingAddress.postalCode}
                      </p>
                      <p>{details.order.shippingAddress.country}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* Order Items */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Order Items</h3>
              <div className="space-y-4">
                {details.items.map((item: any) => (
                  <div key={item.id} className="flex items-center space-x-4">
                    {item.productImage && (
                      <img
                        src={item.productImage}
                        alt={item.productTitle}
                        className="w-16 h-16 object-cover rounded-lg"
                      />
                    )}
                    <div className="flex-1">
                      <p className="font-medium">{item.productTitle}</p>
                      {item.variantTitle && (
                        <p className="text-sm text-gray-500">{item.variantTitle}</p>
                      )}
                      {item.productSku && (
                        <p className="text-sm text-gray-500">SKU: {item.productSku}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{order.currency} {parseFloat(item.unitPrice).toFixed(2)}</p>
                      <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                      <p className="font-semibold">{order.currency} {parseFloat(item.total).toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Order Summary */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Order Summary</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{order.currency} {parseFloat(details.order.subtotal).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax</span>
                  <span>{order.currency} {parseFloat(details.order.tax).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Shipping</span>
                  <span>{order.currency} {parseFloat(details.order.shipping).toFixed(2)}</span>
                </div>
                {parseFloat(details.order.discount) > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span>
                    <span>-{order.currency} {parseFloat(details.order.discount).toFixed(2)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-lg font-semibold">
                  <span>Total</span>
                  <span>{order.currency} {parseFloat(details.order.total).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            {(details.order.notes || details.order.customerNotes) && (
              <>
                <Separator />
                <div>
                  <h3 className="text-lg font-semibold mb-4">Notes</h3>
                  {details.order.notes && (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-500 mb-1">Internal Notes</h4>
                      <p className="text-sm">{details.order.notes}</p>
                    </div>
                  )}
                  {details.order.customerNotes && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-1">Customer Notes</h4>
                      <p className="text-sm">{details.order.customerNotes}</p>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Tracking Information */}
            {details.order.trackingNumbers && details.order.trackingNumbers.length > 0 && (
              <>
                <Separator />
                <div>
                  <h3 className="text-lg font-semibold mb-4">Tracking Information</h3>
                  <div className="space-y-2">
                    {details.order.trackingNumbers.map((trackingNumber: string, index: number) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="font-mono text-sm">{trackingNumber}</span>
                        <Button variant="outline" size="sm">
                          Track
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <Button onClick={loadOrderDetails}>Load Order Details</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function OrdersPage() {
  const [data, setData] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rowCount, setRowCount] = useState(0);

  // Table state
  const [sorting, setSorting] = useState<SortingState>([{ id: 'orderDate', desc: true }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 20,
  });

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch] = useDebounce(searchQuery, 300);
  const [platformFilter, setPlatformFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Sync state
  const [syncing, setSyncing] = useState(false);
  const [syncingPlatform, setSyncingPlatform] = useState<string>('');
  const [platforms, setPlatforms] = useState<any[]>([]);

  // Load platforms on mount
  useEffect(() => {
    const loadPlatforms = async () => {
      try {
        const platformsData = await OrdersAPI.getPlatforms();
        setPlatforms(platformsData.filter(p => p.isActive));
      } catch (err) {
        console.error('Failed to load platforms:', err);
      }
    };

    loadPlatforms();
  }, []);

  // Load orders
  const loadOrders = async (pageIndex: number = pagination.pageIndex) => {
    try {
      setLoading(true);
      setError(null);

      const query: OrdersQuery = {
        page: pageIndex + 1,
        limit: pagination.pageSize,
        search: debouncedSearch || undefined,
        platformId: platformFilter || undefined,
        status: statusFilter as any || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        sortBy: (sorting[0]?.id as any) || 'orderDate',
        sortOrder: sorting[0]?.desc ? 'desc' : 'asc',
      };

      const response = await OrdersAPI.getOrders(query);

      setData(response.data);
      setRowCount(response.pagination.totalItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load orders');
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  // Auto-load orders when dependencies change
  useEffect(() => {
    loadOrders();
  }, [debouncedSearch, platformFilter, statusFilter, startDate, endDate, sorting, pagination.pageIndex, pagination.pageSize]);

  // Sync orders
  const handleSync = async (platformId: string) => {
    try {
      setSyncing(true);
      setSyncingPlatform(platformId);

      const result = await OrdersAPI.syncOrders(platformId, {
        page: 1,
        limit: 50,
        force: true,
      });

      toast.success(`${platformId} order sync started successfully`);

      // Reload orders after a delay
      setTimeout(() => {
        loadOrders();
      }, 2000);

    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
      setSyncingPlatform('');
    }
  };

  // Export orders
  const handleExport = async () => {
    try {
      const query: OrdersQuery = {
        page: 1,
        limit: 1000, // Export more records
        search: debouncedSearch || undefined,
        platformId: platformFilter || undefined,
        status: statusFilter as any || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        sortBy: (sorting[0]?.id as any) || 'orderDate',
        sortOrder: sorting[0]?.desc ? 'desc' : 'asc',
      };

      const blob = await OrdersAPI.exportOrders(query);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `orders-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Orders exported successfully');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed');
    }
  };

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    rowCount,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      pagination,
    },
  });

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Orders</h2>
          <p className="text-muted-foreground">
            Manage your orders across all platforms
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <Sync className="mr-2 h-4 w-4" />
                Sync Orders
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {platforms.map((platform) => (
                <DropdownMenuItem
                  key={platform.id}
                  onClick={() => handleSync(platform.id)}
                  disabled={syncing && syncingPlatform === platform.id}
                >
                  <Sync className="mr-2 h-4 w-4" />
                  Sync {platform.displayName}
                  {syncing && syncingPlatform === platform.id && '...'}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Search orders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <Select value={platformFilter} onValueChange={setPlatformFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All platforms" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All platforms</SelectItem>
                {platforms.map((platform) => (
                  <SelectItem key={platform.id} value={platform.id}>
                    {platform.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="shipped">Shipped</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
              </SelectContent>
            </Select>

            <Input
              type="date"
              placeholder="Start date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-[150px]"
            />

            <Input
              type="date"
              placeholder="End date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-[150px]"
            />
          </div>
        </CardContent>
      </Card>

      {/* Error State */}
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Orders ({rowCount})</CardTitle>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <ChevronDown className="mr-2 h-4 w-4" />
                  Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {table
                  .getAllColumns()
                  .filter((column) => column.getCanHide())
                  .map((column) => {
                    return (
                      <DropdownMenuCheckboxItem
                        key={column.id}
                        className="capitalize"
                        checked={column.getIsVisible()}
                        onCheckedChange={(value) =>
                          column.toggleVisibility(!!value)
                        }
                      >
                        {column.id}
                      </DropdownMenuCheckboxItem>
                    );
                  })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-8 w-32" />
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <TableHead key={header.id}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows?.length ? (
                    table.getRowModel().rows.map((row) => (
                      <TableRow
                        key={row.id}
                        data-state={row.getIsSelected() && 'selected'}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={columns.length}
                        className="h-24 text-center"
                      >
                        No orders found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          <div className="flex items-center justify-between space-x-2 py-4">
            <div className="flex-1 text-sm text-muted-foreground">
              {table.getFilteredSelectedRowModel().rows.length} of{' '}
              {table.getFilteredRowModel().rows.length} row(s) selected.
            </div>
            <div className="flex items-center space-x-2">
              <p className="text-sm font-medium">
                Page {table.getState().pagination.pageIndex + 1} of{' '}
                {table.getPageCount()}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}