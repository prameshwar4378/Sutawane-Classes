import { z } from 'zod';

export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptimeSeconds: number;
  environment: string;
  version: string;
  database: {
    connected: boolean;
    provider: 'sqlite';
    dbLocation: string;
    studentCount: number;
  };
  storage: {
    dataPath: string;
    photosPath: string;
    attachmentsPath: string;
    backupsPath: string;
  };
}

export const StudentCreateSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  rollNumber: z.string().min(1, 'Roll number is required'),
  standard: z.string().min(1, 'Class/Standard is required'),
  parentPhone: z.string().regex(/^\d{10}$/, 'Must be a valid 10-digit phone number'),
  studentPhone: z.string().regex(/^\d{10}$/).optional().or(z.literal('')),
  address: z.string().optional(),
  admissionDate: z.string().optional(),
  totalFees: z.number().min(0, 'Fees must be non-negative')
});

export type StudentCreateInput = z.infer<typeof StudentCreateSchema>;

export interface StudentSummary {
  id: string;
  fullName: string;
  rollNumber: string;
  standard: string;
  parentPhone: string;
  totalFees: number;
  paidFees: number;
  pendingFees: number;
  createdAt: string;
}

export interface FinancialStats {
  totalExpectedFees: number;
  totalCollectedFees: number;
  totalPendingFees: number;
  activeStudentsCount: number;
}

export interface Course {
  id: string;
  name: string;
  code?: string | null;
  description?: string | null;
  defaultFee?: number | null;
  isActive: boolean;
  sortOrder: number;
  enrolledCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

