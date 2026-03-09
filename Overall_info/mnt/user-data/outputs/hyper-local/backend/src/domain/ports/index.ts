// ─────────────────────────────────────────────────────────────
// domain/ports/IUserRepository.ts
// ─────────────────────────────────────────────────────────────
import { User } from '../entities/index';
import { GeoPoint } from '../value-objects/GeoPoint';

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  save(user: User): Promise<User>;
  updateLocation(userId: string, point: GeoPoint): Promise<void>;
}


// ─────────────────────────────────────────────────────────────
// domain/ports/IArtisanRepository.ts
// ─────────────────────────────────────────────────────────────
import { Artisan } from '../entities/index';
import { GeoPoint } from '../value-objects/GeoPoint';

export interface NearbyArtisanFilter {
  location: GeoPoint;
  radiusKm?: number;
  category?: string;
  zeroPackagingOnly?: boolean;
  minSustainabilityScore?: number;
  limit?: number;
  offset?: number;
}

export interface IArtisanRepository {
  findById(id: string): Promise<Artisan | null>;
  findByUserId(userId: string): Promise<Artisan | null>;
  findNearby(filter: NearbyArtisanFilter): Promise<{ nodes: Artisan[]; total: number }>;
  findPendingVerification(): Promise<Artisan[]>;
  save(artisan: Artisan): Promise<Artisan>;
  update(artisan: Artisan): Promise<Artisan>;
}


// ─────────────────────────────────────────────────────────────
// domain/ports/IProductRepository.ts
// ─────────────────────────────────────────────────────────────
import { Product } from '../entities/index';
import { GeoPoint } from '../value-objects/GeoPoint';

export interface ProductFilter {
  artisanId?: string;
  category?: string;
  location?: GeoPoint;
  radiusKm?: number;
  availableOnly?: boolean;
  limit?: number;
  offset?: number;
}

export interface IProductRepository {
  findById(id: string): Promise<Product | null>;
  findMany(filter: ProductFilter): Promise<{ nodes: Product[]; total: number }>;
  save(product: Product): Promise<Product>;
  update(product: Product): Promise<Product>;
  delete(id: string): Promise<void>;
}


// ─────────────────────────────────────────────────────────────
// domain/ports/IOrderRepository.ts
// ─────────────────────────────────────────────────────────────
import { Order, OrderStatus } from '../entities/index';

export interface IOrderRepository {
  findById(id: string): Promise<Order | null>;
  findByUserId(userId: string, status?: OrderStatus): Promise<Order[]>;
  findByArtisanId(artisanId: string): Promise<Order[]>;
  save(order: Order): Promise<Order>;
  update(order: Order): Promise<Order>;
}
