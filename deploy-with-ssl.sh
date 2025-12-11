#!/bin/bash
# Script de déploiement complet avec SSL pour esportnews.fr

set -e

echo "🚀 Déploiement esportnews.fr avec HTTPS"
echo "========================================"
echo ""

# 1. Obtenir le certificat SSL si pas déjà présent
if [ ! -f "/etc/letsencrypt/live/www.esportnews.fr/fullchain.pem" ]; then
    echo "🔐 Obtention du certificat SSL..."
    ./setup-ssl.sh
else
    echo "✅ Certificat SSL déjà présent"
fi

# 2. Arrêter les anciens conteneurs
echo ""
echo "⏹️  Arrêt des anciens conteneurs..."
docker-compose -f docker-compose.prod.yml down

# 3. Pull les dernières images (si besoin)
echo ""
echo "📥 Pull des images Docker..."
docker-compose -f docker-compose.prod.yml pull || true

# 4. Rebuild et redémarrer
echo ""
echo "🔨 Build et démarrage des services..."
docker-compose -f docker-compose.prod.yml up -d --build

# 5. Attendre que les services démarrent
echo ""
echo "⏳ Attente du démarrage des services..."
sleep 15

# 6. Vérifier le statut
echo ""
echo "📊 Statut des services :"
docker-compose -f docker-compose.prod.yml ps

# 7. Vérifier les logs Nginx
echo ""
echo "📝 Logs Nginx (dernières lignes) :"
docker logs esportnews-nginx-prod --tail 10

# 8. Tester l'API
echo ""
echo "🧪 Test de l'API HTTPS..."
sleep 5
curl -s https://www.esportnews.fr/api/games | head -c 200 && echo "... ✅"

echo ""
echo "✅ Déploiement terminé !"
echo ""
echo "🌐 Accès :"
echo "  - Frontend : https://www.esportnews.fr"
echo "  - API      : https://www.esportnews.fr/api"
echo ""
echo "📊 Commandes utiles :"
echo "  - Logs Nginx    : docker logs esportnews-nginx-prod -f"
echo "  - Logs Backend  : docker logs esportnews-backend-prod -f"
echo "  - Logs Frontend : docker logs esportnews-frontend-prod -f"
echo "  - Statut        : docker-compose -f docker-compose.prod.yml ps"
