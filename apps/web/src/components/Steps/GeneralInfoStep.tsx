import React, { useRef, useState, useEffect, useCallback } from 'react';
import styles from './GeneralInfoStep.module.css';
import defaultAvatar from '../../assets/images/avatar.jpg';
import { allCountries } from 'country-telephone-data';
import Cropper, { type Point, type Area } from "react-easy-crop";
import { getCroppedImg } from "../../utils/cropImage";
import { allSkills } from '../../data/skillsData';
import cvService, { type CVParseResponse, type CVData } from '../../services/cvService';
import linkedinService from '../../services/linkedinService';

const TS_Cropper = Cropper as unknown as React.FC<any>;

// Définir une interface propre pour les données du profil
interface ProfileData {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  countryCode?: string;
  gender?: string;
  birthDate?: string;
  address?: string;
  bio?: string;
  skills?: string[];
  profilePicture?: string;
  cvFile?: File | null;
  diplomas?: Array<{
    educationLevel: string;
    field: string;
    school: string;
    country: string;
    startYear: number;
    endYear?: number;
    isCurrent: boolean;
    diplomaName?: string;
  }>;
  experiences?: Array<{
    jobTitle: string;
    employmentType: string;
    company: string;
    location: string;
    startMonth: string;
    startYear: number;
    endMonth?: string;
    endYear?: number;
    isCurrent: boolean;
    description: string;
    achievements?: string[];
  }>;
  location?: {
    latitude?: string;
    longitude?: string;
    city?: string;
  };
}

interface Country {
  name: string;
  dialCode: string;
  iso2: string;
}

import { useNavigate } from 'react-router-dom';
import TransformSkillToAnnonceModal from '../TransformSkillToAnnonceModal/TransformSkillToAnnonceModal';
import DefineLearningSkillsModal from '../DefineLearningSkillsModal/DefineLearningSkillsModal.tsx'; 

interface GeneralInfoStepProps {
  profileData: any;
  setProfileData: (data: any) => void;
  role: 'student' | 'tutor';
  errors: { [key: string]: string };
  setErrors: React.Dispatch<React.SetStateAction<{ [key: string]: string }>>;
  touched: { [key: string]: boolean };
  setTouched: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>;
}

interface Suggestion {
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    country?: string;
  };
}

interface ParsedCVData {
  personal?: {
    firstName?: string;
    lastName?: string;
    email?: string[];
    phone?: string[];
    address?: string;
    birthDate?: string;
    gender?: string;
  };
  education?: Array<{
    educationLevel: string;
    field: string;
    school: string;
    country: string;
    startYear: number;
    endYear?: number;
    isCurrent: boolean;
    diplomaName?: string;
  }>;
  experience?: Array<{
    jobTitle: string;
    employmentType: string;
    company: string;
    location: string;
    startMonth: string;
    startYear: number;
    endMonth?: string;
    endYear?: number;
    isCurrent: boolean;
    description: string;
    achievements?: string[];
  }>;
  skills?: {
    technical: string[];
    languages?: string[];
    soft?: string[];
  };
  summary?: string;
  validation?: {
    quality?: string;
  };
}

// Interface pour les données de pays
interface CountryData {
  name: string;
  code: string;
  flag: string;
  iso2: string;
}

