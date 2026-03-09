// ─────────────────────────────────────────────────────────────
// infrastructure/db/pool.ts
// ─────────────────────────────────────────────────────────────
import { Pool } from 'pg';

export const pool = new Pool({
  host:     process.env.DB_HOST     ?? 'localhost',
  port:     parseInt(process.env.DB_PORT ?? '5432'),
  database: process.env.DB_NAME     ?? 'hyperlocal',
  user:     process.env.DB_USER     ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
});


// ─────────────────────────────────────────────────────────────
// infrastructure/db/repositories/PgArtisanRepository.ts
// (shows the geo-query pattern — other repos follow same shape)
// ─────────────────────────────────────────────────────────────
import { Pool } from 'pg';
import { IArtisanRepository, NearbyArtisanFilter } from '../../../domain/ports/index';
import { Artisan } from '../../../domain/entities/index';
import { GeoPoint } from '../../../domain/value-objects/GeoPoint';
import { DeliveryZone } from '../../../domain/value-objects/DeliveryZone';

export class PgArtisanRepository implements IArtisanRepository {
  constructor(private db: Pool) {}

  private rowToArtisan(row: any): Artisan {
    return new Artisan({
      id:                  row.id,
      userId:              row.user_id,
      businessName:        row.business_name,
      description:         row.description,
      status:              row.status,
      zeroPackaging:       row.zero_packaging,
      sustainabilityScore: parseFloat(row.sustainability_score),
      location:            new GeoPoint(row.lat, row.lng),
      deliveryZone:        new DeliveryZone(new GeoPoint(row.lat, row.lng), parseFloat(row.delivery_zone_radius_km)),
      createdAt:           row.created_at,
      updatedAt:           row.updated_at,
    });
  }

  async findById(id: string): Promise<Artisan | null> {
    const { rows } = await this.db.query(
      `SELECT a.*,
              ST_Y(a.location::geometry) AS lat,
              ST_X(a.location::geometry) AS lng
       FROM artisans a WHERE a.id = $1`,
      [id]
    );
    return rows[0] ? this.rowToArtisan(rows[0]) : null;
  }

  async findByUserId(userId: string): Promise<Artisan | null> {
    const { rows } = await this.db.query(
      `SELECT a.*,
              ST_Y(a.location::geometry) AS lat,
              ST_X(a.location::geometry) AS lng
       FROM artisans a WHERE a.user_id = $1`,
      [userId]
    );
    return rows[0] ? this.rowToArtisan(rows[0]) : null;
  }

