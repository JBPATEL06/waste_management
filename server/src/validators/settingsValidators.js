import { z } from 'zod';

export const updateSettingsSchema = {
  body: z.object({
    variance_threshold_pct: z
      .coerce
      .number({ required_error: 'variance_threshold_pct is required' })
      .min(0, 'Variance threshold must be non-negative')
      .max(100, 'Variance threshold cannot exceed 100%'),
  }),
};

