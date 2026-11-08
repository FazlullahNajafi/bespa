import Svg, { Circle, ClipPath, Defs, G, Path } from 'react-native-svg';

import { useColors } from '@/theme/use-scheme';

/**
 * Illustrated avatars, for someone who would rather not put their face in the village
 * directory.
 *
 * **Chosen, never inferred.** There is no way to tell from a name whether somebody wears
 * a hijab, and guessing would be wrong about real people on a screen their neighbours
 * read. So these are offered as a choice on the profile screen and the default stays
 * coloured initials — which is itself a reasonable answer and the one nobody has to
 * think about.
 *
 * Why they exist at all: spec 03.4 publishes a new profile to the whole village, and in
 * Kargil a photograph of a woman's face is something many families will not put there.
 * The options were a blank silhouette, a photograph, or something a person might
 * actually recognise as themselves — and a directory of grey silhouettes is a directory
 * nobody feels present in.
 *
 * Drawn flat and simple on purpose: these render at 44px in a list row far more often
 * than at 96px on a profile, and detail at that size is noise. Two tones from the
 * theme, no gradients, no faces — a face at 44px is two dots and a line, and two dots
 * and a line is a cartoon.
 */

export const AVATAR_PRESETS = ['man', 'hijabi', 'woman'] as const;
export type AvatarPreset = (typeof AVATAR_PRESETS)[number];

export function isAvatarPreset(value: string | null | undefined): value is AvatarPreset {
  return value !== null && value !== undefined && (AVATAR_PRESETS as readonly string[]).includes(value);
}

export function AvatarArt({ preset, size }: { preset: AvatarPreset; size: number }) {
  const colors = useColors();

  // The figure sits a shade stronger than its backdrop so the silhouette reads at any
  // size, and both come from the palette rather than being drawn in.
  const back = colors.infoSurface;
  const fore = colors.primary;

  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      {/* A real clip, not a decorative rectangle. Every figure below draws shoulders
          down to y=48, where the circle has no width left — without this they spill
          out of the badge as two blobs under the bottom corners. */}
      <Defs>
        <ClipPath id="avatarClip">
          <Circle cx="24" cy="24" r="24" />
        </ClipPath>
      </Defs>

      <Circle cx="24" cy="24" r="24" fill={back} />

      <G clipPath="url(#avatarClip)">

      {preset === 'man' ? (
        <G>
          {/* Short hair, head, shoulders. */}
          <Path d="M15 20v-2a9 9 0 0 1 18 0v2" fill={fore} />
          <Circle cx="24" cy="21" r="8" fill={fore} />
          <Path d="M9 48c0-8 6.7-13 15-13s15 5 15 13z" fill={fore} />
        </G>
      ) : null}

      {preset === 'hijabi' ? (
        <G>
          {/* The hijab as one draped shape: over the crown, down past the jaw and
              across the shoulders. The face is left as the backdrop colour rather than
              drawn, which is what keeps it from becoming a cartoon at 44px. */}
          <Path
            d="M24 8c-8 0-12 6-12 14 0 5 1.5 9 3.5 11.5L13 48h22l-2.5-14.5C34.5 31 36 27 36 22c0-8-4-14-12-14z"
            fill={fore}
          />
          <Path
            d="M24 13c-5 0-7.5 4-7.5 9.5S19 32 24 32s7.5-4 7.5-9.5S29 13 24 13z"
            fill={back}
          />
          <Path d="M10 48c0-7 5.5-11.5 14-11.5S38 41 38 48z" fill={fore} />
        </G>
      ) : null}

      {preset === 'woman' ? (
        <G>
          {/* Hair falling past the shoulders, uncovered. */}
          <Path d="M13 24c0-9 4.5-15 11-15s11 6 11 15v8h-4V22H17v10h-4z" fill={fore} />
          <Circle cx="24" cy="21" r="7.5" fill={fore} />
          <Path d="M9 48c0-8 6.7-13 15-13s15 5 15 13z" fill={fore} />
        </G>
      ) : null}

      </G>
    </Svg>
  );
}
