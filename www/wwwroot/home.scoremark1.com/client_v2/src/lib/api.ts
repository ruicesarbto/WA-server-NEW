export interface NodeProcessListener {
  pid: number | null;
  command?: string;
  raw?: string;
}

export interface AdminSummary {
  uid: string;
  name: string | null;
  email: string;
}

export interface SslStatus {
  domain: string;
  altDomains: string[];
  certPath?: string;
  keyPath?: string;
  installed: boolean;
  validFrom?: string | null;
  validTo?: string | null;
  daysRemaining?: number | null;
  issuer?: string | null;
  subject?: string | null;
  type?: 'letsencrypt' | 'custom' | 'unknown';
  message?: string;
  canAutoRenew?: boolean;
  updatedAt?: number;
  domains?: string[];
  accountRegistered?: boolean;
  accountEmail?: string | null;
  accountServer?: string | null;
  accountFile?: string | null;
  requiresAccount?: boolean;
}

export interface SslHistoryEntry {
   timestamp: string;
   action: string;
   success: boolean;
   domains?: string[];
   command?: string;
   output?: string;
   errorOutput?: string;
   error?: string;
  accountEmail?: string | null;
 }

export interface SslAccountInfo {
  registered: boolean;
  email?: string | null;
  server?: string | null;
  accountFile?: string | null;
  error?: string | null;
}

export interface SslStatusResponse extends ApiResponse<{ status: SslStatus; history?: SslHistoryEntry[]; account?: SslAccountInfo }> {
  status?: SslStatus;
  history?: SslHistoryEntry[];
  account?: SslAccountInfo;
}
