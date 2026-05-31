import os
import requests
from datetime import datetime, timedelta

class AIConfigManager:
    def __init__(self, auth_service_url: str = None):
        self.auth_service_url = auth_service_url or os.getenv('AUTH_SERVICE_URL', 'http://auth-service:3001')
        self.config_cache = {}
        self.cache_expiry = 5 * 60
        self.last_fetch = {}

    def get_config(self, service_name: str) -> dict:
        try:
            if service_name in self.config_cache and service_name in self.last_fetch:
                cache_age = (datetime.now() - self.last_fetch[service_name]).total_seconds()
            if cache_age < self.cache_expiry:
                return self.config_cache[service_name]

            url = f"{self.auth_service_url}/api/ai-config/service/{service_name}"
            response = requests.get(url, timeout=5)
            data = response.json()

            if data.get('success') and data.get('data'):
                config = data['data']
                self.config_cache[service_name] = {
                    'modelName': config['modelName'],
                    'apiKey': config['apiKey'],
                    'provider': config['provider']
                }
                self.last_fetch[service_name] = datetime.now()
                return self.config_cache[service_name]

            raise Exception(f"Config non trouvée pour {service_name}")
        except Exception as error:
            fallback = self.get_fallback_config(service_name)
            if fallback:
                return fallback
            raise error

    def get_fallback_config(self, service_name: str):
        if service_name == 'cv-parser':
            return {
                'modelName': os.getenv('MISTRAL_MODEL'),
                'apiKey': os.getenv('MISTRAL_API_KEY') or os.getenv('OPENROUTER_API_KEY'),
                'provider': 'openrouter'
            }
        return None

    def clear_cache(self):
        self.config_cache = {}
        self.last_fetch = {}