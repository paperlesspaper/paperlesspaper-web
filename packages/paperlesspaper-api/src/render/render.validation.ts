import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

export const generatePdfSchema = {
  body: z
    .object({
      detect: z
        .string()
        .openapi({
          example: 'automatic',
          description: 'Mode for text detection',
        })
        .optional(),
      images: z
        .array(z.any())
        .openapi({
          description: 'An array of images to include in the PDF',
        })
        .optional(),
    })
    .openapi({
      description: 'Payload to generate a PDF',
    }),
};

export default {
  generatePdf: generatePdfSchema,
};
