import { useEffect, useRef, useState } from 'react';
import { Dimensions, FlatList, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import { useTranslation } from '@/i18n';
import { useImageUrls, useVillageBanner } from '@/api/gallery';
import { useConnectivity } from '@/lib/net';
import { layout, radius, space } from '@/theme/tokens';
import { useColors } from '@/theme/use-scheme';

/**
 * Home's photo banner (spec 03.1 §2): up to five admin-chosen photos, 16:9, advancing
 * every five seconds, with dots.
 *
 * **Renders nothing at all when there are no photos**, rather than the spec's illustrated
 * placeholder. The app ships no fake data (spec 01.8 #4), and an empty-state illustration
 * prompting "add one" belongs on the gallery screen — which the Photos tile already
 * reaches — not as a permanent fixture at the top of every village's home screen.
 *
 * **Suppressed in Lite mode**, as spec 08.7 requires: on 2g/slow-2g this is five images
 * nobody asked for, downloaded before the notices they opened the app to read.
 *
 * Auto-advance stops while a finger is down and does not resume until the gesture ends,
 * because a carousel that moves out from under a thumb is a carousel people stop touching.
 */
export function VillageBanner({ villageId }: { villageId: string | null | undefined }) {
  const { t } = useTranslation();
  const colors = useColors();
  const { slow } = useConnectivity();

  const banner = useVillageBanner(slow ? null : villageId);
  const images = banner.data ?? [];
  const urls = useImageUrls(images.map((image) => image.storage_path));

  const [index, setIndex] = useState(0);
  const [held, setHeld] = useState(false);
  const list = useRef<FlatList>(null);
  const width = Dimensions.get('window').width - layout.gutter * 2;

  useEffect(() => {
    if (held || images.length < 2) return;
    const timer = setTimeout(() => {
      const next = (index + 1) % images.length;
      setIndex(next);
      list.current?.scrollToOffset({ offset: next * width, animated: true });
    }, 5000);
    return () => clearTimeout(timer);
  }, [index, held, images.length, width]);

  if (slow || images.length === 0) return null;

  return (
    <View>
      <FlatList
        ref={list}
        data={images}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(image) => image.id}
        onTouchStart={() => setHeld(true)}
        onTouchEnd={() => setHeld(false)}
        onTouchCancel={() => setHeld(false)}
        onMomentumScrollEnd={(event) =>
          setIndex(Math.round(event.nativeEvent.contentOffset.x / width))
        }
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        renderItem={({ item, index: i }) => (
          <View style={{ width }}>
            {urls[i]?.data ? (
              <Image
                source={{ uri: urls[i].data }}
                style={[styles.photo, { backgroundColor: colors.surfaceAlt }]}
                contentFit="cover"
                transition={200}
                cachePolicy="disk"
                accessibilityLabel={item.caption ?? t('gallery.photo')}
              />
            ) : (
              <View style={[styles.photo, { backgroundColor: colors.surfaceAlt }]} />
            )}
          </View>
        )}
      />

      {images.length > 1 ? (
        <View style={styles.dots}>
          {images.map((image, i) => (
            <View
              key={image.id}
              style={[
                styles.dot,
                { backgroundColor: i === index ? colors.primary : colors.border },
              ]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  photo: { width: '100%', aspectRatio: 16 / 9, borderRadius: radius.card },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: space.xs,
    paddingTop: space.sm,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