// Composant pour la barre de recherche de compétences
const SkillsInput: React.FC<{
  skills: string[];
  onSkillsChange: (skills: string[]) => void;
  role: 'student' | 'tutor';
}> = ({ skills, onSkillsChange, role }) => {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(event.target as Node) &&
          suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
        setSelectedIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;

      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;

      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleAddSkill(suggestions[selectedIndex]);
        } else if (inputValue.trim() && !skills.includes(inputValue.trim())) {
          handleAddSkill(inputValue.trim());
        }
        break;

      case 'Escape':
        e.preventDefault();
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const handleAddSkill = (skill: string) => {
    if (!skills.includes(skill) && skill.trim()) {
      const newSkills = [...skills, skill.trim()];
      onSkillsChange(newSkills);
    }
    setInputValue('');
    setShowSuggestions(false);
    setSelectedIndex(-1);
  };

  const handleRemoveSkill = (skill: string) => {
    const newSkills = skills.filter(s => s !== skill);
    onSkillsChange(newSkills);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    setSelectedIndex(-1);
    if (value.trim()) {
      const searchTerm = value.toLowerCase();

      const startsWithMatches = allSkills.filter(skill =>
        skill.toLowerCase().startsWith(searchTerm) &&
        !skills.includes(skill)
      ).sort((a, b) => a.localeCompare(b));

      const includesMatches = allSkills.filter(skill =>
        skill.toLowerCase().includes(searchTerm) &&
        !skill.toLowerCase().startsWith(searchTerm) &&
        !skills.includes(skill)
      ).sort((a, b) => a.localeCompare(b));

      const filtered = [...startsWithMatches, ...includesMatches].slice(0, 10);

      setSuggestions(filtered);
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const highlightMatch = (text: string, search: string) => {
    if (!search.trim()) return text;

    const lowerText = text.toLowerCase();
    const lowerSearch = search.toLowerCase();
    const matchIndex = lowerText.indexOf(lowerSearch);

    if (matchIndex === -1) return text;

    const before = text.substring(0, matchIndex);
    const match = text.substring(matchIndex, matchIndex + search.length);
    const after = text.substring(matchIndex + search.length);

    return (
      <>
        {before}
        <strong style={{ color: '#FBBF24' }}>{match}</strong>
        {after}
      </>
    );
  };

  return (
    <div className={styles.skillsContainer}>
      <p className={styles.helpText}>
          Quelles compétences souhaitez-vous acquérir ?
          Quelles compétences possédez-vous ? 
      </p>
    </div>
  );
};

const GeneralInfoStep: React.FC<GeneralInfoStepProps> = ({
  profileData,
  setProfileData,
  role,
  errors,
  setErrors,
  touched,
  setTouched
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const addressInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [hasBeenValidated, setHasBeenValidated] = useState(false);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [cropping, setCropping] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [importStatus, setImportStatus] = useState<{ message: string; success: boolean }>({
    message: '',
    success: false,
  });
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);
  const [showTransformModal, setShowTransformModal] = useState(false);
  const [showLearningSkillsModal, setShowLearningSkillsModal] = useState(false);

  const countries: CountryData[] = allCountries.map((country: Country) => ({
    name: country.name,
    code: country.dialCode,
    flag: getFlagEmoji(country.iso2.toUpperCase()),
    iso2: country.iso2.toUpperCase(),
  }));

  function getFlagEmoji(countryCode: string): string {
    const codePoints = countryCode
      .toUpperCase()
      .split('')
      .map((char) => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  }

  const formatDateForInput = (dateString: string | undefined): string => {
    if (!dateString) return '';
    try {
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        return dateString;
      }
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        console.warn('Date invalide:', dateString);
        return '';
      }
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch (error) {
      console.error('Erreur formatage date:', error, dateString);
      return '';
    }
  };

  useEffect(() => {
    const france = countries.find((c) => c.iso2 === 'FR');
    if (france && (!profileData.countryCode || profileData.countryCode.trim() === '')) {
      setProfileData((prev: ProfileData) => ({
        ...prev,
        countryCode: france.code,
      }));
    }
  }, [countries, profileData.countryCode, setProfileData]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        addressInputRef.current &&
        !addressInputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [alreadyCalled, setAlreadyCalled] = useState(false);

  // Handle LinkedIn OAuth success redirect on component mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const linkedinSuccess = urlParams.get('linkedin');
    const token = urlParams.get('token');

    if (linkedinSuccess === 'success' && token && !alreadyCalled) {
      console.log('🔗 LinkedIn OAuth success détecté, récupération des données...');
      setAlreadyCalled(true);
      setIsParsing(true);
      setImportStatus({ message: 'Récupération des données LinkedIn...', success: false });

      linkedinService.getMe(token)
        .then((response) => {
          if (response.success && response.linkedin) {
            // Map LinkedIn data to form fields
            setProfileData((prev: ProfileData) => ({
              ...prev,
              firstName: response.linkedin.firstName || prev.firstName,
              lastName: response.linkedin.lastName || prev.lastName,
              email: response.linkedin.email || prev.email,
            }));

            setImportStatus({
              message: 'Profil LinkedIn importé avec succès',
              success: true
            });

            // Clean up URL parameters
            window.history.replaceState({}, document.title, window.location.pathname);
          } else {
            setImportStatus({
              message: 'Échec de l\'import LinkedIn',
              success: false
            });
          }
        })
        .catch((err: any) => {
          console.error('Erreur récupération LinkedIn:', err);
          setImportStatus({
            message: 'Échec de l\'import LinkedIn',
            success: false
          });
        })
        .finally(() => {
          setIsParsing(false);
        });
    }
  }, [alreadyCalled]);

  const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const validateAllFields = (): boolean => {
    const newErrors: { [key: string]: string } = { ...errors };
    delete newErrors.firstName;
    delete newErrors.lastName;
    delete newErrors.email;
    delete newErrors.birthDate;
    delete newErrors.skills;

    let hasAnyError = false;

    if (!profileData.firstName?.trim()) {
      newErrors.firstName = "⚠ Le prénom est obligatoire";
      hasAnyError = true;
    }

    if (!profileData.lastName?.trim()) {
      newErrors.lastName = "⚠ Le nom est obligatoire";
      hasAnyError = true;
    }

    if (!profileData.email?.trim()) {
      newErrors.email = "⚠ L'email est obligatoire";
      hasAnyError = true;
    } else if (!/\S+@\S+\.\S+/.test(profileData.email)) {
      newErrors.email = "⚠ L'adresse e-mail n'est pas valide";
      hasAnyError = true;
    }

    if (role === 'tutor') {
      if (!profileData.birthDate) {
        newErrors.birthDate = "⚠ La date de naissance est obligatoire";
        hasAnyError = true;
      } else {
        const birthDate = new Date(profileData.birthDate);
        const today = new Date();
        const age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        const isBirthdayPassed = monthDiff > 0 || (monthDiff === 0 && today.getDate() >= birthDate.getDate());
        const actualAge = isBirthdayPassed ? age : age - 1;

        if (actualAge < 16) {
          newErrors.birthDate = "⚠ Vous devez avoir au moins 16 ans pour être tuteur";
          hasAnyError = true;
        }
      }
    }

    if (profileData.phone && profileData.phone.trim() !== '') {
      const digitsOnly = profileData.phone.replace(/\D/g, '');
      if (
        (profileData.phone.match(/\+/g)?.length || 0) > 1 ||
        digitsOnly.length < 8 ||
        digitsOnly.length > 15
      ) {
        newErrors.phone = 'Numéro de téléphone invalide';
        hasAnyError = true;
      }
    }

    setErrors(newErrors);
    setHasBeenValidated(true);
    return !hasAnyError;
  };

  useEffect(() => {
    (window as any).validateGeneralInfoStep = validateAllFields;
  }, [profileData, role]);

  const searchAddressSuggestions = async (query: string): Promise<void> => {
    if (!query || query.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    setIsLoadingAddress(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=5&countrycodes=`
      );
      const data = await response.json();
      setSuggestions(data);
      setShowSuggestions(true);
    } catch (error) {
      console.error('Erreur de recherche d\'adresses:', error);
      setSuggestions([]);
    } finally {
      setIsLoadingAddress(false);
    }
  };

  const handleAddressSuggestionSelect = (suggestion: Suggestion): void => {
    setProfileData((prev: ProfileData) => ({
      ...prev,
      address: suggestion.display_name,
      location: {
        ...prev.location,
        latitude: suggestion.lat,
        longitude: suggestion.lon,
        city: suggestion.address?.city ||
               suggestion.address?.town ||
               suggestion.address?.village ||
               suggestion.address?.municipality || ''
      }
    }));
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>): (() => void) => {
    const { value } = e.target;
    setProfileData((prev: ProfileData) => ({
      ...prev,
      address: value
    }));
    
    const timeoutId = setTimeout(() => {
      searchAddressSuggestions(value);
    }, 300);
    
    return () => clearTimeout(timeoutId);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setErrors((prev) => ({
          ...prev,
          profilePicture: 'L\'image est trop volumineuse (max 5MB)'
        }));
        return;
      }
      if (!file.type.startsWith('image/')) {
        setErrors((prev) => ({
          ...prev,
          profilePicture: 'Veuillez sélectionner une image valide'
        }));
        return;
      }
      const imageUrl = URL.createObjectURL(file);
      setImageToCrop(imageUrl);
      setCropping(true);
    }
  };

  const handleCropConfirm = async (): Promise<void> => {
    try {
      if (!imageToCrop || !croppedAreaPixels) return;
      const croppedImg = await getCroppedImg(imageToCrop, croppedAreaPixels);
      setProfileData((prev: ProfileData) => ({
        ...prev,
        profilePicture: croppedImg,
      }));
      URL.revokeObjectURL(imageToCrop);
      setCropping(false);
      setImageToCrop(null);
      setErrors((prev) => {
        const updated = { ...prev };
        delete updated.profilePicture;
        return updated;
      });
    } catch (e) {
      console.error('Erreur lors du recadrage:', e);
      setErrors((prev) => ({
        ...prev,
        profilePicture: 'Erreur lors du recadrage de l\'image'
      }));
    }
  };

  const handleSkillsChange = (newSkills: string[]): void => {
    setProfileData((prev: ProfileData) => ({
      ...prev,
      skills: newSkills
    }));
    if (newSkills.length > 0) {
      setErrors((prev) => {
        const updated = { ...prev };
        delete updated.skills;
        return updated;
      });
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ): void => {
    const { name, value } = e.target;
    setProfileData((prev: ProfileData) => ({
      ...prev,
      [name]: value,
    }));

    if (hasBeenValidated) {
      const newErrors = { ...errors };
      if (value && value.trim() !== '') {
        delete newErrors[name];
        if (name === 'email' && !/\S+@\S+\.\S+/.test(value)) {
          newErrors.email = "L'adresse e-mail n'est pas valide";
        }
        if (name === 'birthDate' && role === 'tutor' && value) {
          const birthDate = new Date(value);
          const today = new Date();
          const age = today.getFullYear() - birthDate.getFullYear();
          const monthDiff = today.getMonth() - birthDate.getMonth();
          const isBirthdayPassed = monthDiff > 0 || (monthDiff === 0 && today.getDate() >= birthDate.getDate());
          const actualAge = isBirthdayPassed ? age : age - 1;

          if (actualAge < 16) {
            newErrors.birthDate = "Vous devez avoir au moins 16 ans pour être tuteur";
          } else {
            delete newErrors.birthDate;
          }
        }
      }
      setErrors(newErrors);
    }

    setTouched((prev) => ({
      ...prev,
      [name]: true
    }));

    window.dispatchEvent(
      new CustomEvent('profileFieldUpdated', { detail: { field: name } })
    );
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const { name, value } = e.target;
    const cleaned = value.replace(/[^\d+]/g, '');
    setProfileData((prev: ProfileData) => ({
      ...prev,
      [name]: cleaned
    }));

    if (hasBeenValidated && cleaned && cleaned.trim() !== '') {
      const digitsOnly = cleaned.replace(/\D/g, '');
      const newErrors = { ...errors };
      if ((cleaned.match(/\+/g)?.length || 0) > 1 || digitsOnly.length < 8 || digitsOnly.length > 15) {
        newErrors.phone = 'Numéro de téléphone invalide';
      } else {
        delete newErrors.phone;
      }
      setErrors(newErrors);
    }

    setTouched((prev) => ({
      ...prev,
      [name]: true
    }));

    window.dispatchEvent(
      new CustomEvent('profileFieldUpdated', { detail: { field: name } })
    );
  };

  const hasCustomPhoto = (): boolean => {
    if (!profileData.profilePicture) return false;
    if (profileData.profilePicture === defaultAvatar || profileData.profilePicture.includes('avatar'))
      return false;
    if (profileData.profilePicture.startsWith('data:image')) return true;
    if (profileData.profilePicture.startsWith('http')) return true;
    return false;
  };

  const triggerFileInput = (): void => fileInputRef.current?.click();

  const handleCountrySelect = (code: string): void => {
    setProfileData((prev: ProfileData) => ({ ...prev, countryCode: code }));
    setDropdownOpen(false);
  };

  const handleCancelCrop = (): void => {
    if (imageToCrop) {
      URL.revokeObjectURL(imageToCrop);
    }
    setCropping(false);
    setImageToCrop(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>, type: 'cv' | 'linkedin'): Promise<void> => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (type === 'cv') {
      if (file.size > 5 * 1024 * 1024) {
        setErrors((prev) => ({
          ...prev,
          cvFile: 'Le fichier est trop volumineux (max 5MB)',
        }));
        return;
      }

      setProfileData((prev: ProfileData) => ({
        ...prev,
        cvFile: file,
      }));

      setErrors((prev) => {
        const updated = { ...prev };
        delete updated.cvFile;
        return updated;
      });
    }
  };

  const intelligentlyMergeData = (
    existing: ProfileData,
    newData: ParsedCVData
  ): Partial<ProfileData> => {
    const updates: Partial<ProfileData> = {};
    console.log('🔄 Fusion intelligente des données:');
    console.log('Données existantes:', existing);
    console.log('Nouvelles données:', newData);

    // Always update personal info from CV
    if (newData.personal) {
      if (newData.personal.firstName) {
        updates.firstName = newData.personal.firstName;
      }
      if (newData.personal.lastName) {
        updates.lastName = newData.personal.lastName;
      }
      if (newData.personal.email && newData.personal.email.length > 0) {
        updates.email = newData.personal.email[0];
      }
      if (newData.personal.phone && newData.personal.phone.length > 0) {
        updates.phone = newData.personal.phone[0];
      }
      if (newData.personal.address) {
        updates.address = newData.personal.address;
      }
      if (newData.personal.birthDate) {
        updates.birthDate = newData.personal.birthDate;
      }
      if (newData.personal.gender) {
        updates.gender = newData.personal.gender;
      }
    }

    // Replace skills with CV skills
    if (newData.skills?.technical) {
      updates.skills = [...new Set(newData.skills.technical)]
        .filter(skill => skill && skill.trim() !== '')
        .sort((a, b) => a.localeCompare(b));
    }

    // Replace diplomas with CV diplomas
    if (newData.education && newData.education.length > 0) {
      updates.diplomas = newData.education.map(edu => ({
        educationLevel: edu.educationLevel || '',
        field: edu.field || '',
        school: edu.school || '',
        country: edu.country || '',
        startYear: edu.startYear || 0,
        endYear: edu.endYear,
        isCurrent: edu.isCurrent || false,
        diplomaName: edu.diplomaName || ''
      }));
    }

    // Replace experiences with CV experiences
    if (newData.experience && newData.experience.length > 0) {
      updates.experiences = newData.experience.map(exp => ({
        jobTitle: exp.jobTitle || '',
        employmentType: exp.employmentType || '',
        company: exp.company || '',
        location: exp.location || '',
        startMonth: exp.startMonth || '',
        startYear: exp.startYear || 0,
        endMonth: exp.endMonth,
        endYear: exp.endYear,
        isCurrent: exp.isCurrent || false,
        description: exp.description || ''
      }));
    }

    // Update bio with summary
    if (newData.summary) {
      updates.bio = newData.summary;
    }

    console.log('✅ Mises à jour à appliquer:', updates);
    return updates;
  };

  const handleParseCV = async (): Promise<void> => {
    if (!profileData.cvFile) return;
    setIsParsing(true);
    setImportStatus({ message: 'Analyse du CV en cours...', success: false });

    try {
      console.log('📤 Envoi du CV pour analyse via CVService...');
      
      // Utilisation du service CV
      const response: CVParseResponse = await cvService.parseCV(profileData.cvFile);
      
      console.log('📊 Réponse du service CV:', response);

      if (response.success && response.data) {
        console.log('🎉 Analyse réussie! Données extraites:');
        
        // Convertir en format ParsedCVData
        const parsed: ParsedCVData = {
          personal: {
            firstName: (response.data as any).firstName || '',
            lastName: (response.data as any).lastName || '',
            email: (response.data as any).email ? [(response.data as any).email] : [],
            phone: (response.data as any).phone ? [(response.data as any).phone] : [],
            address: (response.data as any).address || '',
            birthDate: (response.data as any).birthDate || '',
            gender: (response.data as any).gender || ''
          },
          education: ((response.data as any).diplomas || []).map((d: any) => ({
            educationLevel: d.educationLevel || '',
            field: d.field || '',
            school: d.school || '',
            country: d.country || '',
            startYear: d.startYear ? parseInt(d.startYear) : new Date().getFullYear(),
            endYear: d.endYear ? parseInt(d.endYear) : undefined,
            isCurrent: d.isCurrent || false,
            diplomaName: d.diplomaName || ''
          })),
          experience: ((response.data as any).experiences || []).map((exp: any) => ({
            jobTitle: exp.title || '',
            employmentType: exp.employmentType || '',
            company: exp.company || '',
            location: exp.location || '',
            startMonth: exp.startMonth || '',
            startYear: exp.startYear ? parseInt(exp.startYear) : new Date().getFullYear(),
            endMonth: exp.endMonth,
            endYear: exp.endYear ? parseInt(exp.endYear) : undefined,
            isCurrent: exp.isCurrent || false,
            description: exp.description || '',
            achievements: exp.achievements || []
          })),
          skills: {
            technical: (response.data as any).skills || []
          },
          summary: (response.data as any).summary || '',
          validation: {
            quality: response.metadata?.quality || 'BASIC'
          }
        };

        console.log('🔄 Fusion intelligente des données...');

        setProfileData((prev: ProfileData) => {
          const updates = intelligentlyMergeData(prev, parsed);
          console.log('✅ Mises à jour appliquées:', updates);
          return { ...prev, ...updates };
        });

        setImportStatus({
          message: `CV analysé avec succès (Qualité: ${response.metadata?.quality || 'BASIC'})`,
          success: true
        });
      } else {
        setImportStatus({
          message: 'Échec de l\'analyse du CV',
          success: false
        });
      }
    } catch (e: any) {
      console.error('💥 Erreur complète:', e);
      setImportStatus({
        message: 'Échec de l\'analyse du CV',
        success: false
      });
    } finally {
      setIsParsing(false);
    }
  };

  const handleLinkedInImport = async (): Promise<void> => {
        try {
            linkedinService.loginWithLinkedIn();
        } catch (err: any) {
            console.error('Erreur LinkedIn login:', err);
            setImportStatus({
                message: 'Échec de la connexion LinkedIn',
                success: false
            });
        }
    };
  // Fonction pour sauvegarder les compétences à apprendre
  const handleSaveLearningSkills = async (newSkills: string[]) => {
    try {
      // Mettre à jour le profil local avec skillsToLearn
      setProfileData((prev: any) => ({
        ...prev,
        skillsToLearn: newSkills
      }));

      // Sauvegarder dans la base de données via l'API
      const token = localStorage.getItem('token');
      if (token) {
        await fetch('/api/profile/save', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            profileData: {
              ...profileData,
              skillsToLearn: newSkills
            }
          })
        });
      }
    } catch (error) {
      console.error('Erreur sauvegarde compétences à apprendre:', error);
    }
  };

  // Fonction pour sauvegarder les compétences à enseigner
  const handleSaveTeachingSkills = async (newSkills: string[]) => {
    try {
      // Mettre à jour le profil local avec skillsToTeach
      setProfileData((prev: any) => ({
        ...prev,
        skillsToTeach: newSkills
      }));

      // Sauvegarder dans la base de données via l'API
      const token = localStorage.getItem('token');
      if (token) {
        await fetch('/api/profile/save', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            profileData: {
              ...profileData,
              skillsToTeach: newSkills
            }
          })
        });
      }
    } catch (error) {
      console.error('Erreur sauvegarde compétences à enseigner:', error);
    }
  };

  return (
    <div className={styles.container}>
      <h2>Informations générales</h2>
      <p className={styles.subtitle}>
        Renseignez vos informations personnelles pour compléter votre profil
      </p>
      <div className={styles.photoSection}>
        <div className={styles.photoContainer}>
          <div className={styles.photoWrapper}>
            <img
              src={profileData.profilePicture || defaultAvatar}
              alt="Profile"
              className={styles.photo}
              onError={(e) => {
                e.currentTarget.src = defaultAvatar;
                setProfileData((prev: ProfileData) => ({
                  ...prev,
                  profilePicture: defaultAvatar
                }));
              }}
            />
            <div className={styles.photoOverlay}>
              <button
                type="button"
                onClick={triggerFileInput}
                className={styles.changePhotoBtn}
              >
                📷
              </button>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className={styles.fileInput}
          />
          <div className={styles.photoActions}>
            <button
              type="button"
              onClick={triggerFileInput}
              className={styles.changePhotoText}
            >
              Changer de photo
            </button>
            {hasCustomPhoto() && (
              <button
                type="button"
                onClick={() =>
                  setProfileData((prev: ProfileData) => ({
                    ...prev,
                    profilePicture: defaultAvatar,
                  }))
                }
                className={styles.deletePhotoText}
              >
                Supprimer la photo
              </button>
            )}
          </div>

          {errors.profilePicture && (
            <p className={styles.errorText}>{errors.profilePicture}</p>
          )}
        </div>
      </div>
      {cropping && (
        <div className={styles.cropModal}>
          <div className={styles.cropModalOverlay} onClick={handleCancelCrop} />
          <div className={styles.cropModalContent}>
            <div className={styles.cropHeader}>
              <h3>Recadrez votre photo</h3>
              <p>Ajustez la position et la taille de votre photo de profil</p>
            </div>

            <div className={styles.cropContainer}>
              <TS_Cropper
                image={imageToCrop!}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                showGrid={false}
              />
            </div>

            <div className={styles.cropControls}>
              <div className={styles.zoomControl}>
                <span className={styles.zoomLabel}>Zoom</span>
                <div className={styles.zoomSliderContainer}>
                  <input
                    type="range"
                    min={1}
                    max={3}
                    step={0.1}
                    value={zoom}
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className={styles.zoomSlider}
                  />
                </div>
                <span className={styles.zoomValue}>{zoom.toFixed(1)}x</span>
              </div>

              <div className={styles.cropActions}>
                <button
                  onClick={handleCancelCrop}
                  className={styles.cancelButton}
                >
                  Annuler
                </button>
                <button
                  onClick={handleCropConfirm}
                  className={styles.confirmButton}
                >
                  Valider
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className={styles.importSection}>
        <h3>Importer vos informations</h3>
        <p className={styles.importSubtitle}>
          Gagnez du temps en important vos données depuis un CV ou LinkedIn.
        </p>
        <div className={styles.importOptions}>
          <div className={styles.importOption}>
            <div className={styles.importHeader}>
              <h4>Importer un CV</h4>
              <span className={styles.importIcon}>📄</span>
            </div>
            <p className={styles.importDescription}>
              Téléchargez un CV au format PDF ou Word pour pré-remplir automatiquement vos informations.
            </p>
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={(e) => handleFileImport(e, 'cv')}
              className={styles.fileInput}
              id="cv-upload"
            />
            <label htmlFor="cv-upload" className={styles.importButton}>
              <span>Choisir</span>
            </label>
            {profileData.cvFile && (
              <div className={styles.filePreview}>
                <span>Fichier sélectionné : {profileData.cvFile.name}</span>
                <button
                  type="button"
                  onClick={() => setProfileData((prev: ProfileData) => ({ ...prev, cvFile: null }))}
                  className={styles.removeFile}
                >
                  ✕
                </button>
              </div>
            )}
          </div>
          <div className={styles.importOption}>
            <div className={styles.importHeader}>
              <h4>Importer depuis LinkedIn</h4>
              <span className={styles.importIcon}>🔗</span>
            </div>
            <p className={styles.importDescription}>
              Connectez-vous à LinkedIn pour importer automatiquement vos informations de profil.
            </p>
            <button
              type="button"
              onClick={handleLinkedInImport}
              className={styles.linkedInButton}
              disabled={isParsing}
            >
              {isParsing ? 'Connexion...' : 'Se connecter à LinkedIn'}
            </button>
          </div>
        </div>
        {profileData.cvFile && (
          <button
            type="button"
            onClick={handleParseCV}
            className={styles.parseButton}
            disabled={isParsing}
          >
            {isParsing ? 'Analyse en cours...' : 'Analyser le CV'}
          </button>
        )}
        {importStatus.message && (
          <div className={`${styles.importStatus} ${importStatus.success ? styles.success : styles.error}`}>
            {importStatus.message}
          </div>
        )}
      </div>
      <div className={styles.formGrid}>
        <div className={styles.formGroup}>
          <label htmlFor="firstName" className={styles.label}>
            Prénom <span className={styles.requiredMarker}>*</span>
          </label>
          <input
            type="text"
            id="firstName"
            name="firstName"
            placeholder="Entrez votre prénom"
            value={profileData.firstName || ''}
            onChange={handleInputChange}
            className={`${styles.input} ${hasBeenValidated && errors.firstName ? styles.inputError : ''}`}
          />
          {hasBeenValidated && errors.firstName && <p className={styles.errorText}>{errors.firstName}</p>}
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="lastName" className={styles.label}>
            Nom <span className={styles.requiredMarker}>*</span>
          </label>
          <input
            type="text"
            id="lastName"
            name="lastName"
            placeholder="Entrez votre nom"
            value={profileData.lastName || ''}
            onChange={handleInputChange}
            className={`${styles.input} ${hasBeenValidated && errors.lastName ? styles.inputError : ''}`}
          />
          {hasBeenValidated && errors.lastName && <p className={styles.errorText}>{errors.lastName}</p>}
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="email" className={styles.label}>
            Email <span className={styles.requiredMarker}>*</span>
          </label>
          <input
            type="email"
            id="email"
            name="email"
            placeholder="exemple@mail.com"
            value={profileData.email || ''}
            onChange={handleInputChange}
            className={`${styles.input} ${hasBeenValidated && errors.email ? styles.inputError : ''}`}
          />
          {hasBeenValidated && errors.email && <p className={styles.errorText}>{errors.email}</p>}
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="phone" className={styles.label}>Téléphone</label>

          <div className={styles.phoneInput} ref={dropdownRef}>
            <div className={styles.customDropdown}>
              <button
                type="button"
                className={styles.dropdownButton}
                onClick={() => setDropdownOpen(!dropdownOpen)}
              >
                {(() => {
                  const selectedCountry = countries.find((c) => c.code === profileData.countryCode);
                  if (selectedCountry) {
                    return `${selectedCountry.flag} +${selectedCountry.code}`;
                  }
                  return '🇫🇷 +33';
                })()}
              </button>
              {dropdownOpen && (
                <ul className={styles.dropdownList}>
                  {countries.map((country) => (
                    <li
                      key={country.code}
                      className={styles.dropdownItem}
                      onClick={() => handleCountrySelect(country.code)}
                    >
                      {country.flag} {country.name} (+{country.code})
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <input
              id="phone"
              type="tel"
              name="phone"
              placeholder="Numéro de téléphone"
              value={profileData.phone || ''}
              onChange={handlePhoneChange}
              className={`${styles.phoneField} ${hasBeenValidated && errors.phone ? styles.inputError : ''}`}
            />
          </div>
          {hasBeenValidated && errors.phone && <p className={styles.errorText}>{errors.phone}</p>}
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="gender" className={styles.label}>
            Genre
          </label>
          <select
            id="gender"
            name="gender"
            value={profileData.gender || ''}
            onChange={handleInputChange}
            className={styles.select}
          >
            <option value="">Sélectionnez</option>
            <option value="Femme">Femme</option>
            <option value="Homme">Homme</option>
            <option value="Autre">Autre</option>
            <option value="Autre">Je préfère ne pas répondre</option>
          </select>
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="birthDate" className={styles.label}>
            Date de naissance {role === 'tutor' && <span className={styles.requiredMarker}>*</span>}
          </label>
          <input
            type="date"
            id="birthDate"
            name="birthDate"
            value={formatDateForInput(profileData.birthDate)}
            onChange={handleInputChange}
            className={`${styles.input} ${hasBeenValidated && errors.birthDate ? styles.inputError : ''}`}
            max={new Date().toISOString().split('T')[0]}
          />
          {hasBeenValidated && errors.birthDate && <p className={styles.errorText}>{errors.birthDate}</p>}
        </div>
        <div className={`${styles.formGroup} ${styles.fullWidth}`}>
          <label htmlFor="address" className={styles.label}>Adresse personnelle</label>
          <div className={styles.autocompleteContainer}>
            <input
              ref={addressInputRef}
              type="text"
              id="address"
              name="address"
              value={profileData.address || ''}
              onChange={handleAddressChange}
              onFocus={() => {
                if (suggestions.length > 0) {
                  setShowSuggestions(true);
                }
              }}
              className={styles.inputAdress}
              placeholder="Commencez à taper votre adresse (rue, ville, pays)..."
              autoComplete="off"
            />
            {isLoadingAddress && (
              <div className={styles.loadingSpinner}>
                <div className={styles.spinner}></div>
              </div>
            )}
            {showSuggestions && suggestions.length > 0 && (
              <div ref={suggestionsRef} className={styles.suggestionsDropdown}>
                {suggestions.map((suggestion, index) => (
                  <div
                    key={index}
                    className={styles.suggestionItem}
                    onClick={() => handleAddressSuggestionSelect(suggestion)}
                  >
                    <div className={styles.suggestionText}>
                      {suggestion.display_name}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <p className={styles.helpText}>
            Tapez au moins 3 caractères pour voir les suggestions d'adresses internationales
          </p>
        </div>
        <div className={`${styles.formGroup} ${styles.fullWidth}`}>
          <label htmlFor="description" className={styles.label}>À propos</label>
          <textarea
            id="bio"
            name="bio"
            placeholder="Décrivez-vous en quelques mots... (votre parcours, vos centres d'intérêt, etc.)"
            value={profileData.bio || ''}
            onChange={handleInputChange}
            className={styles.textarea}
            rows={4}
          />
        </div>
        <div className={`${styles.formGroup} ${styles.fullWidth}`}>
          <label htmlFor="skills" className={styles.label}>
            Compétences
          </label>

          <SkillsInput
            skills={profileData.skills || []}
            onSkillsChange={handleSkillsChange}
            role={role}
          />

          {hasBeenValidated && errors.skills && (
            <p className={styles.errorText}>{errors.skills}</p>
          )}
        </div>
        <div className={`${styles.formGroup} ${styles.fullWidth}`}>
          {/* Bouton pour les compétences à enseigner */}
          <button
            type="button"
            className={styles.transformSkillButton}
            onClick={() => setShowTransformModal(true)}
          >
            Définir vos compétences et transformer les en annonce
          </button>
          
          {/* Bouton pour les compétences à apprendre */}
          <button
            type="button"
            className={styles.learningSkillsButton}
            onClick={() => setShowLearningSkillsModal(true)}
          >
            Définir les compétences que vous voulez acquérir
          </button>
        </div>

        {/* Modal pour les compétences à acquérir */}
        {showLearningSkillsModal && (
          <DefineLearningSkillsModal
            currentSkills={profileData.skillsToLearn || []}
            onClose={() => setShowLearningSkillsModal(false)}
            onSave={handleSaveLearningSkills}
          />
        )}

        {/* Modal pour transformer en annonce (compétences à enseigner) */}
        {showTransformModal && (
          <TransformSkillToAnnonceModal
            skills={profileData.skillsToTeach || []} 
            onClose={() => setShowTransformModal(false)}
            onCreated={() => {
              setShowTransformModal(false);                           
            }}
            profileData={profileData} 
          />
        )}
      </div>
      {/* Indication des champs obligatoires */}
      <div className={styles.requiredInfo}>
        <span className={styles.requiredMarker}>*</span> Champs obligatoires
      </div>
    </div>
  );
};

export default GeneralInfoStep;