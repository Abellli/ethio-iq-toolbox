import { IsArray, IsNumber, IsOptional, IsString, ValidateIf } from 'class-validator';

/**
 * Supports the two drawing modes mentioned in the blueprint (3, Survey builder):
 * "draw a polygon or radius on a map for targeting."
 * - Radius mode: centerLat/centerLng/radiusMeters
 * - Polygon mode: polygon (array of [lng, lat] pairs, closed ring)
 */
export class UpsertGeofenceDto {
  @IsOptional()
  @IsString()
  label?: string;

  @ValidateIf((o) => !o.polygon)
  @IsNumber()
  centerLat?: number;

  @ValidateIf((o) => !o.polygon)
  @IsNumber()
  centerLng?: number;

  @ValidateIf((o) => !o.polygon)
  @IsNumber()
  radiusMeters?: number;

  @ValidateIf((o) => !o.centerLat)
  @IsArray()
  polygon?: [number, number][];
}
