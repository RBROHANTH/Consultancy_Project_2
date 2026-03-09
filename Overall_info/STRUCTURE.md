# Frontend — Clean Architecture
# Stack: React (Vite) · Apollo Client · TypeScript · OpenMapTiles

src/
├── graphql/
│   ├── queries/
│   │   ├── artisans.ts      # GET_NEARBY_ARTISANS, GET_ARTISAN
│   │   ├── products.ts      # GET_PRODUCTS, GET_PRODUCT
│   │   └── orders.ts        # MY_ORDERS, GET_ORDER
│   └── mutations/
│       ├── auth.ts          # REGISTER, LOGIN
│       ├── artisan.ts       # REGISTER_AS_ARTISAN, UPDATE_PROFILE
│       ├── product.ts       # CREATE_PRODUCT, UPDATE_PRODUCT
│       └── order.ts         # PLACE_ORDER, CONFIRM_ORDER, MARK_DELIVERED
│
├── lib/
│   ├── apolloClient.ts      # Apollo Client setup with auth link
│   ├── map.ts               # OpenMapTiles / MapLibre GL JS setup
│   └── auth.ts              # JWT storage (memory + sessionStorage)
│
├── hooks/
│   ├── useCurrentUser.ts    # Read auth context
│   ├── useGeolocation.ts    # Browser GPS → GeoPoint
│   ├── useNearbyArtisans.ts # Query nearby artisans with user's location
│   └── useOrder.ts          # Place order + status tracking
│
├── components/
│   ├── map/
│   │   ├── MapView.tsx      # OpenMapTiles base map (MapLibre GL JS)
│   │   ├── ArtisanPin.tsx   # Marker with sustainability badge
│   │   └── RadiusCircle.tsx # 50km radius overlay
│   ├── artisan/
│   │   ├── ArtisanCard.tsx
│   │   └── SustainabilityBadge.tsx
│   ├── product/
│   │   ├── ProductCard.tsx
│   │   └── ProductForm.tsx
│   ├── order/
│   │   ├── Cart.tsx
│   │   ├── CarbonSavingsCard.tsx
│   │   └── OrderStatusBadge.tsx
│   ├── chat/
│   │   └── ChatWidget.tsx   # Optional chatbot
│   └── ui/
│       ├── Button.tsx
│       └── Spinner.tsx
│
└── pages/
    ├── HomePage.tsx         # Map + nearby artisans
    ├── ArtisanPage.tsx      # Artisan profile + products
    ├── ProductPage.tsx      # Product detail
    ├── CheckoutPage.tsx     # Cart → order → carbon savings
    ├── OrdersPage.tsx       # Order history
    ├── DashboardPage.tsx    # Artisan: manage products + orders
    ├── AdminPage.tsx        # Admin: verify artisans
    └── auth/
        ├── LoginPage.tsx
        └── RegisterPage.tsx


# ─────────────────────────────────────────────
# KEY FILE CONTENTS (for your frontend friend)
# ─────────────────────────────────────────────


# lib/apolloClient.ts
# ─────────────────────────────────────────────

```typescript
import { ApolloClient, InMemoryCache, createHttpLink, from } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';

const httpLink = createHttpLink({
  uri: import.meta.env.VITE_API_URL ?? 'http://localhost:4000/graphql',
});

const authLink = setContext((_, { headers }) => {
  const token = sessionStorage.getItem('token');
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    },
  };
});

export const apolloClient = new ApolloClient({
  link: from([authLink, httpLink]),
  cache: new InMemoryCache(),
});
```


# lib/map.ts  — OpenMapTiles with MapLibre GL JS
# ─────────────────────────────────────────────

```typescript
import maplibregl from 'maplibre-gl';

export function createMap(container: string | HTMLElement): maplibregl.Map {
  return new maplibregl.Map({
    container,
    style: 'https://tiles.openfreemap.org/styles/liberty', // free OpenMapTiles style
    center: [0, 0],
    zoom: 12,
  });
}

export function addArtisanMarker(
  map: maplibregl.Map,
  artisan: { id: string; location: { lat: number; lng: number }; businessName: string },
  onClick: (id: string) => void
): maplibregl.Marker {
  const el = document.createElement('div');
  el.className = 'artisan-marker';
  el.title = artisan.businessName;

  const marker = new maplibregl.Marker({ element: el })
    .setLngLat([artisan.location.lng, artisan.location.lat])
    .addTo(map);

  el.addEventListener('click', () => onClick(artisan.id));
  return marker;
}

export function drawRadiusCircle(
  map: maplibregl.Map,
  center: [number, number],
  radiusKm: number
): void {
  // Use turf.js circle() or draw a GeoJSON polygon approximation
  const sourceId = 'radius-circle';
  if (map.getSource(sourceId)) map.removeLayer(sourceId), map.removeSource(sourceId);

  // Add circle as a GeoJSON source (generate points along circumference)
  const points = 64;
  const coords = Array.from({ length: points + 1 }, (_, i) => {
    const angle = (i / points) * 2 * Math.PI;
    const dx = (radiusKm / 111.32) * Math.cos(angle);
    const dy = (radiusKm / (111.32 * Math.cos((center[1] * Math.PI) / 180))) * Math.sin(angle);
    return [center[0] + dy, center[1] + dx];
  });

  map.addSource(sourceId, {
    type: 'geojson',
    data: { type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] }, properties: {} },
  });

  map.addLayer({
    id: sourceId,
    type: 'fill',
    source: sourceId,
    paint: { 'fill-color': '#22c55e', 'fill-opacity': 0.08 },
  });
}
```


# graphql/queries/artisans.ts
# ─────────────────────────────────────────────

```typescript
import { gql } from '@apollo/client';

export const GET_NEARBY_ARTISANS = gql`
  query GetNearbyArtisans(
    $location: GeoPointInput!
    $radiusKm: Float
    $zeroPackagingOnly: Boolean
    $minSustainabilityScore: Float
    $limit: Int
    $offset: Int
  ) {
    nearbyArtisans(
      location: $location
      radiusKm: $radiusKm
      zeroPackagingOnly: $zeroPackagingOnly
      minSustainabilityScore: $minSustainabilityScore
      limit: $limit
      offset: $offset
    ) {
      nodes {
        id
        businessName
        description
        sustainabilityScore
        zeroPackaging
        location { lat lng }
        products(availableOnly: true) {
          id name price category
        }
      }
      pageInfo { total hasNextPage }
    }
  }
`;
```


# hooks/useGeolocation.ts
# ─────────────────────────────────────────────

```typescript
import { useState, useEffect } from 'react';

export function useGeolocation() {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => setError(err.message)
    );
  }, []);

  return { location, error };
}
```
