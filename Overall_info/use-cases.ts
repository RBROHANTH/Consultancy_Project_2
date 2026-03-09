// ─────────────────────────────────────────────────────────────
// application/auth/RegisterUseCase.ts
// ─────────────────────────────────────────────────────────────
import { IUserRepository } from '../../domain/ports/index';
import { User, UserRole } from '../../domain/entities/index';
import { GeoPoint } from '../../domain/value-objects/GeoPoint';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import { signJwt } from '../../shared/auth/jwt';

interface RegisterInput {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
  location?: { lat: number; lng: number };
}

export class RegisterUseCase {
  constructor(private userRepo: IUserRepository) {}

  async execute(input: RegisterInput) {
    const existing = await this.userRepo.findByEmail(input.email);
    if (existing) throw new Error('Email already in use.');

    const passwordHash = await bcrypt.hash(input.password, 12);
    const location = input.location ? GeoPoint.from(input.location) : undefined;

    const user = new User({
      id: uuidv4(),
      name: input.name,
      email: input.email,
      passwordHash,
      role: input.role ?? 'USER',
      location,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const saved = await this.userRepo.save(user);
    const token = signJwt({ userId: saved.id, role: saved.role });
    return { token, user: saved };
  }
}


// ─────────────────────────────────────────────────────────────
// application/auth/LoginUseCase.ts
// ─────────────────────────────────────────────────────────────
import { IUserRepository } from '../../domain/ports/index';
import { signJwt } from '../../shared/auth/jwt';
import bcrypt from 'bcrypt';

export class LoginUseCase {
  constructor(private userRepo: IUserRepository) {}

  async execute(email: string, password: string) {
    const user = await this.userRepo.findByEmail(email);
    if (!user) throw new Error('Invalid email or password.');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new Error('Invalid email or password.');

    const token = signJwt({ userId: user.id, role: user.role });
    return { token, user };
  }
}


// ─────────────────────────────────────────────────────────────
// application/artisan/RegisterArtisanUseCase.ts
// ─────────────────────────────────────────────────────────────
import { IArtisanRepository } from '../../domain/ports/index';
import { Artisan } from '../../domain/entities/index';
import { GeoPoint } from '../../domain/value-objects/GeoPoint';
import { DeliveryZone } from '../../domain/value-objects/DeliveryZone';
import { v4 as uuidv4 } from 'uuid';

interface RegisterArtisanInput {
  userId: string;
  businessName: string;
  description?: string;
  location: { lat: number; lng: number };
  zeroPackaging?: boolean;
}

export class RegisterArtisanUseCase {
  constructor(private artisanRepo: IArtisanRepository) {}

  async execute(input: RegisterArtisanInput): Promise<Artisan> {
    const location = GeoPoint.from(input.location);
    const deliveryZone = new DeliveryZone(location, 50);

    const artisan = new Artisan({
      id: uuidv4(),
      userId: input.userId,
      businessName: input.businessName,
      description: input.description,
      status: 'PENDING_VERIFICATION',
      zeroPackaging: input.zeroPackaging ?? false,
      sustainabilityScore: 0,
      location,
      deliveryZone,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    artisan.calculateSustainabilityScore();
    return this.artisanRepo.save(artisan);
  }
}


// ─────────────────────────────────────────────────────────────
// application/artisan/GetNearbyArtisansUseCase.ts
// ─────────────────────────────────────────────────────────────
import { IArtisanRepository } from '../../domain/ports/index';
import { GeoPoint } from '../../domain/value-objects/GeoPoint';

interface NearbyInput {
  lat: number;
  lng: number;
  radiusKm?: number;
  zeroPackagingOnly?: boolean;
  minSustainabilityScore?: number;
  category?: string;
  limit?: number;
  offset?: number;
}

export class GetNearbyArtisansUseCase {
  constructor(private artisanRepo: IArtisanRepository) {}

  async execute(input: NearbyInput) {
    const location = new GeoPoint(input.lat, input.lng);
    return this.artisanRepo.findNearby({
      location,
      radiusKm: input.radiusKm ?? 50,
      zeroPackagingOnly: input.zeroPackagingOnly,
      minSustainabilityScore: input.minSustainabilityScore,
      category: input.category,
      limit: input.limit ?? 20,
      offset: input.offset ?? 0,
    });
  }
}


// ─────────────────────────────────────────────────────────────
// application/order/PlaceOrderUseCase.ts
// ─────────────────────────────────────────────────────────────
import { IOrderRepository, IProductRepository, IArtisanRepository } from '../../domain/ports/index';
import { Order } from '../../domain/entities/index';
import { GeoPoint } from '../../domain/value-objects/GeoPoint';
import { DeliveryZone } from '../../domain/value-objects/DeliveryZone';
import { v4 as uuidv4 } from 'uuid';

interface PlaceOrderInput {
  userId: string;
  artisanId: string;
  items: { productId: string; quantity: number }[];
  deliveryAddress: string;
  deliveryLocation: { lat: number; lng: number };
}

export class PlaceOrderUseCase {
  constructor(
    private orderRepo: IOrderRepository,
    private productRepo: IProductRepository,
    private artisanRepo: IArtisanRepository,
  ) {}

  async execute(input: PlaceOrderInput): Promise<Order> {
    // 1. Load artisan & validate
    const artisan = await this.artisanRepo.findById(input.artisanId);
    if (!artisan) throw new Error('Artisan not found.');
    artisan.assertCanListProducts(); // throws if not verified

    // 2. Validate delivery location is within 50km
    const deliveryPoint = GeoPoint.from(input.deliveryLocation);
    const zone = new DeliveryZone(artisan.location, 50);
    const distanceKm = zone.calculateDistance(artisan.location, deliveryPoint);

    // 3. Load & validate products
    const resolvedItems = await Promise.all(
      input.items.map(async (item) => {
        const product = await this.productRepo.findById(item.productId);
        if (!product) throw new Error(`Product ${item.productId} not found.`);
        product.validateEligibilityForOrder();
        return { productId: product.id, quantity: item.quantity, unitPrice: product.price };
      })
    );

    const totalAmount = resolvedItems.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity, 0
    );

    // 4. Create Order domain entity (enforces all business rules in constructor)
    const order = new Order({
      id: uuidv4(),
      userId: input.userId,
      artisanId: input.artisanId,
      artisanVerified: artisan.status === 'VERIFIED',
      artisanLocation: artisan.location,
      items: resolvedItems,
      status: 'PENDING',
      deliveryType: 'BICYCLE_ONLY',
      distanceKm,
      carbonSavedKg: 0, // calculated in Order constructor
      totalAmount,
      deliveryAddress: input.deliveryAddress,
      deliveryLocation: deliveryPoint,
      placedAt: new Date(),
    });

    return this.orderRepo.save(order);
  }
}
