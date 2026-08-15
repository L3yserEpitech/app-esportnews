import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';

// Animated WebP (encoded loop=1 → plays once, holds the last frame). Rendered
// through expo-image, which is already linked in the native binary, so this
// needs no native rebuild — unlike a video module.
const source = require('@/assets/splash-animation.webp');

const DURATION_MS = 4950; // 150 frames @ 30fps
const HOLD_MS = 500; // linger on the final frame before fading out
const MAX_SPLASH_MS = 9000; // absolute fallback if the image never loads

export default function SplashAnimation({ onFinish }: { onFinish: () => void }) {
  const { width } = useWindowDimensions();
  const opacity = useRef(new Animated.Value(1)).current;
  const finishedRef = useRef(false);

  const finish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    // Cross-fade to the app underneath (hides the black -> #060B13 shift).
    Animated.timing(opacity, {
      toValue: 0,
      duration: 350,
      useNativeDriver: true,
    }).start(() => onFinish());
  };

  useEffect(() => {
    const hard = setTimeout(finish, MAX_SPLASH_MS);
    return () => clearTimeout(hard);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onLoad = () => {
    // The animation is ready: dismiss the native static splash and schedule the
    // fade for when the single playthrough ends.
    SplashScreen.hideAsync().catch(() => {});
    setTimeout(finish, DURATION_MS + HOLD_MS);
  };

  // The master is 16:9 landscape on a pure-black background. Shown centered at
  // its natural ratio on black, the letterbox is invisible — it reads as the
  // logo animating on a black screen regardless of device aspect ratio.
  const imageStyle = { width, height: (width * 9) / 16 };

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.container, { opacity }]}
      pointerEvents="none"
    >
      <Image
        source={source}
        style={imageStyle}
        contentFit="contain"
        onLoad={onLoad}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
});
