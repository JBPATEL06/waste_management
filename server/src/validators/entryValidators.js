import { z } from 'zod';
import { stageEnum, wasteTypeEnum } from './batchValidators.js';

export const finalStatusEnum = z.enum([
  'PROCESSED',
  'RECOVERED',
  'DISPOSED',
  'COMPLETED',
]);

const notFutureTime = (val) => {
  const date = new Date(val);
  const nowWithTolerance = new Date(Date.now() + 5 * 60 * 1000); // 5 min clock skew tolerance
  return date <= nowWithTolerance;
};

// Stage Detail Schemas
export const collectionEntrySchema = z.object({
  event_time: z
    .string()
    .datetime({ offset: true })
    .refine(notFutureTime, { message: 'Collection time cannot be in the future' }),
  collection_area: z.string().trim().min(2, 'Collection area is required'),
  route_id: z.string().uuid('Invalid route ID format'),
  vehicle_id: z.string().uuid('Invalid vehicle ID format'),
  waste_type: wasteTypeEnum,
  quantity: z.coerce.number().positive('Quantity must be greater than 0 kg'),
  driver_id: z.string().uuid('Invalid driver ID format'),
  note: z.string().trim().max(500, 'Note cannot exceed 500 characters').optional().nullable(),
});

export const transportationEntrySchema = z
  .object({
    event_time: z
      .string()
      .datetime({ offset: true })
      .refine(notFutureTime, { message: 'Departure time cannot be in the future' }),
    start_location: z.string().trim().min(2, 'Start location is required'),
    destination: z.string().trim().min(2, 'Destination is required'),
    rts_location_id: z.string().uuid('Invalid RTS location ID format'),
    vehicle_id: z.string().uuid('Invalid vehicle ID format'),
    arrival_time: z
      .string()
      .datetime({ offset: true })
      .refine(notFutureTime, { message: 'Arrival time cannot be in the future' })
      .optional()
      .nullable(),
    note: z.string().trim().max(500, 'Note cannot exceed 500 characters').optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.arrival_time) {
        return new Date(data.arrival_time) >= new Date(data.event_time);
      }
      return true;
    },
    {
      message: 'Arrival time must be after or equal to departure time',
      path: ['arrival_time'],
    }
  );

export const rtsEntrySchema = z.object({
  event_time: z
    .string()
    .datetime({ offset: true })
    .refine(notFutureTime, { message: 'Arrival time cannot be in the future' }),
  rts_location_id: z.string().uuid('Invalid RTS location ID format'),
  quantity_received: z.coerce.number().positive('Quantity received must be greater than 0 kg'),
  waste_category_id: z.string().uuid('Invalid waste category ID format'),
  handover_details: z.string().trim().min(2, 'Handover details are required'),
  next_facility_id: z.string().uuid('Invalid next facility ID format'),
  note: z.string().trim().max(500, 'Note cannot exceed 500 characters').optional().nullable(),
});

export const processingEntrySchema = z.object({
  event_time: z
    .string()
    .datetime({ offset: true })
    .refine(notFutureTime, { message: 'Arrival time cannot be in the future' }),
  facility_id: z.string().uuid('Invalid facility ID format'),
  process_type_id: z.string().uuid('Invalid process type ID format'),
  quantity: z.coerce.number().positive('Quantity processed must be greater than 0 kg'),
  final_status: finalStatusEnum,
  note: z.string().trim().max(500, 'Note cannot exceed 500 characters').optional().nullable(),
});

// Dynamic validation helper matching stage
export function validateStagePayload(stage, body) {
  switch (stage) {
    case 'COLLECTION':
      return collectionEntrySchema.parse(body);
    case 'TRANSPORTATION':
      return transportationEntrySchema.parse(body);
    case 'RTS':
      return rtsEntrySchema.parse(body);
    case 'PROCESSING':
      return processingEntrySchema.parse(body);
    default:
      throw new Error(`Unsupported stage: ${stage}`);
  }
}

export const correctEntrySchema = {
  params: z.object({
    id: z.string().uuid('Invalid entry ID format'),
  }),
  body: z.object({
    reason: z.string().trim().min(3, 'Reason for correction is mandatory (min 3 characters)'),
  }).passthrough(),
};

export const adminEditEntrySchema = {
  params: z.object({
    id: z.string().uuid('Invalid entry ID format'),
  }),
  body: z.object({
    reason: z.string().trim().min(3, 'Reason for edit is mandatory (min 3 characters)'),
  }).passthrough(),
};

export const adminDeleteEntrySchema = {
  params: z.object({
    id: z.string().uuid('Invalid entry ID format'),
  }),
  body: z.object({
    reason: z.string().trim().min(3, 'Reason for deletion is mandatory (min 3 characters)'),
  }),
};

