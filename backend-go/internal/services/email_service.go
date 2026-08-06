package services

import (
	"context"
	"fmt"
	"time"

	"github.com/resend/resend-go/v2"
)

type EmailService struct {
	client    *resend.Client
	emailFrom string
}

func NewEmailService(resendAPIKey string, emailFrom string) *EmailService {
	client := resend.NewClient(resendAPIKey)
	return &EmailService{
		client:    client,
		emailFrom: emailFrom,
	}
}

// SendSubscriptionConfirmation sends a subscription confirmation email
func (e *EmailService) SendSubscriptionConfirmation(ctx context.Context, userEmail, username string, nextBillingDate time.Time) error {
	subject := "Bienvenue dans esportnews Premium"

	html := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<style>
		body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
		.container { max-width: 600px; margin: 0 auto; padding: 20px; }
		.header { background-color: #F22E62; color: white; padding: 20px; border-radius: 5px; }
		.content { padding: 20px; border: 1px solid #ddd; border-radius: 5px; margin-top: 10px; }
		.cta { display: inline-block; background-color: #F22E62; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 15px; }
		.footer { margin-top: 20px; font-size: 12px; color: #666; }
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<h1>Bienvenue dans esportnews Premium!</h1>
		</div>
		<div class="content">
			<p>Bonjour %s,</p>
			<p>Merci d'avoir souscrit à esportnews Premium! 🎮</p>

			<h3>Détails de votre abonnement</h3>
			<ul>
				<li><strong>Plan:</strong> esportnews Premium</li>
				<li><strong>Montant:</strong> 0.99€/mois</li>
				<li><strong>Prochaine facturation:</strong> %s</li>
			</ul>

			<p>Vous pouvez maintenant accéder à tous les contenus premium exclusifs et profiter d'une expérience sans interruption.</p>

			<a href="https://www.esportnews.fr/profile?section=subscription" class="cta">Gérer mon abonnement</a>

			<h3>Besoin d'aide?</h3>
			<p>Si vous avez des questions, contactez-nous à contact@esportnews.fr</p>
		</div>
		<div class="footer">
			<p>© 2024 esportnews. Tous droits réservés.</p>
		</div>
	</div>
</body>
</html>
	`, username, nextBillingDate.Format("02 janvier 2006"))

	request := &resend.SendEmailRequest{
		From:    e.emailFrom,
		To:      []string{userEmail},
		Subject: subject,
		Html:    html,
	}

	sent, err := e.client.Emails.Send(request)
	if err != nil {
		return fmt.Errorf("failed to send confirmation email: %w", err)
	}

	if sent.Id == "" {
		return fmt.Errorf("email sent but no ID returned")
	}

	return nil
}

// SendSubscriptionCancelled sends a subscription cancellation email
func (e *EmailService) SendSubscriptionCancelled(ctx context.Context, userEmail, username string) error {
	subject := "Votre abonnement esportnews Premium a été annulé"

	html := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<style>
		body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
		.container { max-width: 600px; margin: 0 auto; padding: 20px; }
		.header { background-color: #091626; color: white; padding: 20px; border-radius: 5px; }
		.content { padding: 20px; border: 1px solid #ddd; border-radius: 5px; margin-top: 10px; }
		.cta { display: inline-block; background-color: #F22E62; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 15px; }
		.footer { margin-top: 20px; font-size: 12px; color: #666; }
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<h1>Abonnement annulé</h1>
		</div>
		<div class="content">
			<p>Bonjour %s,</p>
			<p>Votre abonnement esportnews Premium a été annulé avec succès.</p>

			<h3>Détails</h3>
			<ul>
				<li><strong>Plan:</strong> esportnews Premium</li>
				<li><strong>Statut:</strong> Annulé</li>
				<li><strong>Date d'annulation:</strong> %s</li>
			</ul>

			<p>Vous pouvez toujours accéder au contenu gratuit d'esportnews.</p>

			<h3>Vous nous manquez!</h3>
			<p>Si vous avez des retours ou des suggestions, nous aimerions les entendre.</p>

			<a href="https://www.esportnews.fr/profile?section=subscription" class="cta">Retourner à mon compte</a>
		</div>
		<div class="footer">
			<p>© 2024 esportnews. Tous droits réservés.</p>
		</div>
	</div>
</body>
</html>
	`, username, time.Now().Format("02 janvier 2006"))

	request := &resend.SendEmailRequest{
		From:    e.emailFrom,
		To:      []string{userEmail},
		Subject: subject,
		Html:    html,
	}

	sent, err := e.client.Emails.Send(request)
	if err != nil {
		return fmt.Errorf("failed to send cancellation email: %w", err)
	}

	if sent.Id == "" {
		return fmt.Errorf("email sent but no ID returned")
	}

	return nil
}

// SendPasswordReset sends the reset link. The URL is built by the caller so the
// service stays unaware of the frontend's routing.
func (e *EmailService) SendPasswordReset(ctx context.Context, userEmail, resetURL string) error {
	subject := "Réinitialisation de votre mot de passe esportnews"

	html := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<style>
		body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
		.container { max-width: 600px; margin: 0 auto; padding: 20px; }
		.header { background-color: #F22E62; color: white; padding: 20px; border-radius: 5px; }
		.content { padding: 20px; border: 1px solid #ddd; border-radius: 5px; margin-top: 10px; }
		.cta { display: inline-block; background-color: #F22E62; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-top: 15px; }
		.fallback { margin-top: 20px; font-size: 12px; color: #666; word-break: break-all; }
		.footer { margin-top: 20px; font-size: 12px; color: #666; }
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<h1>Réinitialisation de mot de passe</h1>
		</div>
		<div class="content">
			<p>Bonjour,</p>
			<p>Vous avez demandé à réinitialiser le mot de passe de votre compte esportnews. Cliquez sur le bouton ci-dessous pour en choisir un nouveau :</p>
			<a href="%s" class="cta">Choisir un nouveau mot de passe</a>
			<p class="fallback">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br>%s</p>
			<p><strong>Ce lien est valable 1 heure</strong> et ne peut servir qu'une seule fois.</p>
			<p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail : votre mot de passe restera inchangé.</p>
		</div>
		<div class="footer">
			<p>© esportnews. Tous droits réservés.</p>
		</div>
	</div>
</body>
</html>
	`, resetURL, resetURL)

	request := &resend.SendEmailRequest{
		From:    e.emailFrom,
		To:      []string{userEmail},
		Subject: subject,
		Html:    html,
	}

	sent, err := e.client.Emails.Send(request)
	if err != nil {
		return fmt.Errorf("failed to send password reset email: %w", err)
	}
	if sent.Id == "" {
		return fmt.Errorf("password reset email sent but no ID returned")
	}
	return nil
}
