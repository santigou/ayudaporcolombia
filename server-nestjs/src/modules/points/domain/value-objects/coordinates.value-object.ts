import { ValueObject } from '../../../../shared/domain/base/entity.base';

export interface CoordinatesProps {
  latitude: number;
  longitude: number;
}

/**
 * Coordinates Value Object
 * Encapsulates geographical coordinates with validation
 */
export class Coordinates extends ValueObject {
  private readonly _latitude: number;
  private readonly _longitude: number;

  private constructor(props: CoordinatesProps) {
    super(props);
    this._latitude = props.latitude;
    this._longitude = props.longitude;
  }

  get latitude(): number {
    return this._latitude;
  }

  get longitude(): number {
    return this._longitude;
  }

  static create(latitude: number, longitude: number): Coordinates {
    if (!Coordinates.isValidLatitude(latitude)) {
      throw new Error('Invalid latitude. Must be between -90 and 90');
    }

    if (!Coordinates.isValidLongitude(longitude)) {
      throw new Error('Invalid longitude. Must be between -180 and 180');
    }

    return new Coordinates({ latitude, longitude });
  }

  private static isValidLatitude(latitude: number): boolean {
    return latitude >= -90 && latitude <= 90;
  }

  private static isValidLongitude(longitude: number): boolean {
    return longitude >= -180 && longitude <= 180;
  }

  getDistanceFrom(other: Coordinates): number {
    const R = 6371; // Earth's radius in km
    const lat1Rad = this.toRadians(this._latitude);
    const lat2Rad = this.toRadians(other.latitude);
    const deltaLat = this.toRadians(other.latitude - this._latitude);
    const deltaLon = this.toRadians(other.longitude - this._longitude);

    const a =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(lat1Rad) *
        Math.cos(lat2Rad) *
        Math.sin(deltaLon / 2) *
        Math.sin(deltaLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  private toRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }

  toString(): string {
    return `${this._latitude}, ${this._longitude}`;
  }
}