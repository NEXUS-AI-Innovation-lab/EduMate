import { useState, useEffect } from 'react';
import axios from 'axios';
import './AdminPage.css';

interface AIConfig {
  id: string;
  serviceName: string;
  modelName: string;
  apiKey: string;
  provider: string;
  isActive: boolean;
  // notes supprimé
  createdAt: string;
  updatedAt: string;
  modifiedByUser?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface FormData {
  modelName: string;
  apiKey: string;
  provider: string;
}

const AdminPage = () => {
  const [configs, setConfigs] = useState<AIConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    modelName: '',
    apiKey: '',
    provider: '',
  });
  const [providerInput, setProviderInput] = useState('');
  const [providerOptions, setProviderOptions] = useState<string[]>(['openrouter', 'ollama', 'deepseek', 'mistral', 'qwen', 'gemini', 'gpt', 'claude']);

  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchConfigs();
  }, []);

  const API_URL = '/api/ai-config/global';

  const fetchConfigs = async () => {
    try {
      setLoading(true);
      const response = await axios.get(API_URL, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setConfigs(response.data.data ? [response.data.data] : []);
        setError(null);
      }
    } catch (err: any) {
      const message = err.response?.data?.message || 'Erreur lors du chargement des configurations';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('🚀 [AdminPage] handleSubmit appelé');
    console.log('📝 FormData:', { 
      modelName: formData.modelName,
      apiKey: formData.apiKey?.substring(0, 10) + '...',
      provider: formData.provider
    });
    
    if (!formData.modelName || !formData.apiKey) {
      console.error('❌ Validation échouée: champs manquants');
      setError('Veuillez remplir tous les champs obligatoires');
      return;
    }

    try {
      console.log('🌐 Envoi PUT vers:', API_URL);
      const response = await axios.put(API_URL, {
        modelName: formData.modelName,
        apiKey: formData.apiKey,
        provider: formData.provider,
        notes: formData.notes
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      console.log('✅ Réponse reçue:', response.data);
      if (response.data.success) {
        console.log('✅ Config mise à jour avec succès!');
        await fetchConfigs();
        setShowForm(false);
        setError(null);
      }
    } catch (err: any) {
      console.error('❌ Erreur lors de la sauvegarde:', err);
      console.error('❌ Réponse erreur:', err.response?.data);
      const message = err.response?.data?.message || 'Erreur lors de la sauvegarde';
      setError(message);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'provider') {
      setProviderInput(value);
      setProviderOptions(['openrouter', 'ollama', 'deepseek', 'mistral', 'qwen', 'gemini', 'gpt', 'claude'].filter(opt => opt.toLowerCase().includes(value.toLowerCase())));
      setFormData(prev => ({ ...prev, provider: value }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  
  const handleEdit = (config: AIConfig) => {
    setFormData({
      modelName: config.modelName,
      apiKey: config.apiKey,
      provider: config.provider,
    });
    setProviderInput(config.provider);
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setFormData({
      modelName: '',
      apiKey: '',
      provider: '',
    });
    setProviderInput('');
  };

  const handleToggleStatus = async (newStatus: boolean) => {
    try {
      const response = await axios.patch(
        `${API_URL}/toggle`,
        { isActive: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        await fetchConfigs();
      }
    } catch (err: any) {
      const message = err.response?.data?.message || 'Erreur lors de la modification du statut';
      setError(message);
      console.error('Erreur:', err);
    }
  };

  if (!token) {
    return (
      <div className="admin-container">
        <div className="admin-error">
          ❌ Veuillez vous connecter pour accéder à l'administration
        </div>
      </div>
    );
  }

  return (
    <div className="admin-container">
      <div className="admin-header">
        <h1>🔧 Gestion des Configurations IA</h1>
        <p className="admin-subtitle">Gérez les modèles IA et les clés API depuis un seul endroit</p>
      </div>

      {error && (
        <div className="admin-alert admin-alert-error">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)} className="alert-close">✕</button>
        </div>
      )}

      <div className="admin-actions">
        {!showForm && (
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            ⚙️ Modifier la configuration globale
          </button>
        )}
      </div>

      {showForm && (
        <div className="admin-form-container">
          <h2>Configuration globale</h2>
          <form onSubmit={handleSubmit} className="admin-form">
            <div className="form-group">
              <label>Provider *</label>
              <select
                name="provider"
                value={formData.provider}
                onChange={handleInputChange}
                required
              >
                <option value="openrouter">OpenRouter</option>
                <option value="ollama">Ollama</option>
                <option value="deepseek">DeepSeek</option>
                <option value="mistral">Mistral</option>
                <option value="qwen">Qwen</option>
                <option value="gemini">Gemini</option>
                <option value="gpt">GPT</option>
                <option value="claude">Claude</option>
                <option value="openai">OpenAI</option>
                <option value="cohere">Cohere</option>
                <option value="anthropic">Anthropic</option>
                <option value="azure">Azure</option>
                <option value="google">Google</option>
                <option value="baidu">Baidu</option>
                <option value="yandex">Yandex</option>
                <option value="huggingface">HuggingFace</option>
                <option value="palm">PaLM</option>
                <option value="sagemaker">SageMaker</option>
                <option value="vertexai">VertexAI</option>
                <option value="databricks">Databricks</option>
                <option value="aws">AWS</option>
                <option value="ibm">IBM</option>
                <option value="tencent">Tencent</option>
                <option value="xunlei">Xunlei</option>
                <option value="boson">Boson</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div className="form-group">
              <label>Modèle IA *</label>
              <input
                type="text"
                name="modelName"
                value={formData.modelName}
                onChange={handleInputChange}
                placeholder="ex: deepseek/deepseek-r1-0528:free"
                required
              />
            </div>
            <div className="form-group">
              <label>Clé API *</label>
              <input
                type="password"
                name="apiKey"
                value={formData.apiKey}
                onChange={handleInputChange}
                placeholder="sk-or-v1-..."
                required
              />
            </div>
            <div className="form-actions">
              <button type="submit" className="btn-success">
                💾 Mettre à jour
              </button>
              <button type="button" className="btn-secondary" onClick={handleCancel}>
                ❌ Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="admin-configs">
        <h2>Configuration Actuelle</h2>
        {loading ? (
          <div className="loading">Chargement des configurations...</div>
        ) : configs.length === 0 ? (
          <div className="empty-state">
            <p>Aucune configuration globale trouvée. Ajoutez-en une pour commencer.</p>
          </div>
        ) : (
          <div className="configs-grid">
            {configs.map(config => (
              <div key={config.id} className={`config-card ${!config.isActive ? 'disabled' : ''}`}>
                <div className="config-header">
                  <h3>{config.serviceName}</h3>
                  <span className={`status-badge ${config.isActive ? 'active' : 'inactive'}`}>
                    {config.isActive ? '✓ Actif' : '○ Inactif'}
                  </span>
                </div>

                <div className="config-details">
                  <div className="detail-row">
                    <span className="label">Provider:</span>
                    <span className="value">{config.provider}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Modèle:</span>
                    <span className="value">{config.modelName}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Clé API:</span>
                    <span className="value masked">
                      {config.apiKey.substring(0, 8)}...{config.apiKey.substring(config.apiKey.length - 4)}
                    </span>
                  </div>
                  {/* Notes supprimé */}
                  <div className="detail-row">
                    <span className="label">Dernier modifié:</span>
                    <span className="value">
                      {new Date(config.updatedAt).toLocaleDateString('fr-FR')} 
                      {config.modifiedByUser && ` par ${config.modifiedByUser.firstName} ${config.modifiedByUser.lastName}`}
                    </span>
                  </div>
                </div>

                <div className="config-actions">
                  <button
                    className={`btn-toggle ${config.isActive ? 'disable' : 'enable'}`}
                    onClick={() => handleToggleStatus(!config.isActive)}
                  >
                    {config.isActive ? '🔒 Désactiver' : '🔓 Activer'}
                  </button>
                  <button
                    className="btn-edit"
                    onClick={() => handleEdit(config)}
                  >
                    ✏️ Modifier
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPage;