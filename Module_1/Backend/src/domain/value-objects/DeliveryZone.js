const { GeoPoint } = require('./GeoPoint');

const PLATFORM_MAX_RADIUS_KM = 50;

class DeliveryZone {
  constructor(center, radiusKm) {
    if (radiusKm > PLATFORM_MAX_RADIUS_KM)
      throw new Error(`Radius ${radiusKm}km exceeds platform max of ${PLATFORM_MAX_RADIUS_KM}km`);
    this.center = center;
    this.radiusKm = radiusKm;
  }

  contains(point) {
    return this.calculateDistance(this.center, point) <= this.radiusKm;
  }

  calculateDistance(a, b) {
    const R = 6371;
    const dLat = this._toRad(b.lat - a.lat);
    const dLng = this._toRad(b.lng - a.lng);
    const sin2 =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(this._toRad(a.lat)) *
        Math.cos(this._toRad(b.lat)) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.asin(Math.sqrt(sin2));
  }

  _toRad(deg) {
    return (deg * Math.PI) / 180;
  }
}

module.exports = { DeliveryZone };
