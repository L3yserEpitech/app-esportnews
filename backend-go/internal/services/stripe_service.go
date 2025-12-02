package services

import (
	"context"
	"fmt"
	"time"

	"github.com/stripe/stripe-go/v72"
	checkoutsession "github.com/stripe/stripe-go/v72/checkout/session"
	customerapi "github.com/stripe/stripe-go/v72/customer"
	portalsession "github.com/stripe/stripe-go/v72/billingportal/session"
	"gorm.io/gorm"

	"github.com/esportnews/backend/internal/database"
	"github.com/esportnews/backend/internal/models"
)

type StripeService struct {
	db            *gorm.DB
	stripeSecretKey string
	stripePriceID   string
	frontendURL   string
}

func NewStripeServiceWithGORM(gormDB *database.Database, stripeSecretKey string, stripePriceID string, frontendURL string) *StripeService {
	stripe.Key = stripeSecretKey
	return &StripeService{
		db:              gormDB.DB,
		stripeSecretKey: stripeSecretKey,
		stripePriceID:   stripePriceID,
		frontendURL:     frontendURL,
	}
}

// CreateStripeCustomer creates a new Stripe customer for a user
func (s *StripeService) CreateStripeCustomer(ctx context.Context, user *models.User) (string, error) {
	customerParams := &stripe.CustomerParams{
		Email: stripe.String(user.Email),
		Name:  stripe.String(user.Name),
	}

	cust, err := customerapi.New(customerParams)
	if err != nil {
		return "", fmt.Errorf("failed to create Stripe customer: %w", err)
	}

	// Update user with stripe_customer_id
	if err := s.db.WithContext(ctx).Model(user).Update("stripe_customer_id", cust.ID).Error; err != nil {
		return "", fmt.Errorf("failed to save stripe_customer_id: %w", err)
	}

	return cust.ID, nil
}

// CreateCheckoutSession creates a Stripe checkout session for subscription
func (s *StripeService) CreateCheckoutSession(ctx context.Context, userID int64, stripeCustomerID string) (string, error) {
	successURL := s.frontendURL + "/profile?section=subscription&success=true"
	cancelURL := s.frontendURL + "/profile?section=subscription"

	params := &stripe.CheckoutSessionParams{
		PaymentMethodTypes: stripe.StringSlice([]string{"card"}),
		Mode:               stripe.String(string(stripe.CheckoutSessionModeSubscription)),
		Customer:           stripe.String(stripeCustomerID),
		SuccessURL:         stripe.String(successURL),
		CancelURL:          stripe.String(cancelURL),
		LineItems: []*stripe.CheckoutSessionLineItemParams{
			{
				Price:    stripe.String(s.stripePriceID),
				Quantity: stripe.Int64(1),
			},
		},
	}

	checkoutSess, err := checkoutsession.New(params)
	if err != nil {
		return "", fmt.Errorf("failed to create checkout session: %w", err)
	}

	return checkoutSess.URL, nil
}

// GetCustomerPortalURL creates a billing portal session URL
func (s *StripeService) GetCustomerPortalURL(ctx context.Context, stripeCustomerID string, returnURL string) (string, error) {
	params := &stripe.BillingPortalSessionParams{
		Customer:  stripe.String(stripeCustomerID),
		ReturnURL: stripe.String(returnURL),
	}

	portalSess, err := portalsession.New(params)
	if err != nil {
		return "", fmt.Errorf("failed to create billing portal session: %w", err)
	}

	return portalSess.URL, nil
}

// UpdateUserSubscriptionStatus updates user subscription fields
func (s *StripeService) UpdateUserSubscriptionStatus(ctx context.Context, userID int64, updates map[string]interface{}) error {
	return s.db.WithContext(ctx).Model(&models.User{}).Where("id = ?", userID).Updates(updates).Error
}

// SetUserPremium marks user as premium
func (s *StripeService) SetUserPremium(ctx context.Context, userID int64, premium bool) error {
	return s.db.WithContext(ctx).Model(&models.User{}).Where("id = ?", userID).Update("premium", premium).Error
}

// GetUserByStripeCustomerID retrieves user by stripe_customer_id
func (s *StripeService) GetUserByStripeCustomerID(ctx context.Context, stripeCustomerID string) (*models.User, error) {
	var user models.User
	if err := s.db.WithContext(ctx).Where("stripe_customer_id = ?", stripeCustomerID).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

// GetUserByStripeSubscriptionID retrieves user by stripe_subscription_id
func (s *StripeService) GetUserByStripeSubscriptionID(ctx context.Context, stripeSubscriptionID string) (*models.User, error) {
	var user models.User
	if err := s.db.WithContext(ctx).Where("stripe_subscription_id = ?", stripeSubscriptionID).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

// BuildSubscriptionUpdateMap builds a map of fields to update from a Stripe subscription
func (s *StripeService) BuildSubscriptionUpdateMap(stripeSubscription *stripe.Subscription) map[string]interface{} {
	updateMap := map[string]interface{}{
		"stripe_subscription_id": stripeSubscription.ID,
		"subscription_status":    string(stripeSubscription.Status),
		"subscription_updated_at": time.Now(),
	}

	if stripeSubscription.CurrentPeriodStart != 0 {
		updateMap["subscription_current_period_start"] = time.Unix(stripeSubscription.CurrentPeriodStart, 0)
	}

	if stripeSubscription.CurrentPeriodEnd != 0 {
		updateMap["subscription_current_period_end"] = time.Unix(stripeSubscription.CurrentPeriodEnd, 0)
	}

	if stripeSubscription.Created != 0 {
		updateMap["subscription_created_at"] = time.Unix(stripeSubscription.Created, 0)
	}

	if stripeSubscription.CanceledAt != 0 {
		updateMap["subscription_canceled_at"] = time.Unix(stripeSubscription.CanceledAt, 0)
	}

	// Set premium based on status
	premium := stripeSubscription.Status == stripe.SubscriptionStatusActive || stripeSubscription.Status == stripe.SubscriptionStatusPastDue
	updateMap["premium"] = premium

	return updateMap
}
