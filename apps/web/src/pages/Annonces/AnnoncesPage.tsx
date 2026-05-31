import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styles from './AnnoncesPage.module.css';
import annonceService from '../../services/annonceService';
import type { AnnonceFromDB } from '../../services/annonceService';
import EditAnnonceForm from '../../components/EditAnnonceForm/EditAnnonceForm';
import DeleteAnnonceModal from '../../components/DeleteAnnonceModal/DeleteAnnonceModal';
import TransformSkillToAnnonceModal from '../../components/TransformSkillToAnnonceModal/TransformSkillToAnnonceModal';

const AnnoncesPage: React.FC = () => {
  const [annonces, setAnnonces] = useState<AnnonceFromDB[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingAnnonce, setEditingAnnonce] = useState<AnnonceFromDB | null>(null);
  const [deletingAnnonce, setDeletingAnnonce] = useState<AnnonceFromDB | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showTransformModal, setShowTransformModal] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [userAvailability, setUserAvailability] = useState<{
    online: boolean;
    inPerson: boolean;
  } | null>(null);
  const [sortBy, setSortBy] = useState<'recent' | 'oldest' | 'active' | 'inactive'>('recent');
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [expandedDescriptions, setExpandedDescriptions] = useState<{[key: string]: boolean}>({});

  useEffect(() => {
    setDebugInfo(`Modal: ${showTransformModal}, Profile: ${!!userProfile}`);
  }, [showTransformModal, userProfile]);

  useEffect(() => {
    loadMyAnnonces();
    loadUserProfile();
  }, []);

  const loadMyAnnonces = async () => {
    try {
      setIsLoading(true);
      const response = await annonceService.getMyAnnonces();
      if (response.success) {
        setAnnonces(response.data || []);
      }
    } catch (error) {
      console.error('Erreur chargement annonces:', error);
      setAnnonces([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadUserProfile = async () => {
    try {
      const profileData = localStorage.getItem('profileData');
      
      if (profileData) {
        const parsed = JSON.parse(profileData);
                
        // Essayer différents chemins d'accès
        let availability = null;
        let profile = null;
        
        if (parsed.data?.profile) {
          profile = parsed.data.profile;
          availability = parsed.data.profile.availability;
          console.log('✅ Profil trouvé dans data.profile:', profile);
        }
        else if (parsed.profile) {
          profile = parsed.profile;
          availability = parsed.profile.availability;
          console.log('✅ Profil trouvé dans profile:', profile);
        }
        else if (parsed) {
          profile = parsed;
          availability = parsed.availability;
          console.log('✅ Profil trouvé dans racine:', profile);
        }
        
        if (profile) {
          setUserProfile(profile);
          console.log('📊 userProfile défini:', profile);
        }
        
        if (availability) {
          setUserAvailability(availability);
        } else {
          setUserAvailability({ online: false, inPerson: false });
        }
      }
      
      // Toujours charger depuis l'API pour avoir les données fraîches
      await loadProfileFromAPI();
      
    } catch (error) {
      console.error('Erreur chargement profil:', error);
      await loadProfileFromAPI();
    }
  };

  const loadProfileFromAPI = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      
      const response = await fetch('/api/profile', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.success && data.data) {
          // Chercher la disponibilité dans différentes structures
          let availability = null;
          let profileData = null;
          
          if (data.data.profile?.availability) {
            availability = data.data.profile.availability;
            profileData = data.data.profile;
          }
          else if (data.data.user?.availability) {
            availability = data.data.user.availability;
            profileData = data.data.user;
          }
          else if (data.data.availability) {
            availability = data.data.availability;
          }
          
          if (availability) {
            const formattedAvailability = {
              online: Boolean(availability.online),
              inPerson: Boolean(availability.inPerson)
            };
            
            setUserAvailability(formattedAvailability);
          } else {
            console.log('⚠️ Pas de disponibilité dans la réponse API');
            setUserAvailability({ online: false, inPerson: false });
          }
          
          localStorage.setItem('profileData', JSON.stringify(data.data));
        }
      }
    } catch (apiError) {
      console.error('Erreur API profile:', apiError);
      setUserAvailability({ online: false, inPerson: false });
    }
  };

  // Fonction pour formater la disponibilité en texte lisible
  const formatAvailability = () => {
    if (!userAvailability) return 'Non spécifié';
    
    const { online, inPerson } = userAvailability;
    
    if (online && inPerson) {
      return 'En ligne et en présentiel';
    } else if (online) {
      return 'En ligne uniquement';
    } else if (inPerson) {
      return 'En présentiel uniquement';
    } else {
      return 'Non disponible';
    }
  };

  const handleEditAnnonce = (annonce: AnnonceFromDB) => {
    setEditingAnnonce(annonce);
  };

  const handleCancelEdit = () => {
    setEditingAnnonce(null);
  };

  const handleUpdateAnnonce = (updatedAnnonce: AnnonceFromDB) => {
    setAnnonces(prev => prev.map(annonce => 
      annonce.id === updatedAnnonce.id ? updatedAnnonce : annonce
    ));
    setEditingAnnonce(null);
  };

  const handleToggleStatus = async (annonceId: string, isActive: boolean) => {
    try {
      const annonce = annonces.find(a => a.id === annonceId);
      if (!annonce) return;
      
      const updatedData = {
        ...annonce,
        isActive: isActive
      };
      
      const response = await annonceService.updateAnnonce(annonceId, updatedData);
      if (response.success) {
        setAnnonces(prev => prev.map(annonce => 
          annonce.id === annonceId ? { ...annonce, isActive } : annonce
        ));
      }
    } catch (error) {
      console.error('Erreur changement statut:', error);
    }
  };

  const handleDeleteAnnonce = (annonce: AnnonceFromDB) => {
    setDeletingAnnonce(annonce);
  };

  const handleCancelDelete = () => {
    setDeletingAnnonce(null);
  };

  const handleConfirmDelete = async () => {
    if (!deletingAnnonce) return;

    setIsDeleting(true);
    try {
      const response = await annonceService.deleteAnnonce(deletingAnnonce.id);
      if (response.success) {
        setAnnonces(prev => prev.filter(annonce => annonce.id !== deletingAnnonce.id));
        setDeletingAnnonce(null);
      } else {
        console.error('Erreur suppression annonce:', response.message);
      }
    } catch (error) {
      console.error('Erreur suppression annonce:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCreateAnnonce = () => {
    // Vérifier si on a un profil
    if (!userProfile) {
      loadUserProfile();
    }
    
    setShowTransformModal(true); 
    
    setTimeout(() => {
      console.log('6. Valeur après timeout:', showTransformModal);
    }, 100);
  };

  const handleCloseTransformModal = () => {
    setShowTransformModal(false);
  };

  const handleAnnonceCreated = () => {
    loadMyAnnonces();
    setShowTransformModal(false);
  };

  const formatDate = (dateInput?: string | Date | null): string => {
    if (!dateInput) return 'Date non disponible';
    
    try {
      const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
      if (isNaN(date.getTime())) {
        return 'Date invalide';
      }
      
      return date.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return 'Date invalide';
    }
  };

  // Fonction pour basculer l'expansion de la description
  const toggleDescription = (annonceId: string) => {
    setExpandedDescriptions(prev => ({
      ...prev,
      [annonceId]: !prev[annonceId]
    }));
  };

  const getSortedAnnonces = () => {
    const sorted = [...annonces];
    
    switch (sortBy) {
      case 'recent':
        return sorted.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });
        
      case 'oldest':
        return sorted.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateA - dateB;
        });
        
      case 'active':
        return sorted.sort((a, b) => {
          if (a.isActive === b.isActive) return 0;
          return a.isActive ? -1 : 1;
        });
        
      case 'inactive':
        return sorted.sort((a, b) => {
          if (a.isActive === b.isActive) return 0;
          return a.isActive ? 1 : -1;
        });
        
      default:
        return sorted;
    }
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingContainer}>
          <div className={styles.spinner}></div>
          <p>Chargement de vos annonces...</p>
        </div>
      </div>
    );
  }

  const sortedAnnonces = getSortedAnnonces();
  const activeCount = annonces.filter(a => a.isActive).length;
  const inactiveCount = annonces.filter(a => !a.isActive).length;

  return (
    <div className={styles.container}>
      {/* Header principal */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.headerText}>
            <h1>Mes annonces</h1>
            <p>Gérez vos offres de cours et suivez vos performances</p>
          </div>
        </div>
        
        {annonces.length > 0 && (
          <div className={styles.statsOverview}>
            <div className={styles.statItem}>
              <div className={styles.statValue}>{annonces.length}</div>
              <div className={styles.statLabel}>Total</div>
            </div>
            <div className={styles.statItem}>
              <div className={styles.statValue}>{activeCount}</div>
              <div className={styles.statLabel}>Actives</div>
            </div>
            <div className={styles.statItem}>
              <div className={styles.statValue}>{inactiveCount}</div>
              <div className={styles.statLabel}>Inactives</div>
            </div>
          </div>
        )}
      </div>

      {/* Section principale */}
      <main className={styles.mainContent}>
        {/* Header avec actions */}
        <div className={styles.contentHeader}>
          <div className={styles.headerLeft}>
            {annonces.length > 0 && (
              <div className={styles.sortContainer}>
                <span className={styles.sortLabel}>Trier par :</span>
                <select 
                  className={styles.sortSelect} 
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                >
                  <option value="recent">Plus récentes</option>
                  <option value="oldest">Plus anciennes</option>
                  <option value="active">Actives d'abord</option>
                  <option value="inactive">Inactives d'abord</option>
                </select>
              </div>
            )}
          </div>

          {/* Bouton Créer une autre annonce - À DROITE */}
          {annonces.length > 0 && (
            <div className={styles.headerActions}>
              <button 
                onClick={handleCreateAnnonce} 
                className={styles.btnPrimary}
              >
                <span className={styles.buttonPlus}>+</span>
                Créer une autre annonce
              </button>
            </div>
          )}
        </div>

        {/* Liste des annonces ou état vide */}
        {annonces.length > 0 ? (
          <div className={styles.annoncesGrid}>
            {sortedAnnonces.map((annonce) => {
              const isExpanded = expandedDescriptions[annonce.id];
              const description = annonce.description || '';
              const shouldShowReadMore = description.length > 120;
              const displayDescription = isExpanded 
                ? description 
                : (shouldShowReadMore ? `${description.substring(0, 120)}...` : description);
              
              return (
                <div key={annonce.id} className={styles.card}>
                  {/* En-tête de la carte */}
                  <div className={styles.cardHeader}>
                    <div className={styles.titleWithIcon}>
                      <h3>{annonce.title}</h3>
                      <span className={styles.annonceCode}>#{annonce.id.slice(-6)}</span>
                    </div>
                    
                    <div className={styles.cardActions}>
                      <button
                        className={`${styles.statusButton} ${annonce.isActive ? styles.statusActive : styles.statusInactive}`}
                        onClick={() => handleToggleStatus(annonce.id, !annonce.isActive)}
                      >
                        <span className={`${styles.statusDot} ${annonce.isActive ? styles.dotActive : styles.dotInactive}`}></span>
                        {annonce.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </div>
                  </div>

                  {/* Métadonnées */}
                  <div className={styles.annonceMeta}>
                    <span className={styles.annonceDate}>
                      Créé le {formatDate(annonce.createdAt)}
                    </span>
                    <span className={`${styles.statusBadge} ${annonce.isActive ? 'statusCompleted' : 'statusPending'}`}>
                      {annonce.isActive ? 'Visible' : 'En attente'}
                    </span>
                  </div>

                  {/* Détails de l'annonce */}
                  <div className={styles.annonceDetails}>
                    {/* Compétences sur la même ligne */}
                    <div className={styles.skillsRow}>
                      {/* Compétences enseignées - Gauche */}
                      <div className={styles.skillsColumn}>
                        <label className={styles.detailLabel}>Compétences enseignées</label>
                        <div className={styles.skillsContainer}>
                          {annonce.subjects?.map((subject: string, index: number) => (
                            <span key={index} className={styles.skillTag}>
                              {subject}
                            </span>
                          )) || 'Non spécifié'}
                        </div>
                      </div>

                      {/* Compétences à acquérir - Droite */}
                      {userProfile?.skillsToLearn && userProfile.skillsToLearn.length > 0 && (
                        <div className={styles.skillsColumn}>
                          <label className={styles.detailLabel}>Compétences recherchées</label>
                          <div className={styles.skillsContainer}>
                            {userProfile.skillsToLearn.map((skill: string, index: number) => (
                              <span key={index} className={`${styles.skillTag} ${styles.learningSkill}`}>
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Grille d'informations */}
                    <div className={styles.infoGrid}>
                      <div className={styles.infoItem}>
                        <label className={styles.infoLabel}>Niveau</label>
                        <span className={styles.infoValue}>{annonce.level || 'Tous niveaux'}</span>
                      </div>
                      
                      <div className={styles.infoItem}>
                        <label className={styles.infoLabel}>Tarif horaire</label>
                        <span className={styles.priceValue}>
                          <span className={styles.priceAmount}>{annonce.hourlyRate || 0}🪙</span>
                          <span className={styles.priceUnit}>/heure</span>
                        </span>
                      </div>
                      
                      {/* Mode d'enseignement */}
                      <div className={styles.infoItem}>
                        <label className={styles.infoLabel}>Mode</label>
                        <span className={`${styles.modeValue} ${
                          userAvailability?.online && !userAvailability?.inPerson ? styles.modeRemote : 
                          !userAvailability?.online && userAvailability?.inPerson ? styles.modeInPerson : 
                          styles.modeBoth}`}>
                          {userAvailability ? 
                            (userAvailability.online && userAvailability.inPerson ? 'Les deux' :
                            userAvailability.online ? 'À distance' :
                            userAvailability.inPerson ? 'En présentiel' : 'Non spécifié') : 
                            'Non spécifié'}
                        </span>
                      </div>    
                    </div>

                    {/* Description */}
                    {description && (
                      <div className={styles.descriptionSection}>
                        <label className={styles.descriptionLabel}>Description</label>
                        <p className={styles.annonceDescription}>
                          {displayDescription}
                        </p>
                        {shouldShowReadMore && (
                          <button 
                            className={styles.btnText} 
                            onClick={() => toggleDescription(annonce.id)}
                          >
                            {isExpanded ? 'Voir moins' : 'Lire la suite'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className={styles.cardFooter}>
                    <div className={styles.actionButtons}>
                      <button
                        onClick={() => handleEditAnnonce(annonce)}
                        className={styles.btnPrimary}
                        style={{ minWidth: '120px' }}
                      >
                        Modifier
                      </button>
                      <button
                        onClick={() => handleDeleteAnnonce(annonce)}
                        className={styles.btnSecondary}
                        style={{ minWidth: '120px' }}
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <div className={styles.emptyStateContent}>
              <h4>Aucune annonce publiée</h4>
              <p>
                Créez votre première annonce pour commencer à proposer vos cours aux élèves.
                Décrivez vos compétences, fixez votre tarif et commencez à enseigner.
              </p>
              
              <div className={styles.emptyStateTips}>
                <div className={styles.tipItem}>
                  <div className={styles.tipBullet}></div>
                  <span>Précisez vos compétences principales</span>
                </div>
                <div className={styles.tipItem}>
                  <div className={styles.tipBullet}></div>
                  <span>Définissez un tarif horaire compétitif</span>
                </div>
                <div className={styles.tipItem}>
                  <div className={styles.tipBullet}></div>
                  <span>Décrivez votre méthode d'enseignement</span>
                </div>
              </div>
            {/* BOUTON "Créer ma première annonce" DANS L'ÉTAT VIDE */}
              <div className={styles.emptyStateActions}>
                <button 
                  onClick={handleCreateAnnonce} 
                  className={styles.btnPrimary}
                  style={{ padding: '1rem 2rem', fontSize: '1.1rem' }}
                >
                  <span className={styles.buttonPlus}>+</span>
                  Créer ma première annonce
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      {editingAnnonce && (
        <EditAnnonceForm
          annonce={editingAnnonce}
          onCancel={handleCancelEdit}
          onUpdate={handleUpdateAnnonce}
          onToggleStatus={handleToggleStatus}
        />
      )}

      {deletingAnnonce && (
        <DeleteAnnonceModal
          annonceTitle={deletingAnnonce.title}
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
          isLoading={isDeleting}
        />
      )}

      {/* Modal de création d'annonce */}
      {showTransformModal && userProfile && (
        <TransformSkillToAnnonceModal
          skills={userProfile?.skillsToTeach || []}
          onClose={handleCloseTransformModal}
          onCreated={handleAnnonceCreated}
          profileData={userProfile}
        />
      )}
    </div>
  );
};

export default AnnoncesPage;