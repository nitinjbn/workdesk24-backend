import { z } from 'zod';

const integer = z.union([
  z.number().int(),
  z.string().regex(/^[0-9]+$/).transform(Number).pipe(z.number().int()),
]);
const id = integer.refine((value) => value > 0);
const numeric = z.union([
  z.number(),
  z.string().regex(/^-?[0-9]+(?:\.[0-9]+)?$/).transform(Number).pipe(z.number()),
]);
const money = numeric.pipe(z.number().min(0).max(99999999.99));
const amount = money.nullish();
const flag = integer.refine((value) => value === 0 || value === 1).nullish();

const orderProductSchema = z.object({
  id: id.optional(),
  localId: z.string().max(100).nullish(),
  productId: id.nullish(),
  productName: z.string().trim().min(1).max(200),
  productCode: z.string().max(100).nullish(),
  quantity: numeric.pipe(z.number().min(0.01).max(99999999.99)),
  mrp: amount,
  discountPercentage: numeric.pipe(z.number().min(0).max(100)).nullish(),
  discountAmount: amount,
  taxAmount: amount,
  totalAmount: amount,
  isDeleted: integer.refine((value) => value === 0, 'Omit a product line to remove it').optional(),
});

export const revisedOrderSchema = z.object({
  orderId: id,
  hostId: id,
  visitId: id.optional(),
  customerId: id.optional(),
  totalAmount: money.optional(),
  taxAmount: amount,
  totalDiscount: amount,
  totalUniqueProducts: integer.refine((value) => value >= 0 && value <= 127).nullish(),
  totalQuantity: integer.refine((value) => value >= 0 && value <= 2147483647).nullish(),
  orderTime: integer.refine((value) => value > 0 && value <= 253402300799).optional(),
  remarks: z.string().max(16383).nullish(),
  latitude: numeric.pipe(z.number().min(-90).max(90)).nullish(),
  longitude: numeric.pipe(z.number().min(-180).max(180)).nullish(),
  locationAccuracy: numeric.pipe(z.number().min(0).max(3.4e38)).nullish(),
  locationAltitude: numeric.pipe(z.number().min(-3.4e38).max(3.4e38)).nullish(),
  locationSpeed: numeric.pipe(z.number().min(0).max(3.4e38)).nullish(),
  locationProvider: z.string().max(100).nullish(),
  address: z.string().max(255).nullish(),
  batteryPercentage: integer.refine((value) => value >= 0 && value <= 100).nullish(),
  isCharging: flag,
  isDeleted: integer.refine((value) => value === 0, 'An order cannot be deleted here').optional(),
  orderProducts: z.array(orderProductSchema).optional(),
});

export type RevisedOrderInput = z.infer<typeof revisedOrderSchema>;
export type RevisedOrderProductInput = z.infer<typeof orderProductSchema>;
export type OrderDetails = Omit<
  RevisedOrderInput,
  'orderId' | 'hostId' | 'visitId' | 'customerId' | 'isDeleted' | 'orderProducts'
>;
