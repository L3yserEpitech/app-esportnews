import React from 'react';
import {
    View,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Dimensions,
    StatusBar,
    Platform,
    ActivityIndicator,
    Alert
} from 'react-native';
import { Text } from 'react-native-paper';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSubscription } from '@/hooks';

const { width } = Dimensions.get('window');

export default function SubscriptionScreen() {
    const router = useRouter();
    const { products, isSubscribed, loading, purchasing, subscribe, restorePurchases } = useSubscription();

    const handleSubscribe = () => {
        console.log('Products loaded:', products);
        if (products.length > 0) {
            console.log('Subscribing to:', products[0].id);
            subscribe(products[0].id);
        } else {
            console.log('No products available');
            Alert.alert(
                'Produit non disponible',
                'L\'abonnement n\'est pas encore disponible. Veuillez réessayer dans quelques minutes.',
                [{ text: 'OK' }]
            );
        }
    };

    // Afficher le prix depuis le store si disponible
    const displayPrice = products.length > 0
        ? products[0].displayPrice
        : '0.99€';

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            <Stack.Screen options={{ headerShown: false }} />

            <LinearGradient
                colors={[COLORS.darkBlue, COLORS.darkest]}
                style={StyleSheet.absoluteFillObject}
            />

            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                {/* Custom Header/Navbar */}
                <View style={styles.navBar}>
                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={styles.backButton}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="chevron-back" size={28} color="white" />
                    </TouchableOpacity>
                    <Text style={styles.navTitle}>Abonnement Premium</Text>
                    <View style={{ width: 44 }} />
                </View>

                <View style={styles.headerContainer}>
                    <LinearGradient
                        colors={[COLORS.primary, '#C2185B']}
                        style={styles.iconContainer}
                    >
                        <Ionicons name="star" size={40} color="white" />
                    </LinearGradient>
                    <Text style={styles.mainTitle}>Passez au Premium</Text>
                    <Text style={styles.subtitle}>Profitez d'une expérience optimale</Text>
                </View>

                <BlurView intensity={20} tint="light" style={styles.card}>
                    <View style={styles.priceContainer}>
                        <Text style={styles.price}>{displayPrice}</Text>
                        <Text style={styles.period}>/ mois</Text>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.featuresList}>
                        <View style={styles.featureItem}>
                            <View style={styles.checkIcon}>
                                <Ionicons name="checkmark" size={16} color={COLORS.primary} />
                            </View>
                            <Text style={styles.featureText}>Plus aucune publicité</Text>
                        </View>
                        <View style={styles.featureItem}>
                            <View style={styles.checkIcon}>
                                <Ionicons name="checkmark" size={16} color={COLORS.primary} />
                            </View>
                            <Text style={styles.featureText}>Soutenez le développement de l'app</Text>
                        </View>
                    </View>
                </BlurView>

                {isSubscribed ? (
                    <View style={styles.subscribedContainer}>
                        <View style={styles.subscribedBadge}>
                            <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />
                            <Text style={styles.subscribedText}>Vous êtes abonné Premium</Text>
                        </View>
                    </View>
                ) : (
                    <>
                        <TouchableOpacity
                            onPress={handleSubscribe}
                            activeOpacity={0.8}
                            style={styles.subscribeButtonContainer}
                            disabled={purchasing || loading}
                        >
                            <LinearGradient
                                colors={[COLORS.primary, '#C2185B']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={[styles.subscribeButton, (purchasing || loading) && styles.buttonDisabled]}
                            >
                                {purchasing ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <>
                                        <Text style={styles.subscribeButtonText}>S'abonner maintenant</Text>
                                        <Ionicons name="arrow-forward" size={20} color="white" />
                                    </>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>

                        <View style={styles.legalLinks}>
                            <TouchableOpacity
                                onPress={() => router.push('/legal/cgu')}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.legalLinkText}>Conditions d'utilisation (EULA)</Text>
                            </TouchableOpacity>
                            <Text style={styles.legalSeparator}>•</Text>
                            <TouchableOpacity
                                onPress={() => router.push('/legal/politique-confidentialite')}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.legalLinkText}>Politique de confidentialité</Text>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                            onPress={restorePurchases}
                            activeOpacity={0.7}
                            style={styles.restoreButton}
                            disabled={loading}
                        >
                            <Text style={styles.restoreButtonText}>Restaurer mes achats</Text>
                        </TouchableOpacity>
                    </>
                )}

                <Text style={styles.disclaimer}>
                    L'abonnement se renouvelle automatiquement. Vous pouvez annuler à tout moment depuis les paramètres de votre compte.
                </Text>

            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    content: {
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.xxl,
    },
    navBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.xl,
    },
    navTitle: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerContainer: {
        alignItems: 'center',
        marginBottom: spacing.xl,
        marginTop: spacing.md,
    },
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.md,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    mainTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: COLORS.text,
        marginBottom: spacing.xs,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: COLORS.textMuted,
        textAlign: 'center',
    },
    card: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        overflow: 'hidden',
        padding: spacing.xl,
        marginBottom: spacing.xl,
    },
    priceContainer: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'center',
        marginBottom: spacing.lg,
    },
    price: {
        fontSize: 48,
        fontWeight: 'bold',
        color: COLORS.text,
    },
    period: {
        fontSize: 18,
        color: COLORS.textMuted,
        marginLeft: spacing.xs,
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        marginBottom: spacing.lg,
    },
    featuresList: {
        gap: spacing.md,
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    checkIcon: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'rgba(242, 46, 98, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    featureText: {
        fontSize: 16,
        color: COLORS.text,
        flex: 1,
    },
    subscribeButtonContainer: {
        marginBottom: spacing.lg,
    },
    subscribeButton: {
        height: 56,
        borderRadius: borderRadius.xl,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: spacing.sm,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 8,
    },
    subscribeButtonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
    disclaimer: {
        fontSize: 12,
        color: COLORS.textMuted,
        textAlign: 'center',
        fontStyle: 'italic',
        paddingHorizontal: spacing.md,
    },
    subscribedContainer: {
        marginBottom: spacing.lg,
    },
    subscribedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(242, 46, 98, 0.1)',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        borderRadius: borderRadius.xl,
        gap: spacing.sm,
    },
    subscribedText: {
        color: COLORS.primary,
        fontSize: 16,
        fontWeight: '600',
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    legalLinks: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        flexWrap: 'wrap',
        marginBottom: spacing.sm,
    },
    legalLinkText: {
        color: COLORS.textMuted,
        fontSize: 13,
        textDecorationLine: 'underline',
    },
    legalSeparator: {
        color: COLORS.textMuted,
        fontSize: 13,
        marginHorizontal: spacing.sm,
    },
    restoreButton: {
        alignItems: 'center',
        paddingVertical: spacing.md,
    },
    restoreButtonText: {
        color: COLORS.textMuted,
        fontSize: 14,
        textDecorationLine: 'underline',
    },
});
