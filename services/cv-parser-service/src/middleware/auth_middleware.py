# src/middleware/auth_middleware.py

import os
import logging
from functools import wraps
from typing import Optional, Dict, Any

import requests
from flask import request, jsonify, g

# Configuration du logger pour tout voir
logger = logging.getLogger(__name__)
if not logger.hasHandlers():
    logging.basicConfig(
        level=logging.DEBUG,  # DEBUG pour tout voir
        format="%(asctime)s [%(levelname)s] %(name)s - %(message)s"
    )

def auth_middleware(req):
    """
    Middleware pour valider le token JWT via auth-service
    et blacklister automatiquement le token invalide.
    """
    # ⚡ Autoriser les requêtes OPTIONS (préflight) sans token
    if req.method == 'OPTIONS':
        logger.debug("Requête OPTIONS détectée → autorisée pour CORS")
        return '', 200

    # 1️⃣ Routes publiques
    public_routes = ['/health', '/api/cv/health']
    if req.path in public_routes:
        logger.debug(f"Route publique accédée: {req.path}")
        return None

    # 2️⃣ Vérifier l'Authorization header
    auth_header = req.headers.get('Authorization')
    if not auth_header:
        logger.warning("❌ Requête sans token d'autorisation")
        return jsonify({'success': False, 'message': 'Token manquant'}), 401

    token = auth_header.split(' ')[1] if ' ' in auth_header else auth_header
    backend_url = os.getenv('BACKEND_URL', 'http://auth-service:3001')

    logger.debug(f"Token reçu: {token[:10]}...")  # cache partiel pour sécurité

    try:
        # 3️⃣ Valider le token via auth-service
        logger.debug("🔎 Vérification du token auprès du auth-service...")
        response = requests.get(
            f"{backend_url}/api/auth/check",
            headers={'Authorization': f'Bearer {token}'},
            timeout=5
        )

        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                g.current_user = data.get('data')
                logger.info(f"✅ Token validé pour: {g.current_user.get('email')}")
                return None
            else:
                logger.warning(f"Token invalide → {data.get('message')}")
        else:
            logger.warning(f"Erreur backend auth-service: {response.status_code}")

        # 4️⃣ Token invalide → blacklister via logout
        try:
            logger.debug("⚠️ Token invalide, tentative de blacklisting via auth-service...")
            logout_resp = requests.post(
                f"{backend_url}/api/auth/logout",
                headers={'Authorization': f'Bearer {token}'},
                timeout=5
            )
            if logout_resp.status_code == 200:
                logger.info("✅ Token blacklisté via auth-service")
            else:
                logger.warning(f"⚠️ Échec blacklisting token: {logout_resp.status_code}")
        except requests.RequestException as e:
            logger.error(f"Impossible de blacklister le token: {e}")

        # 5️⃣ Retour 401 pour forcer la déconnexion côté frontend
        logger.debug("💀 Renvoi 401 pour forcer la déconnexion")
        return jsonify({'success': False, 'message': 'Token invalide, vous avez été déconnecté'}), 401

    except requests.RequestException as e:
        logger.error(f"Erreur connexion auth-service: {e}")
        return jsonify({'success': False, 'message': 'Erreur interne lors de la validation du token'}), 500



def require_auth(f):
    """
    Décorateur pour protéger les routes
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        res = auth_middleware(request)
        if res:
            logger.debug("🔒 Accès refusé par auth_middleware")
            return res
        logger.debug("🔑 Accès autorisé")
        return f(*args, **kwargs)
    return decorated


def get_current_user() -> Optional[Dict[str, Any]]:
    """
    Récupérer l'utilisateur courant injecté par auth_middleware
    """
    user = getattr(g, 'current_user', None)
    if user:
        logger.debug(f"Utilisateur courant récupéré depuis g: {user.get('email')}")
    else:
        logger.debug("Aucun utilisateur courant dans g")
    return user
