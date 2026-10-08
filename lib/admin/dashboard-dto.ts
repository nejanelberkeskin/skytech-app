/** Genel Bakış yalnız izin verilen metrikleri taşır; eksik alan sıfır değildir. */
export interface DashboardKpis {
  netRevenueKurus?: number;
  orderCount?: number;
  releasedQuantity?: number;
  pendingRefunds?: number;
  pendingDuplicateRefunds?: number;
  overdueRefunds?: number;
  pendingInvoices?: number;
  awaitingBatch?: number;
  publicSites?: number;
  freeCapacity?: number;
  pendingB2b?: number;
  quotedB2b?: number;
  newRequests?: number;
  contactedRequests?: number;
}
export interface DashboardMonth { month: string; seeds?: number; revenue?: number; }
export interface DashboardCapacityAlert {
  id: string; name: string; pct: number; available: number; status: string; is_public: boolean;
}
export interface DashboardData {
  definitionsVersion: number;
  generatedAt: string;
  kpis: DashboardKpis;
  monthlyGrowth?: DashboardMonth[];
  capacityAlerts?: DashboardCapacityAlert[];
}
