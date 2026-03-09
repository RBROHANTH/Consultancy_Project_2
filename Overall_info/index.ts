// ─────────────────────────────────────────────────────────────
// domain/value-objects/GeoPoint.ts
// ─────────────────────────────────────────────────────────────
export class GeoPoint {
  constructor(
    public readonly lat: number,
    public readonly lng: number
  ) {
    if (lat < -90 || lat > 90)   throw new Error(`Invalid latitude: ${lat}`);
    if (lng < -180 || lng > 180) throw new Error(`Invalid longitude: ${lng}`);
  }

  static from(raw: { lat: number; lng: number }): GeoPoint {
    return new GeoPoint(raw.lat, raw.lng);
  }
}


// ─────────────────────────────────────────────────────────────
// domain/value-objects/DeliveryZone.ts
// ─────────────────────────────────────────────────────────────
import { GeoPoint } from './GeoPoint';

const PLATFORM_MAX_RADIUS_KM = 50;

export class DeliveryZone {
  constructor(
    public readonly center: GeoPoint,
    public readonly radiusKm: number
  ) {
    if (radiusKm > PLATFORM_MAX_RADIUS_KM)
      throw new Error(`Radius ${radiusKm}km exceeds platform max of ${PLATFORM_MAX_RADIUS_KM}km`);
  }

  contains(point: GeoPoint): boolean {
    return this.calculateDistance(this.center, point) <= this.radiusKm;
  }

  // Haversine formula (PostGIS ST_DWithin preferred in DB queries)
  calculateDistance(a: GeoPoint, b: GeoPoint): number {
    const R = 6371;
    const dLat = this.toRad(b.lat - a.lat);
    const dLng = this.toRad(b.lng - a.lng);
    const sin2 =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(this.toRad(a.lat)) *
      Math.cos(this.toRad(b.lat)) *
      Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.asin(Math.sqrt(sin2));
  }

  private toRad(deg: number): number {
    return (deg * Math.PI) / 180;
  }
}


// ─────────────────────────────────────────────────────────────
// domain/errors/DomainErrors.ts
// ─────────────────────────────────────────────────────────────
export class ArtisanNotVerifiedError extends Error {
  constructor() { super('Artisan must be verified before listing products or accepting orders.'); }
}
export class OutsideDeliveryRadiusError extends Error {
  constructor(distKm: number) { super(`Delivery point is ${distKm.toFixed(1)}km away — exceeds 50km limit.`); }
}
export class ZeroPackagingRequiredError extends Error {
  constructor() { super('Artisan must enable zero-packaging to appear in listings.'); }
}
export class NonBicycleDeliveryError extends Error {
  constructor() { super('Only BICYCLE_ONLY delivery is permitted on this platform.'); }
}


// ─────────────────────────────────────────────────────────────
// domain/entities/User.ts
// ─────────────────────────────────────────────────────────────
import { GeoPoint } from '../value-objects/GeoPoint';
import { DeliveryZone } from '../value-objects/DeliveryZone';

export type UserRole = 'USER' | 'ARTISAN' | 'ADMIN';

export interface UserProps {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  location?: GeoPoint;
  createdAt: Date;
  updatedAt: Date;
}

export class User {
  constructor(private props: UserProps) {}

  get id()           { return this.props.id; }
  get name()         { return this.props.name; }
  get email()        { return this.props.email; }
  get passwordHash() { return this.props.passwordHash; }
  get role()         { return this.props.role; }
  get location()     { return this.props.location; }

  updateLocation(lat: number, lng: number): void {
    this.props.location  = new GeoPoint(lat, lng);
    this.props.updatedAt = new Date();
  }

  isWithinRadius(artisanLocation: GeoPoint, radiusKm = 50): boolean {
    if (!this.props.location) return false;
    const zone = new DeliveryZone(artisanLocation, radiusKm);
    return zone.contains(this.props.location);
  }

  toObject(): UserProps { return { ...this.props }; }
}


// ─────────────────────────────────────────────────────────────
// domain/entities/Artisan.ts
// ─────────────────────────────────────────────────────────────
import { GeoPoint } from '../value-objects/GeoPoint';
import { DeliveryZone } from '../value-objects/DeliveryZone';
import { ArtisanNotVerifiedError } from '../errors/DomainErrors';

export type ArtisanStatus = 'PENDING_VERIFICATION' | 'VERIFIED' | 'SUSPENDED';

export interface ArtisanProps {
  id: string;
  userId: string;
  businessName: string;
  description?: string;
  status: ArtisanStatus;
  zeroPackaging: boolean;
  sustainabilityScore: number;
  location: GeoPoint;
  deliveryZone: DeliveryZone;
  createdAt: Date;
  updatedAt: Date;
}

export class Artisan {
  constructor(private props: ArtisanProps) {}

  get id()                  { return this.props.id; }
  get userId()              { return this.props.userId; }
  get businessName()        { return this.props.businessName; }
  get status()              { return this.props.status; }
  get zeroPackaging()       { return this.props.zeroPackaging; }
  get sustainabilityScore() { return this.props.sustainabilityScore; }
  get location()            { return this.props.location; }
  get deliveryZone()        { return this.props.deliveryZone; }

  verify(): void {
    this.props.status    = 'VERIFIED';
    this.props.updatedAt = new Date();
  }

