import { View, StyleSheet, FlatList, RefreshControl, ActivityIndicator, Pressable, Dimensions, TextInput, Modal, ScrollView } from 'react-native';
import { useState, useCallback, useEffect, useMemo, memo, useRef } from 'react';
import { Text } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeInUp,
  FadeInDown,
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  Layout,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { COLORS } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/theme';
import { ArticleCard } from '@/components/features/ArticleCard';
import { articleService } from '@/services/articleService';
import type { NewsItem } from '@/types';

type ContentType = 'news' | 'articles';

// Catégories disponibles (sans "Actus")
const AVAILABLE_CATEGORIES = [
  'Portrait',
  'Guide',
  'Test produit',
  'Analyse',
  'Compétition',
  'Enquête',
  'Gaming',
  'Interview'
];

const { width } = Dimensions.get('window');

const StatusTab = ({ label, value, active, onPress }: { label: string, value: ContentType, active: boolean, onPress: (v: ContentType) => void }) => {
  return (
    <Pressable onPress={() => onPress(value)} style={styles.tabItem}>
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
        {label}
      </Text>
      {active && (
        <Animated.View
          layout={Layout.springify()}
          entering={FadeInDown.duration(200)}
          style={styles.tabIndicator}
        />
      )}
    </Pressable>
  );
};

const EmptyState = ({ isLoading, error, contentType, searchQuery }: { isLoading: boolean, error: string | null, contentType: ContentType, searchQuery: string }) => {
  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text variant="bodyLarge" style={styles.loadingText}>
          Chargement {contentType === 'news' ? 'des actualités' : 'des articles'}...
        </Text>
      </View>
    );
  }

  return (
    <Animated.View
      entering={FadeInUp.delay(200)}
      style={styles.centerContainer}
    >
      <View style={styles.emptyIconContainer}>
        <MaterialCommunityIcons
          name={error ? "alert-circle-outline" : (searchQuery ? "magnify" : "newspaper-variant-outline")}
          size={80}
          color={error ? COLORS.live : COLORS.textMuted}
        />
        <LinearGradient
          colors={['transparent', COLORS.primary + '10', 'transparent']}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <Text variant="headlineSmall" style={styles.emptyTitle}>
        {error ? 'Oups !' : (searchQuery ? 'Aucun résultat' : `Aucun${contentType === 'news' ? 'e actualité' : ' article'}`)}
      </Text>

      <Text variant="bodyMedium" style={styles.emptyDescription}>
        {error ? error : (searchQuery 
          ? `Aucun contenu ne correspond à "${searchQuery}".`
          : `Il n'y a pas encore ${contentType === 'news' ? "d'actualités" : "d'articles"} disponibles pour le moment.`)}
      </Text>
    </Animated.View>
  );
};

const NewsHeader = memo(({
  isSearchVisible,
  searchQuery,
  setSearchQuery,
  toggleSearch,
  toggleFilter,
  contentType,
  setContentType,
  selectedCategory
}: {
  isSearchVisible: boolean,
  searchQuery: string,
  setSearchQuery: (s: string) => void,
  toggleSearch: () => void,
  toggleFilter: () => void,
  contentType: ContentType,
  setContentType: (v: ContentType) => void,
  selectedCategory: string
}) => {
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (isSearchVisible) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    } else {
      inputRef.current?.blur();
    }
  }, [isSearchVisible]);

  const config = {
    duration: 300,
    easing: Easing.out(Easing.exp),
  };

  const searchStyle = useAnimatedStyle(() => ({
    opacity: withTiming(isSearchVisible ? 1 : 0, config),
    transform: [
      { translateX: withTiming(isSearchVisible ? 0 : 30, config) },
    ],
    zIndex: isSearchVisible ? 1 : 0,
    position: isSearchVisible ? 'relative' : 'absolute',
    width: '100%',
  }));

  const tabsStyle = useAnimatedStyle(() => ({
    opacity: withTiming(isSearchVisible ? 0 : 1, config),
    transform: [
      { translateX: withTiming(isSearchVisible ? -30 : 0, config) },
    ],
    zIndex: isSearchVisible ? 0 : 1,
    position: isSearchVisible ? 'absolute' : 'relative',
    width: '100%',
  }));

  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <Animated.View style={[styles.searchBarContainer, searchStyle]}>
          <MaterialCommunityIcons name="magnify" size={20} color={COLORS.primary} style={styles.searchIcon} />
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            placeholder="Rechercher..."
            placeholderTextColor={COLORS.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <Pressable onPress={toggleSearch} style={styles.closeSearchButton}>
            <MaterialCommunityIcons name="close" size={20} color={COLORS.textSecondary} />
          </Pressable>
        </Animated.View>

        <Animated.View style={[styles.tabsAndSearch, tabsStyle]}>
          <View style={styles.tabsContainer}>
            <StatusTab
              label="Actualités"
              value="news"
              active={contentType === 'news'}
              onPress={setContentType}
            />
            <StatusTab
              label="Articles"
              value="articles"
              active={contentType === 'articles'}
              onPress={setContentType}
            />
          </View>

          {/* Bouton filtre (visible uniquement sur Articles) */}
          {contentType === 'articles' && (
            <Pressable onPress={toggleFilter} style={styles.filterButton}>
              <MaterialCommunityIcons name="filter-variant" size={22} color={selectedCategory ? COLORS.primary : COLORS.text} />
            </Pressable>
          )}

          <Pressable onPress={toggleSearch} style={styles.searchButton}>
            <MaterialCommunityIcons name="magnify" size={22} color={COLORS.text} />
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}, (prev, next) => {
  return prev.isSearchVisible === next.isSearchVisible &&
         prev.contentType === next.contentType &&
         prev.searchQuery === next.searchQuery &&
         prev.selectedCategory === next.selectedCategory;
});

