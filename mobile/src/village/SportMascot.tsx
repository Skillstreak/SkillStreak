import { Image, StyleSheet, Text, View } from 'react-native';

import { sportMascotFor } from '../onboarding/avatarCatalog';

interface SportMascotProps {
  /** Lower-case sport key, see `sportKey`. */
  sport: string;
  /** Rendered size in px; the art is square. */
  height: number;
}

/**
 * A sport's mascot, decorative only. Hidden from screen readers (the card
 * label already says the sport) and not pressable. Sports without art get
 * a neutral placeholder, never somebody's avatar.
 */
export function SportMascot({ sport, height }: SportMascotProps) {
  const mascot = sportMascotFor(sport);
  if (!mascot) {
    return (
      <View
        style={[styles.placeholder, { width: height, height }]}
        accessible={false}
        importantForAccessibility="no-hide-descendants"
      >
        <Text style={{ fontSize: Math.round(height * 0.5) }}>🏟️</Text>
      </View>
    );
  }
  return (
    <Image
      source={mascot.image}
      style={{ height, width: height }}
      resizeMode="contain"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityIgnoresInvertColors
    />
  );
}

const styles = StyleSheet.create({
  placeholder: { alignItems: 'center', justifyContent: 'center' },
});