  suspend(): void {
    this.props.status    = 'SUSPENDED';
    this.props.updatedAt = new Date();
  }

  enableZeroPackaging(): void {
    this.props.zeroPackaging = true;
    this.recalculateSustainabilityScore();
  }

  // Domain rule: artisan must be verified before adding products
  assertCanListProducts(): void {
    if (this.props.status !== 'VERIFIED') throw new ArtisanNotVerifiedError();
  }

  calculateSustainabilityScore(): number {
    let score = 0;
    if (this.props.zeroPackaging)          score += 50;
    if (this.props.status === 'VERIFIED')  score += 30;
    // Additional signals (bicycle delivery, local sourcing) can add up to 20
    score += 20; // placeholder — extend with real signals
    this.props.sustainabilityScore = Math.min(score, 100);
    this.props.updatedAt = new Date();
    return this.props.sustainabilityScore;
  }

  private recalculateSustainabilityScore(): void {
    this.calculateSustainabilityScore();
  }

  toObject(): ArtisanProps { return { ...this.props }; }
}


// ─────────────────────────────────────────────────────────────
// domain/entities/Product.ts
// ─────────────────────────────────────────────────────────────
import { ArtisanNotVerifiedError, ZeroPackagingRequiredError } from '../errors/DomainErrors';

export interface ProductProps {
  id: string;
  artisanId: string;
  artisanVerified: boolean;
  artisanZeroPackaging: boolean;
  name: string;
  description?: string;
  price: number;
  category?: string;
  imageUrl?: string;
  isAvailable: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class Product {
  constructor(private props: ProductProps) {
    if (props.price <= 0) throw new Error('Product price must be greater than zero.');
  }

  get id()          { return this.props.id; }
  get artisanId()   { return this.props.artisanId; }
  get name()        { return this.props.name; }
  get price()       { return this.props.price; }
  get isAvailable() { return this.props.isAvailable; }

  markUnavailable(): void {
    this.props.isAvailable = false;
    this.props.updatedAt   = new Date();
  }

  updatePrice(newPrice: number): void {
    if (newPrice <= 0) throw new Error('Price must be greater than zero.');
    this.props.price     = newPrice;
    this.props.updatedAt = new Date();
  }

  // Business rule: product inherits artisan compliance checks
  validateEligibilityForOrder(): void {
    if (!this.props.artisanVerified)       throw new ArtisanNotVerifiedError();
    if (!this.props.artisanZeroPackaging)  throw new ZeroPackagingRequiredError();
    if (!this.props.isAvailable)           throw new Error('Product is not available.');
  }

  toObject(): ProductProps { return { ...this.props }; }
}


// ─────────────────────────────────────────────────────────────
// domain/entities/Order.ts
// ─────────────────────────────────────────────────────────────
import { GeoPoint } from '../value-objects/GeoPoint';
import { DeliveryZone } from '../value-objects/DeliveryZone';
import {
  OutsideDeliveryRadiusError,
  NonBicycleDeliveryError,
  ArtisanNotVerifiedError,
} from '../errors/DomainErrors';

export type OrderStatus  = 'PENDING' | 'CONFIRMED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';
export type DeliveryType = 'BICYCLE_ONLY';

export interface OrderItem {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export interface OrderProps {
  id: string;
  userId: string;
  artisanId: string;
  artisanVerified: boolean;
  artisanLocation: GeoPoint;
  items: OrderItem[];
  status: OrderStatus;
  deliveryType: DeliveryType;
  distanceKm: number;
  carbonSavedKg: number;
  totalAmount: number;
  deliveryAddress: string;
  deliveryLocation: GeoPoint;
  placedAt: Date;
  deliveredAt?: Date;
}

// kg CO₂ saved vs average car delivery per km
const CO2_SAVED_PER_KM = 0.21;

export class Order {
  constructor(private props: OrderProps) {
    if (!props.artisanVerified) throw new ArtisanNotVerifiedError();
    if (props.deliveryType !== 'BICYCLE_ONLY') throw new NonBicycleDeliveryError();

    const zone = new DeliveryZone(props.artisanLocation, 50);
    if (!zone.contains(props.deliveryLocation)) {
      throw new OutsideDeliveryRadiusError(props.distanceKm);
    }

    this.props.carbonSavedKg = this.calculateCarbonSaved(props.distanceKm);
  }

  get id()            { return this.props.id; }
  get status()        { return this.props.status; }
  get carbonSavedKg() { return this.props.carbonSavedKg; }
  get distanceKm()    { return this.props.distanceKm; }

  calculateCarbonSaved(distanceKm: number): number {
    return parseFloat((distanceKm * CO2_SAVED_PER_KM).toFixed(4));
  }

  confirm(): void {
    if (this.props.status !== 'PENDING') throw new Error('Only PENDING orders can be confirmed.');
    this.props.status = 'CONFIRMED';
  }

  markDelivered(): void {
    this.props.status      = 'DELIVERED';
    this.props.deliveredAt = new Date();
  }

  cancel(): void {
    if (['DELIVERED', 'CANCELLED'].includes(this.props.status))
      throw new Error('Cannot cancel a delivered or already-cancelled order.');
    this.props.status = 'CANCELLED';
  }

  toObject(): OrderProps { return { ...this.props }; }
}
