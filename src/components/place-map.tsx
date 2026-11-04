import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTranslation } from '@/i18n';
import { Icon } from '@/components/icon';
import { canShowMap } from '@/lib/place-actions';
import { categoryIcon } from '@/lib/place-categories';
import type { Place } from '@/api/places';
import { radius, space } from '@/theme/tokens';
import { useColors } from '@/theme/use-scheme';

/**
 * The map, where there is one (spec 03.2's list/map toggle and pin drop).
 *
 * **`react-native-maps` is loaded lazily and its absence is not an error**, the same shape
 * as `location.ts` and `push.ts`. Two different things can be missing. The native view is
 * missing from any build made before the library was added — and unlike an Expo module
 * that fails on import, a missing native *component* fails when it renders, which is a
 * red screen rather than a disabled button. The API key is missing whenever the build was
 * made without one, and that failure is worse because it is silent: a keyless map is a
 * blank grey rectangle with no log line.
 *
 * `canShowMap()` answers the second from build-time config and, because the key and the
 * library arrive in the same build, answers the first as well. The `require` is still
 * wrapped, because a JS-only update can outrun the binary it lands on.
 *
 * Callers must be built to work with no map at all, which is not a concession — most
 * people adding the shop they are standing outside will use "my current location", and
 * the list is the screen they came for.
 */

type MapsModule = typeof import('react-native-maps');

let cached: MapsModule | null | undefined;

function mapsModule(): MapsModule | null {
  if (cached !== undefined) return cached;
  if (!canShowMap()) {
    cached = null;
    return cached;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('react-native-maps') as MapsModule;
  } catch {
    cached = null;
  }
  return cached;
}

/** Whether to offer the map at all. False means the screen shows its list and says so. */
export function mapAvailable(): boolean {
  return mapsModule() !== null;
}

/**
 * A span wide enough to hold everything given, with a floor.
 *
 * Without the floor, one place — or a pin being placed — produces a zero-width region,
 * which Google Maps renders as a view zoomed so far in that the surroundings are gone and
 * the user cannot tell where they are.
 */
const MIN_SPAN = 0.012; // roughly 1.3 km of latitude

function regionFor(points: { lat: number; lon: number }[], fallback: { lat: number; lon: number }) {
  if (points.length === 0) {
    return {
      latitude: fallback.lat,
      longitude: fallback.lon,
      latitudeDelta: MIN_SPAN,
      longitudeDelta: MIN_SPAN,
    };
  }

  const lats = points.map((p) => p.lat);
  const lons = points.map((p) => p.lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLon + maxLon) / 2,
    // 1.4x, so pins near the edge are not half under the frame.
    latitudeDelta: Math.max(MIN_SPAN, (maxLat - minLat) * 1.4),
    longitudeDelta: Math.max(MIN_SPAN, (maxLon - minLon) * 1.4),
  };
}

/** The read-only map behind the list toggle: every place as a tappable pin. */
export function PlacesMap({
  places,
  centre,
  onSelect,
}: {
  places: Place[];
  centre: { lat: number; lon: number };
  onSelect: (place: Place) => void;
}) {
  const maps = mapsModule();
  const colors = useColors();
  const { t } = useTranslation();

  const region = useMemo(() => regionFor(places, centre), [places, centre]);

  if (!maps) return null;
  const { default: MapView, Marker, PROVIDER_GOOGLE } = maps;

  return (
    <View style={[styles.frame, { backgroundColor: colors.surfaceAlt }]}>
      <MapView
        // Explicitly Google rather than the default: on Android the default provider is
        // Google anyway, but naming it means the same tiles on any handset and the same
        // behaviour as the key that was registered for it.
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        initialRegion={region}
        // Nothing here needs the compass, the scale bar or the user's heading, and each
        // is another control over a small map.
        showsCompass={false}
        toolbarEnabled={false}
        accessibilityLabel={t('places.mapLabel')}
      >
        {places.map((place) => (
          <Marker
            key={place.id}
            coordinate={{ latitude: place.lat, longitude: place.lon }}
            title={place.name_en}
            description={t(`places.category.${place.category}`)}
            onPress={() => onSelect(place)}
          />
        ))}
      </MapView>
    </View>
  );
}

/**
 * Dropping a pin (spec 03.2 step 5), for a place the submitter is not standing in.
 *
 * Tap to move, rather than a draggable marker. A long-press-then-drag is a gesture that
 * has to be discovered, and on a 2 GB handset the drag drops frames badly enough that it
 * feels broken; a tap lands the pin exactly where the thumb went.
 *
 * The category icon sits on the pin, so the map says what is being added — spec 08.6's
 * icon-and-word rule applied to the one screen where the word is still being typed.
 */
export function PinPicker({
  value,
  centre,
  category,
  onChange,
}: {
  value: { lat: number; lon: number } | null;
  centre: { lat: number; lon: number };
  category: Place['category'] | null;
  onChange: (point: { lat: number; lon: number }) => void;
}) {
  const maps = mapsModule();
  const colors = useColors();
  const { t } = useTranslation();

  const region = useMemo(() => regionFor(value ? [value] : [], centre), [value, centre]);

  if (!maps) return null;
  const { default: MapView, Marker, PROVIDER_GOOGLE } = maps;

  return (
    <View style={[styles.frame, { backgroundColor: colors.surfaceAlt }]}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        initialRegion={region}
        showsCompass={false}
        toolbarEnabled={false}
        accessibilityLabel={t('places.pinLabel')}
        onPress={(event) =>
          onChange({
            lat: event.nativeEvent.coordinate.latitude,
            lon: event.nativeEvent.coordinate.longitude,
          })
        }
      >
        {value ? (
          <Marker coordinate={{ latitude: value.lat, longitude: value.lon }} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={[styles.pin, { backgroundColor: colors.primary }]}>
              <Icon
                name={category ? categoryIcon(category) : 'pin'}
                size={18}
                color={colors.onPrimary}
              />
            </View>
          </Marker>
        ) : null}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  // 4:3 rather than 16:9: a map of a village is as tall as it is wide, and a letterbox
  // shows two streets.
  frame: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.card, overflow: 'hidden' },
  pin: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xs,
  },
});
