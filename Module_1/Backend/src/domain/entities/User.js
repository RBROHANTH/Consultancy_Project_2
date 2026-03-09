const { GeoPoint } = require('../value-objects/GeoPoint');
const { DeliveryZone } = require('../value-objects/DeliveryZone');

class User {
  constructor(props) {
    this._props = props;
  }

  get id() { return this._props.id; }
  get name() { return this._props.name; }
  get email() { return this._props.email; }
  get passwordHash() { return this._props.passwordHash; }
  get role() { return this._props.role; }
  get location() { return this._props.location; }
  get createdAt() { return this._props.createdAt; }
  get updatedAt() { return this._props.updatedAt; }

  updateLocation(lat, lng) {
    this._props.location = new GeoPoint(lat, lng);
    this._props.updatedAt = new Date();
  }

  isWithinRadius(artisanLocation, radiusKm = 50) {
    if (!this._props.location) return false;
    const zone = new DeliveryZone(artisanLocation, radiusKm);
    return zone.contains(this._props.location);
  }

  toObject() {
    return { ...this._props };
  }
}

module.exports = { User };