  // Core geo-fence query — uses PostGIS ST_DWithin (uses spatial index)
  async findNearby(filter: NearbyArtisanFilter) {
    const radiusMetres = (filter.radiusKm ?? 50) * 1000;
    const params: any[] = [
      filter.location.lng,
      filter.location.lat,
      radiusMetres,
    ];

    let conditions = [
      `a.status = 'VERIFIED'`,
      `ST_DWithin(a.location, ST_MakePoint($1, $2)::geography, $3)`,
    ];

    if (filter.zeroPackagingOnly) {
      conditions.push(`a.zero_packaging = TRUE`);
    }
    if (filter.minSustainabilityScore !== undefined) {
      params.push(filter.minSustainabilityScore);
      conditions.push(`a.sustainability_score >= $${params.length}`);
    }

    const where = conditions.join(' AND ');
    const limit  = filter.limit  ?? 20;
    const offset = filter.offset ?? 0;

    params.push(limit, offset);

    const query = `
      SELECT a.*,
             ST_Y(a.location::geometry) AS lat,
             ST_X(a.location::geometry) AS lng,
             ST_Distance(a.location, ST_MakePoint($1, $2)::geography) / 1000 AS distance_km,
             COUNT(*) OVER() AS total_count
      FROM artisans a
      WHERE ${where}
      ORDER BY distance_km ASC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;

    const { rows } = await this.db.query(query, params);
    const total = rows[0] ? parseInt(rows[0].total_count) : 0;
    return { nodes: rows.map(this.rowToArtisan.bind(this)), total };
  }

  async findPendingVerification(): Promise<Artisan[]> {
    const { rows } = await this.db.query(
      `SELECT a.*,
              ST_Y(a.location::geometry) AS lat,
              ST_X(a.location::geometry) AS lng
       FROM artisans a WHERE a.status = 'PENDING_VERIFICATION'
       ORDER BY a.created_at ASC`
    );
    return rows.map(this.rowToArtisan.bind(this));
  }

  async save(artisan: Artisan): Promise<Artisan> {
    const p = artisan.toObject();
    await this.db.query(
      `INSERT INTO artisans
         (id, user_id, business_name, description, status, zero_packaging,
          sustainability_score, location, delivery_zone_center, delivery_zone_radius_km,
          created_at, updated_at)
       VALUES
         ($1,$2,$3,$4,$5,$6,$7,
          ST_MakePoint($9,$8)::geography,
          ST_MakePoint($9,$8)::geography,
          $10, $11, $12)`,
      [
        p.id, p.userId, p.businessName, p.description ?? null,
        p.status, p.zeroPackaging, p.sustainabilityScore,
        p.location.lat, p.location.lng,
        p.deliveryZone.radiusKm,
        p.createdAt, p.updatedAt,
      ]
    );
    return artisan;
  }

  async update(artisan: Artisan): Promise<Artisan> {
    const p = artisan.toObject();
    await this.db.query(
      `UPDATE artisans SET
         business_name = $2, description = $3, status = $4,
         zero_packaging = $5, sustainability_score = $6,
         location = ST_MakePoint($8,$7)::geography,
         updated_at = $9
       WHERE id = $1`,
      [
        p.id, p.businessName, p.description ?? null, p.status,
        p.zeroPackaging, p.sustainabilityScore,
        p.location.lat, p.location.lng,
        p.updatedAt,
      ]
    );
    return artisan;
  }
}


// ─────────────────────────────────────────────────────────────
// infrastructure/graphql/context.ts
// ─────────────────────────────────────────────────────────────
import { Request } from 'express';
import { verifyJwt } from '../../shared/auth/jwt';
import { pool } from '../db/pool';
import { PgArtisanRepository } from '../db/repositories/PgArtisanRepository';
// import other repos similarly

export interface AppContext {
  currentUser: { userId: string; role: string } | null;
  repos: {
    artisans: PgArtisanRepository;
    // users, products, orders...
  };
}

export async function buildContext({ req }: { req: Request }): Promise<AppContext> {
  const authHeader = req.headers.authorization ?? '';
  let currentUser = null;

  if (authHeader.startsWith('Bearer ')) {
    try {
      currentUser = verifyJwt(authHeader.slice(7));
    } catch {
      // invalid token — treat as unauthenticated
    }
  }

  return {
    currentUser,
    repos: {
      artisans: new PgArtisanRepository(pool),
    },
  };
}


// ─────────────────────────────────────────────────────────────
// shared/auth/jwt.ts
// ─────────────────────────────────────────────────────────────
import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET ?? 'change-me-in-production';

export function signJwt(payload: object): string {
  return jwt.sign(payload, SECRET, { expiresIn: '7d' });
}

export function verifyJwt(token: string): any {
  return jwt.verify(token, SECRET);
}

export function requireAuth(ctx: { currentUser: any }): asserts ctx is { currentUser: { userId: string; role: string } } {
  if (!ctx.currentUser) throw new Error('Authentication required.');
}

export function requireRole(ctx: { currentUser: any }, role: string): void {
  requireAuth(ctx);
  if (ctx.currentUser.role !== role) throw new Error(`Requires ${role} role.`);
}


// ─────────────────────────────────────────────────────────────
// shared/carbon/carbonCalculator.ts
// ─────────────────────────────────────────────────────────────

// Average car delivery emits ~0.21 kg CO₂/km
// Bicycle delivery emits ~0.00 kg CO₂/km
const CAR_CO2_PER_KM = 0.21;

export function calculateCarbonSaved(distanceKm: number): number {
  return parseFloat((distanceKm * CAR_CO2_PER_KM).toFixed(4));
}

// Equivalent in human-readable terms
export function carbonToEquivalent(carbonKg: number): string {
  const kmDriven = carbonKg / CAR_CO2_PER_KM;
  return `Equivalent to not driving ${kmDriven.toFixed(1)} km by car`;
}
