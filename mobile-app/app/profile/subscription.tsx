import React from 'react';
import {
    View,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Dimensions,
    StatusBar,
    Platform,
    Alert
} from 'react-native';
import { Text } from 'react-native-paper';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

const { width } = Dimensions.get('window');

export default function SubscriptionScreen() {
    const router = useRouter();

    const handleSubscribe = () => {
        // Placeholder for subscription logic
        Alert.alert(
            "Abonnement",
            "Cette fonctionnalité sera bientôt disponible.",
            [{ text: "OK", onPress: () => console.log("OK Pressed") }]
        );
    };

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
                        <Text style={styles.price}>0.99€</Text>
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
                            <Text style={styles.featureText}>Support prioritaire</Text>
                        </View>
                        <View style={styles.featureItem}>
                            <View style={styles.checkIcon}>
                                <Ionicons name="checkmark" size={16} color={COLORS.primary} />
                            </View>
                            <Text style={styles.featureText}>Badge exclusif sur votre profil</Text>
                        </View>
                        <View style={styles.featureItem}>
                            <View style={styles.checkIcon}>
                                <Ionicons name="checkmark" size={16} color={COLORS.primary} />
                            </View>
                            <Text style={styles.featureText}>Soutenez le développement de l'app</Text>
                        </View>
                    </View>
                </BlurView>

                <TouchableOpacity
                    onPress={handleSubscribe}
                    activeOpacity={0.8}
                    style={styles.subscribeButtonContainer}
                >
                    <LinearGradient
                        colors={[COLORS.primary, '#C2185B']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.subscribeButton}
                    >
                        <Text style={styles.subscribeButtonText}>S'abonner maintenant</Text>
                        <Ionicons name="arrow-forward" size={20} color="white" />
                    </LinearGradient>
                </TouchableOpacity>

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
    }
});
