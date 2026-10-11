"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StudentCreateSchema = void 0;
const zod_1 = require("zod");
exports.StudentCreateSchema = zod_1.z.object({
    fullName: zod_1.z.string().min(2, 'Name must be at least 2 characters'),
    rollNumber: zod_1.z.string().min(1, 'Roll number is required'),
    standard: zod_1.z.string().min(1, 'Class/Standard is required'),
    parentPhone: zod_1.z.string().regex(/^\d{10}$/, 'Must be a valid 10-digit phone number'),
    studentPhone: zod_1.z.string().regex(/^\d{10}$/).optional().or(zod_1.z.literal('')),
    address: zod_1.z.string().optional(),
    admissionDate: zod_1.z.string().optional(),
    totalFees: zod_1.z.number().min(0, 'Fees must be non-negative')
});
