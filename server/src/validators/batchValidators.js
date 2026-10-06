import { z } from 'zod';

export const stageEnum = z.enum([
  'COLLECTION',
  'TRANSPORTATION',
  'RTS',
  'PROCESSING',
]);

export const wasteTypeEnum = z.enum(['WET', 'DRY']);

export const batchStatusEnum = z.enum([
  'CREATED',
  'COLLECTED',
  'IN_TRANSIT',
  'AT_RTS',
  'COMPLETED',
]);

export const createBatchSchema = {
  body: z.object({
    batch_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'batch_date must be in YYYY-MM-DD format'),
    waste_type: wasteTypeEnum,
    quantity: z.coerce.number().positive('Quantity must be greater than 0 kg'),
    source_area: z.string().trim().min(2, 'Source area must be at least 2 characters'),
    route_id: z.string().uuid('Invalid route ID format'),
    vehicle_id: z.string().uuid('Invalid vehicle ID format'),
    assignments: z
      .union([
        // Array of 4 assignments
        z.array(
          z.object({
            stage: stageEnum,
            user_id: z.string().uuid('Invalid user ID format'),
          })
        ),
        // Object format { collection_user_id, transportation_user_id, rts_user_id, processing_user_id }
        z.object({
          collection_user_id: z.string().uuid(),
          transportation_user_id: z.string().uuid(),
          rts_user_id: z.string().uuid(),
          processing_user_id: z.string().uuid(),
        }),
      ])
      .refine(
        (val) => {
          if (Array.isArray(val)) {
            const stages = val.map((a) => a.stage);
            return (
              val.length === 4 &&
              stages.includes('COLLECTION') &&
              stages.includes('TRANSPORTATION') &&
              stages.includes('RTS') &&
              stages.includes('PROCESSING')
            );
          }
          return (
            Boolean(val.collection_user_id) &&
            Boolean(val.transportation_user_id) &&
            Boolean(val.rts_user_id) &&
            Boolean(val.processing_user_id)
          );
        },
        { message: 'All 4 stages (COLLECTION, TRANSPORTATION, RTS, PROCESSING) must be assigned' }
      ),
  }),
};

export const updateBatchSchema = {
  params: z.object({
    id: z.string().min(1, 'Batch ID is required'),
  }),
  body: z.object({
    batch_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    waste_type: wasteTypeEnum.optional(),
    quantity: z.coerce.number().positive().optional(),
    source_area: z.string().trim().min(2).optional(),
    route_id: z.string().uuid().optional(),
    vehicle_id: z.string().uuid().optional(),
  }),
};

export const reassignSchema = {
  params: z.object({
    id: z.string().min(1, 'Batch ID is required'),
  }),
  body: z.union([
    z.object({
      stage: stageEnum,
      user_id: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Invalid user ID format'),
      reason: z.string().trim().optional(),
    }),
    z.object({
      assignments: z.record(z.string()),
      reason: z.string().trim().optional(),
    }),
  ]),
};

export const listBatchesSchema = {
  query: z.object({
    search: z.string().trim().optional(),
    status: batchStatusEnum.optional(),
    waste_type: wasteTypeEnum.optional(),
    route_id: z.string().uuid().optional(),
    vehicle_id: z.string().uuid().optional(),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    sort_by: z.enum(['batch_date', 'created_at', 'batch_code', 'quantity']).default('created_at').optional(),
    sort_order: z.enum(['asc', 'desc']).default('desc').optional(),
    limit: z.coerce.number().min(1).max(100).default(50).optional(),
    offset: z.coerce.number().min(0).default(0).optional(),
  }),
};

