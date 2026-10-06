import { z } from 'zod';

export const masterTypeParamSchema = {
  params: z.object({
    type: z.enum([
      'routes',
      'vehicles',
      'rts_locations',
      'rts-locations',
      'processing_facilities',
      'processing-facilities',
      'process_types',
      'process-types',
      'waste_categories',
      'waste-categories',
      'drivers',
    ]),
  }),
};

export const masterIdParamSchema = {
  params: z.object({
    type: z.enum([
      'routes',
      'vehicles',
      'rts_locations',
      'rts-locations',
      'processing_facilities',
      'processing-facilities',
      'process_types',
      'process-types',
      'waste_categories',
      'waste-categories',
      'drivers',
    ]),
    id: z.string().uuid('Invalid record ID format'),
  }),
};

export const createRouteSchema = z.object({
  code: z.string().trim().min(1, 'Route code is required'),
  name: z.string().trim().min(1, 'Route name is required'),
  description: z.string().trim().optional(),
});

export const updateRouteSchema = z.object({
  code: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1).optional(),
  description: z.string().trim().optional(),
  is_active: z.boolean().optional(),
});

export const createVehicleSchema = z.object({
  vehicle_number: z.string().trim().min(1, 'Vehicle number is required'),
  vehicle_type: z.string().trim().optional(),
  capacity_kg: z.coerce.number().positive('Capacity must be positive').optional(),
});

export const updateVehicleSchema = z.object({
  vehicle_number: z.string().trim().min(1).optional(),
  vehicle_type: z.string().trim().optional(),
  capacity_kg: z.coerce.number().positive().optional(),
  is_active: z.boolean().optional(),
});

export const createNameLocationSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  location: z.string().trim().min(1, 'Location is required'),
});

export const updateNameLocationSchema = z.object({
  name: z.string().trim().min(1).optional(),
  location: z.string().trim().min(1).optional(),
  is_active: z.boolean().optional(),
});

export const createNameOnlySchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
});

export const updateNameOnlySchema = z.object({
  name: z.string().trim().min(1).optional(),
  is_active: z.boolean().optional(),
});

export const createDriverSchema = z.object({
  name: z.string().trim().min(1, 'Driver name is required'),
  phone: z.string().trim().optional(),
  designation: z.string().trim().min(1, 'Designation is required'),
});

export const updateDriverSchema = z.object({
  name: z.string().trim().min(1).optional(),
  phone: z.string().trim().optional(),
  designation: z.string().trim().min(1).optional(),
  is_active: z.boolean().optional(),
});