export default function NewsScreen() {
  const router = useRouter();
  const [contentType, setContentType] = useState<ContentType>('news');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [articles, setArticles] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  const LIMIT = 15;

  const fetchContent = async (isRefresh = false, loadMore = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true);
        setOffset(0);
      } else if (!loadMore) {
        setIsLoading(true);
      }
      setError(null);

      const currentOffset = isRefresh ? 0 : (loadMore ? offset : 0);

      if (contentType === 'news') {
        const data = await articleService.getArticlesByCategory('Actus', {
          limit: LIMIT,
          offset: currentOffset
        });

        // Strict frontend filtering to ensure only 'Actus' category is shown
        const filtered = data.filter(item => item.category === 'Actus');

        if (isRefresh) {
          setNewsItems(filtered);
        } else if (loadMore) {
          setNewsItems(prev => [...prev, ...filtered]);
        } else {
          setNewsItems(filtered);
        }

        setHasMore(data.length === LIMIT);
      } else {
        const data = await articleService.getAllArticles({
          limit: LIMIT,
          offset: currentOffset,
          excludeNews: true,
          category: selectedCategory || undefined
        });

        if (isRefresh) {
          setArticles(data);
        } else if (loadMore) {
          setArticles(prev => [...prev, ...data]);
        } else {
          setArticles(data);
        }

        setHasMore(data.length === LIMIT);
      }

      if (loadMore) {
        setOffset(currentOffset + LIMIT);
      }
    } catch (err: any) {
      console.error('Error fetching content:', err);
      setError(err?.message || 'Une erreur est survenue');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    setOffset(0);
    setHasMore(true);
    fetchContent();
  }, [contentType, selectedCategory]);

  const handleRefresh = useCallback(() => {
    fetchContent(true);
  }, [contentType, selectedCategory]);

  const handleLoadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      fetchContent(false, true);
    }
  }, [isLoading, hasMore, contentType, offset, selectedCategory]);

  const toggleSearch = useCallback(() => {
    setIsSearchVisible(prev => {
      if (prev) setSearchQuery('');
      return !prev;
    });
  }, []);

  const toggleFilter = useCallback(() => {
    setIsFilterModalVisible(prev => !prev);
  }, []);

  const handleCategorySelect = useCallback((category: string) => {
    if (selectedCategory === category) {
      setSelectedCategory('');
    } else {
      setSelectedCategory(category);
    }
    setIsFilterModalVisible(false);
  }, [selectedCategory]);

  const handleShowAll = useCallback(() => {
    setSelectedCategory('');
    setIsFilterModalVisible(false);
  }, []);

  const filteredData = useMemo(() => {
    const data = contentType === 'news' ? newsItems : articles;
    if (!searchQuery) return data;
    const query = searchQuery.toLowerCase();
    return data.filter(item => 
      item.title?.toLowerCase().includes(query) || 
      item.description?.toLowerCase().includes(query) ||
      item.author?.toLowerCase().includes(query)
    );
  }, [newsItems, articles, contentType, searchQuery]);

  const HeaderComponent = useMemo(() => (
    <NewsHeader
      isSearchVisible={isSearchVisible}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      toggleSearch={toggleSearch}
      toggleFilter={toggleFilter}
      contentType={contentType}
      setContentType={setContentType}
      selectedCategory={selectedCategory}
    />
  ), [isSearchVisible, searchQuery, contentType, toggleSearch, toggleFilter, selectedCategory]);

  const renderFooter = () => {
    if (!hasMore || isLoading || searchQuery) return <View style={{ height: spacing.xxl }} />;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={COLORS.primary} />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredData}
        keyExtractor={(item, index) => `${contentType}-${item.id}-${item.slug}-${index}`}
        renderItem={({ item }) => (
          <View style={styles.cardWrapper}>
            <ArticleCard
              article={item}
              onPress={() => router.push(`/article/${item.slug}`)}
              fullWidth
            />
          </View>
        )}
        ListHeaderComponent={<View style={{ height: 100 }} />} // Spacer for sticky header
        ListEmptyComponent={
          <EmptyState
            isLoading={isLoading}
            error={error}
            contentType={contentType}
            searchQuery={searchQuery}
          />
        }
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
            progressViewOffset={100} // Offset for sticky header
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      />
      {HeaderComponent}

      {/* Modale de filtrage par catégorie */}
      {isFilterModalVisible && (
        <Modal
          visible={isFilterModalVisible}
          animationType="none"
          transparent={true}
          onRequestClose={() => setIsFilterModalVisible(false)}
          presentationStyle="overFullScreen"
        >
          <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(200)}
            style={styles.modalOverlay}
          >
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setIsFilterModalVisible(false)}
            />
            <Animated.View
              entering={SlideInDown.duration(300).easing(Easing.out(Easing.cubic))}
              exiting={SlideOutDown.duration(250).easing(Easing.in(Easing.cubic))}
              style={styles.modalContent}
            >
              {/* Header */}
              <View style={styles.modalHeader}>
                <Text variant="headlineSmall" style={styles.modalTitle}>
                  Catégories
                </Text>
                <Pressable onPress={() => setIsFilterModalVisible(false)} style={styles.closeModalButton}>
                  <MaterialCommunityIcons name="close" size={24} color={COLORS.textSecondary} />
                </Pressable>
              </View>

              {selectedCategory && (
                <Text style={styles.filterActiveText}>
                  Filtre actif : <Text style={styles.filterActiveCategory}>{selectedCategory}</Text>
                </Text>
              )}

              {/* Liste des catégories */}
              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                {/* Bouton "Tout" */}
                <Pressable
                  onPress={handleShowAll}
                  style={[
                    styles.categoryButton,
                    selectedCategory === '' && styles.categoryButtonActive
                  ]}
                >
                  <Text style={[
                    styles.categoryButtonText,
                    selectedCategory === '' && styles.categoryButtonTextActive
                  ]}>
                    Tout
                  </Text>
                </Pressable>

                {/* Boutons catégories */}
                {AVAILABLE_CATEGORIES.map((category) => (
                  <Pressable
                    key={category}
                    onPress={() => handleCategorySelect(category)}
                    style={[
                      styles.categoryButton,
                      selectedCategory === category && styles.categoryButtonActive
                    ]}
                  >
                    <Text style={[
                      styles.categoryButtonText,
                      selectedCategory === category && styles.categoryButtonTextActive
                    ]}>
                      {category}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              {/* Footer avec bouton de réinitialisation */}
              {selectedCategory && (
                <View style={styles.modalFooter}>
                  <Pressable onPress={handleShowAll} style={styles.resetButton}>
                    <Text style={styles.resetButtonText}>Réinitialiser les filtres</Text>
                  </Pressable>
                </View>
              )}
            </Animated.View>
          </Animated.View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingTop: spacing.xs, // Reduced to move up
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabsAndSearch: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  searchButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  searchBarContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    height: 48,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  searchIcon: {
    marginRight: spacing.xs,
  },
  searchInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
    paddingVertical: 8,
  },
  closeSearchButton: {
    padding: 4,
  },
  tabsContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: borderRadius.lg,
    padding: 4,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  tabItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    position: 'relative',
  },
  tabLabel: {
    color: COLORS.textMuted,
    fontWeight: '700',
    fontSize: 13,
  },
  tabLabelActive: {
    color: COLORS.primary,
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 2,
    width: 20,
    height: 3,
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  cardWrapper: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingHorizontal: spacing.xl,
  },
  emptyIconContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    overflow: 'hidden',
  },
  emptyTitle: {
    color: COLORS.text,
    fontWeight: '800',
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptyDescription: {
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  loadingText: {
    color: COLORS.textSecondary,
    marginTop: spacing.md,
    fontWeight: '600',
  },
  footerLoader: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  // Modal styles
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  modalTitle: {
    color: COLORS.text,
    fontWeight: '800',
  },
  closeModalButton: {
    padding: spacing.xs,
  },
  filterActiveText: {
    color: COLORS.textMuted,
    fontSize: 13,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  filterActiveCategory: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  modalScroll: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  categoryButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  categoryButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  categoryButtonText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
  },
  categoryButtonTextActive: {
    color: '#FFFFFF',
  },
  modalFooter: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  resetButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
  },
  resetButtonText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
  },
});
