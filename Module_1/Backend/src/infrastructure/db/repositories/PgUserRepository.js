const { User } = require('../../../domain/entities/User');
const { GeoPoint } = require('../../../domain/value-objects/GeoPoint');

class PgUserRepository {
  constructor(db) {
    this.db = db;
  }

  _rowToUser(row) {
    return new User({
      id: row.id,
      name: row.name,
      email: row.email,
      passwordHash: row.password_hash,
      role: row.role,
      location:
        row.lat != null && row.lng != null
          ? new GeoPoint(row.lat, row.lng)
          : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  async findById(id) {
    const { rows } = await this.db.query(
      `SELECT u.*,
              ST_Y(u.location::geometry) AS lat,
              ST_X(u.location::geometry) AS lng
       FROM users u WHERE u.id = $1`,
      [id]
    );
    return rows[0] ? this._rowToUser(rows[0]) : null;
  }

  async findByEmail(email) {
    const { rows } = await this.db.query(
      `SELECT u.*,
              ST_Y(u.location::geometry) AS lat,
              ST_X(u.location::geometry) AS lng
       FROM users u WHERE u.email = $1`,
      [email]
    );
    return rows[0] ? this._rowToUser(rows[0]) : null;
  }

  async save(user) {
    const p = user.toObject();
    if (p.location) {
      await this.db.query(
        `INSERT INTO users (id, name, email, password_hash, role, location, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, ST_MakePoint($7, $6)::geography, $8, $9)`,
        [
          p.id, p.name, p.email, p.passwordHash, p.role,
          p.location.lat, p.location.lng,
          p.createdAt, p.updatedAt,
        ]
      );
    } else {
      await this.db.query(
        `INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [p.id, p.name, p.email, p.passwordHash, p.role, p.createdAt, p.updatedAt]
      );
    }
    return user;
  }

  async updateLocation(userId, point) {
    await this.db.query(
      `UPDATE users SET location = ST_MakePoint($2, $1)::geography WHERE id = $3`,
      [point.lat, point.lng, userId]
    );
  }
}

module.exports = { PgUserRepository };
