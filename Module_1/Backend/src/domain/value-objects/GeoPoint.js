class GeoPoint {
  constructor(lat, lng) {
    if (lat < -90 || lat > 90) throw new Error(`Invalid latitude: ${lat}`);
    if (lng < -180 || lng > 180) throw new Error(`Invalid longitude: ${lng}`);
    this.lat = lat;
    this.lng = lng;
  }

  static from(raw) {
    return new GeoPoint(raw.lat, raw.lng);
  }
}

module.exports = { GeoPoint };
