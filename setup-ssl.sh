#!/bin/bash
# Script pour obtenir un certificat SSL Let's Encrypt pour esportnews.fr

set -e

echo "🔐 Configuration SSL pour esportnews.fr"
echo "========================================"
echo ""

# Vérifier que les domaines pointent bien vers le serveur
echo "📡 Vérification DNS..."
echo "www.esportnews.fr doit pointer vers 51.38.36.120"
echo "esportnews.fr doit pointer vers 51.38.36.120"
echo ""

# Demander confirmation
read -p "Les DNS sont-ils bien configurés ? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Annulé. Configure d'abord tes DNS puis relance ce script."
    exit 1
fi

# Installer certbot si pas déjà installé
if ! command -v certbot &> /dev/null; then
    echo "📦 Installation de certbot..."
    apt-get update
    apt-get install -y certbot
fi

# Arrêter Nginx temporairement pour libérer le port 80
echo "⏸️  Arrêt temporaire de Nginx..."
docker stop esportnews-nginx-prod 2>/dev/null || true

# Obtenir le certificat avec certbot standalone
echo "🔑 Obtention du certificat SSL..."
certbot certonly --standalone \
    --non-interactive \
    --agree-tos \
    --email contact@esportnews.fr \
    -d www.esportnews.fr \
    -d esportnews.fr

# Vérifier que les certificats ont bien été créés
if [ ! -f "/etc/letsencrypt/live/www.esportnews.fr/fullchain.pem" ]; then
    echo "❌ Erreur : Certificat non généré"
    exit 1
fi

echo "✅ Certificat SSL obtenu avec succès !"
echo ""
echo "📁 Emplacement des certificats :"
echo "  - Certificat : /etc/letsencrypt/live/www.esportnews.fr/fullchain.pem"
echo "  - Clé privée : /etc/letsencrypt/live/www.esportnews.fr/privkey.pem"
echo ""

# Configuration du renouvellement automatique
echo "🔄 Configuration du renouvellement automatique..."
(crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet --post-hook 'docker restart esportnews-nginx-prod'") | crontab -

echo "✅ Renouvellement automatique configuré (chaque jour à 3h)"
echo ""
echo "🚀 Tu peux maintenant déployer Nginx avec Docker Compose !"
