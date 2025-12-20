import React, { useRef, useEffect } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
} from 'react-native';
import { Text } from 'react-native-paper';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useGame } from '@/hooks';
import { Game } from '@/types';
import { COLORS } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/theme';

const { width } = Dimensions.get('window');
const GAME_CARD_WIDTH = 149;
const GAME_CARD_HEIGHT = 195;
const GAME_CARD_SPACING = 6;

export const GameSelector = () => {
  const { games, selectedGame, setSelectedGame, isLoadingGames } = useGame();
  const flatListRef = useRef<FlatList>(null);

  // Auto-scroll to selected game when it changes
  useEffect(() => {
    if (selectedGame && games.length > 0) {
      const index = games.findIndex(g => g.id === selectedGame.id);
      if (index !== -1 && flatListRef.current) {
        flatListRef.current.scrollToIndex({
          index,
          animated: true,
          viewPosition: 0.5, // Center the item
        });
      }
    }
  }, [selectedGame, games.length]);

  const handleGameSelect = (game: Game) => {
    if (selectedGame?.id === game.id) {
      setSelectedGame(null);
    } else {
      setSelectedGame(game);
    }
  };

  const renderGameCard = ({ item }: { item: Game }) => {
    const isSelected = selectedGame?.id === item.id;

    return (
      <GameCard
        game={item}
        isSelected={isSelected}
        onPress={() => handleGameSelect(item)}
      />
    );
  };

  if (isLoadingGames) {
    return (
      <View style={styles.container}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          data={Array(6).fill(null)}
          renderItem={() => <GameCardSkeleton />}
          keyExtractor={(_, index) => `skeleton-${index}`}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Subtle background glow effect like web */}
      <LinearGradient
        colors={['rgba(242, 46, 98, 0.05)', 'transparent', 'rgba(242, 46, 98, 0.05)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      
      <FlatList
        ref={flatListRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        data={games}
        renderItem={renderGameCard}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ width: GAME_CARD_SPACING }} />}
        snapToInterval={GAME_CARD_WIDTH + GAME_CARD_SPACING}
        decelerationRate="fast"
        onScrollToIndexFailed={(info) => {
          const wait = new Promise(resolve => setTimeout(resolve, 500));
          wait.then(() => {
            flatListRef.current?.scrollToIndex({ index: info.index, animated: true });
          });
        }}
      />
    </View>
  );
};

interface GameCardProps {
  game: Game;
  isSelected: boolean;
  onPress: () => void;
}

const GameCard = ({ game, isSelected, onPress }: GameCardProps) => {
  const scaleAnim = useRef(new Animated.Value(isSelected ? 1.05 : 1)).current;
  const borderAnim = useRef(new Animated.Value(isSelected ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: isSelected ? 1.05 : 1,
        damping: 15,
        stiffness: 120,
        useNativeDriver: true,
      }),
      Animated.timing(borderAnim, {
        toValue: isSelected ? 1 : 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isSelected, scaleAnim, borderAnim]);

  const imageUrl = isSelected ? game.selected_image : game.unselected_image;

  return (
    <TouchableOpacity 
      onPress={onPress} 
      activeOpacity={0.8}
      style={styles.cardWrapper}
    >
      <Animated.View
        style={[
          styles.gameCard,
          {
            transform: [{ scale: scaleAnim }],
          },
          isSelected && styles.gameCardSelected,
        ]}
      >
        {/* Animated Gradient Border Layer (Simulated with position absolute) */}
        {isSelected && (
          <LinearGradient
            colors={[COLORS.primary, '#9c27b0', COLORS.primary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.selectedBorder}
          />
        )}

        <View style={styles.imageContainer}>
          <Image
            source={{ uri: imageUrl }}
            style={[
              styles.gameImage,
              !isSelected && { opacity: 0.85, saturation: 0.75 } as any
            ]}
            contentFit="cover"
            transition={300}
          />
          
          {/* Overlay Gradient */}
          <LinearGradient
            colors={isSelected 
              ? ['transparent', 'rgba(242, 46, 98, 0.3)', 'rgba(242, 46, 98, 0.6)'] 
              : ['transparent', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.7)']}
            style={styles.overlay}
          />

          {/* Selection Badge */}
          {isSelected && (
             <LinearGradient
                colors={[COLORS.primary, '#d81b60']}
                style={styles.badge}
             >
                <MaterialCommunityIcons name="check" size={12} color="white" />
             </LinearGradient>
          )}

          {/* Game Name Label */}
          <View style={styles.nameLabelContainer}>
            <View style={[
              styles.nameLabel,
              isSelected && styles.nameLabelSelected
            ]}>
              <Text 
                variant="labelSmall" 
                style={[
                  styles.gameName,
                  isSelected && styles.gameNameSelected
                ]}
                numberOfLines={1}
              >
                {game.name}
              </Text>
            </View>
          </View>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
};

const GameCardSkeleton = () => {
  return (
    <View style={[styles.gameCard, styles.skeleton]}>
      <View style={styles.skeletonImage} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.sm,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  cardWrapper: {
    paddingVertical: 1,
  },
  gameCard: {
    width: GAME_CARD_WIDTH,
    height: GAME_CARD_HEIGHT,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
  },
  gameCardSelected: {
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  selectedBorder: {
    position: 'absolute',
    inset: 0,
    borderRadius: borderRadius.lg,
  },
  imageContainer: {
    flex: 1,
    margin: 3, // Space for the animated border
    borderRadius: borderRadius.md + 2,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: COLORS.surfaceVariant,
  },
  gameImage: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  badge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    zIndex: 20,
  },
  nameLabelContainer: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  nameLabel: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    width: '100%',
  },
  nameLabelSelected: {
    backgroundColor: 'rgba(242, 46, 98, 0.2)',
    borderColor: 'rgba(255, 255, 255, 0.5)',
    transform: [{ scale: 1.05 }],
  },
  gameName: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  gameNameSelected: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  skeleton: {
    opacity: 0.3,
  },
  skeletonImage: {
    flex: 1,
    backgroundColor: COLORS.surfaceVariant,
  },
});

