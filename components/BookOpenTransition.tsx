import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, StyleSheet, Text, View } from 'react-native';

const { width, height } = Dimensions.get('window');

export function BookOpenTransition({ children, visible }: { children: React.ReactNode; visible: boolean }) {
  const leftAnim   = useRef(new Animated.Value(0)).current;
  const rightAnim  = useRef(new Animated.Value(0)).current;
  const shadowAnim = useRef(new Animated.Value(1)).current;
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (visible) {
      setDone(false);
      leftAnim.setValue(0);
      rightAnim.setValue(0);
      shadowAnim.setValue(1);

      Animated.sequence([
        Animated.delay(350),
        Animated.parallel([
          Animated.timing(leftAnim, {
            toValue: 1, duration: 1000, useNativeDriver: true,
          }),
          Animated.timing(rightAnim, {
            toValue: 1, duration: 1000, useNativeDriver: true,
          }),
          Animated.timing(shadowAnim, {
            toValue: 0, duration: 1200, useNativeDriver: true,
          }),
        ]),
      ]).start(() => setDone(true)); // ← hide covers once fully open
    }
  }, [visible]);

  const leftX  = leftAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -(width / 2)] });
  const rightX = rightAnim.interpolate({ inputRange: [0, 1], outputRange: [0, width / 2] });

  if (done) return <View style={styles.container}>{children}</View>;

  return (
    <View style={styles.container}>
      {children}

      {/* Left cover */}
      <Animated.View style={[styles.coverLeft, { transform: [{ translateX: leftX }] }]}>
        <View style={styles.coverInner}>
          {/* Decorative ruled lines */}
          {Array.from({ length: 18 }).map((_, i) => (
            <View key={i} style={styles.ruledLine} />
          ))}
          {/* Vertical title text */}
          <View style={styles.leftTextContainer}>
            <Text style={styles.coverTitleVertical}>GARDEN JOURNAL</Text>
            <View style={styles.coverDivider} />
            <Text style={styles.coverSubVertical}>est. {new Date().getFullYear()}</Text>
          </View>
          {/* Corner flourish */}
          <Text style={styles.cornerTopLeft}>✦</Text>
          <Text style={styles.cornerBottomLeft}>✦</Text>
        </View>
        {/* Right-edge shadow for depth */}
        <View style={styles.leftEdgeShadow} />
      </Animated.View>

      {/* Right cover */}
      <Animated.View style={[styles.coverRight, { transform: [{ translateX: rightX }] }]}>
        <View style={styles.coverInner}>
          {Array.from({ length: 18 }).map((_, i) => (
            <View key={i} style={styles.ruledLine} />
          ))}
          <View style={styles.rightTextContainer}>
            <Text style={styles.coverYearVertical}>{new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</Text>
            <View style={styles.coverDivider} />
            <Text style={styles.coverSubVertical}>my observations</Text>
          </View>
          <Text style={styles.cornerTopRight}>✦</Text>
          <Text style={styles.cornerBottomRight}>✦</Text>
        </View>
        {/* Left-edge shadow for depth */}
        <View style={styles.rightEdgeShadow} />
      </Animated.View>


      {/* Shadow overlay */}
      <Animated.View style={[styles.shadow, { opacity: shadowAnim }]} pointerEvents="none" />
    </View>
  );
}

const COVER_DARK  = '#d0d7c9';
const COVER_MID   = '#d0d7c9';
const RULED_COLOR = 'rgba(255,255,255,0.055)';
const GOLD        = '#c9a84c';

const styles = StyleSheet.create({
  container: { flex: 1 },

  coverLeft: {
    position: 'absolute', top: 0, left: 0,
    width: width / 2, height,
    backgroundColor: COVER_MID,
    zIndex: 20, overflow: 'hidden',
  },
  coverRight: {
    position: 'absolute', top: 0, right: 0,
    width: width / 2, height,
    backgroundColor: COVER_MID,
    zIndex: 20, overflow: 'hidden',
  },

  coverInner: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: 'rgba(201,168,76,0.25)',
    margin: 10,
    overflow: 'hidden',
  },

  // Ruled lines across the whole cover
  ruledLine: {
    height: 1,
    backgroundColor: RULED_COLOR,
    marginTop: height / 18,
    marginHorizontal: 0,
  },

  // Left cover text (vertical, centered)
  leftTextContainer: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0, right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  rightTextContainer: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0, right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },

  coverTitleVertical: {
    color: GOLD,
    fontSize: 11,
    fontFamily: 'Poppins_600SemiBold',
    letterSpacing: 4,
    transform: [{ rotate: '-90deg' }],
    width: height * 0.45,
    textAlign: 'center',
  },
  coverYearVertical: {
    color: GOLD,
    fontSize: 10,
    fontFamily: 'Poppins_600SemiBold',
    letterSpacing: 3,
    transform: [{ rotate: '-90deg' }],
    width: height * 0.45,
    textAlign: 'center',
  },
  coverSubVertical: {
    color: 'rgba(201,168,76,0.45)',
    fontSize: 9,
    fontFamily: 'Poppins_400Regular',
    letterSpacing: 2,
    transform: [{ rotate: '-90deg' }],
    width: height * 0.3,
    textAlign: 'center',
  },

  coverDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(201,168,76,0.3)',
  },

  cornerTopLeft: {
    position: 'absolute', top: 10, left: 10,
    color: GOLD, fontSize: 10, opacity: 0.6,
  },
  cornerBottomLeft: {
    position: 'absolute', bottom: 10, left: 10,
    color: GOLD, fontSize: 10, opacity: 0.6,
  },
  cornerTopRight: {
    position: 'absolute', top: 10, right: 10,
    color: GOLD, fontSize: 10, opacity: 0.6,
  },
  cornerBottomRight: {
    position: 'absolute', bottom: 10, right: 10,
    color: GOLD, fontSize: 10, opacity: 0.6,
  },

  // Depth shadows at the spine edges
  leftEdgeShadow: {
    position: 'absolute', top: 0, right: 0,
    width: 18, height: '100%',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  rightEdgeShadow: {
    position: 'absolute', top: 0, left: 0,
    width: 18, height: '100%',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },

  spine: {
    position: 'absolute',
    top: 0, left: width / 2 - 4,
    width: 8, height,
    backgroundColor: COVER_DARK,
    zIndex: 30,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  spineText: {
    color: 'rgba(201,168,76,0.5)',
    fontSize: 7,
    fontFamily: 'Poppins_600SemiBold',
    letterSpacing: 2,
    transform: [{ rotate: '90deg' }],
    width: height,
    textAlign: 'center',
  },

  shadow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
    zIndex: 15,
  },
});