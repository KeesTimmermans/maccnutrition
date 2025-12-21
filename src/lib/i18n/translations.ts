export type Language = 'en' | 'fr' | 'es' | 'it' | 'pt';

export const languageNames: Record<Language, string> = {
  en: 'English',
  fr: 'Français',
  es: 'Español',
  it: 'Italiano',
  pt: 'Português'
};

export const translations: Record<Language, Record<string, string>> = {
  en: {
    // Navigation & General
    'settings': 'Settings',
    'logout': 'Log Out',
    'save': 'Save',
    'cancel': 'Cancel',
    'loading': 'Loading...',
    'error': 'Error',
    'success': 'Success',
    
    // Settings
    'display_units': 'Display Units',
    'use_metric_units': 'Use Metric Units',
    'metric_units_desc': 'kg, cm, liters, grams',
    'imperial_units_desc': 'lbs, ft/in, oz, cups',
    'your_profile': 'Your Profile',
    'goal': 'Goal',
    'daily_calories': 'Daily Calories',
    'activity_level': 'Activity Level',
    'not_set': 'Not set',
    'language': 'Language',
    'select_language': 'Select Language',
    
    // Dashboard
    'dashboard': 'Dashboard',
    'good_morning': 'Good morning',
    'good_afternoon': 'Good afternoon',
    'good_evening': 'Good evening',
    'todays_progress': "Today's Progress",
    'calories': 'Calories',
    'protein': 'Protein',
    'carbs': 'Carbs',
    'fats': 'Fats',
    'water': 'Water',
    'log_meal': 'Log Meal',
    'view_history': 'View History',
    'meal_planner': 'Meal Planner',
    'ai_coach': 'AI Coach',
    'daily_checkin': 'Daily Check-in',
    
    // AI Coach
    'ai_coach_title': 'Your AI Coach',
    'ask_anything': 'Ask me anything about nutrition...',
    'send': 'Send',
    'insights': 'Insights',
    'tip_of_the_day': 'Tip of the Day',
    
    // Meals
    'meals': 'Meals',
    'breakfast': 'Breakfast',
    'lunch': 'Lunch',
    'dinner': 'Dinner',
    'snack': 'Snack',
    'no_meals_logged': 'No meals logged yet',
    
    // Check-in
    'how_are_you_feeling': 'How are you feeling today?',
    'energy_level': 'Energy Level',
    'mood': 'Mood',
    'sleep_quality': 'Sleep Quality',
    'stress_level': 'Stress Level',
    'hydration': 'Hydration',
    'hunger': 'Hunger',
    'submit_checkin': 'Submit Check-in',
    
    // Progress
    'progress': 'Progress',
    'weekly_summary': 'Weekly Summary',
    'monthly_summary': 'Monthly Summary',
    'streak': 'Streak',
    'days': 'days',
    
    // Auth
    'sign_in': 'Sign In',
    'sign_up': 'Sign Up',
    'email': 'Email',
    'password': 'Password',
    'forgot_password': 'Forgot Password?',
    'no_account': "Don't have an account?",
    'have_account': 'Already have an account?',
    
    // Onboarding
    'welcome': 'Welcome',
    'get_started': 'Get Started',
    'next': 'Next',
    'back': 'Back',
    'finish': 'Finish',
    
    // Toasts
    'settings_updated': 'Settings updated',
    'language_changed': 'Language changed to',
    'meal_logged': 'Meal logged successfully',
    'checkin_saved': 'Check-in saved',
  },
  
  fr: {
    // Navigation & General
    'settings': 'Paramètres',
    'logout': 'Déconnexion',
    'save': 'Enregistrer',
    'cancel': 'Annuler',
    'loading': 'Chargement...',
    'error': 'Erreur',
    'success': 'Succès',
    
    // Settings
    'display_units': 'Unités d\'affichage',
    'use_metric_units': 'Utiliser les unités métriques',
    'metric_units_desc': 'kg, cm, litres, grammes',
    'imperial_units_desc': 'lbs, ft/in, oz, tasses',
    'your_profile': 'Votre profil',
    'goal': 'Objectif',
    'daily_calories': 'Calories quotidiennes',
    'activity_level': 'Niveau d\'activité',
    'not_set': 'Non défini',
    'language': 'Langue',
    'select_language': 'Sélectionner la langue',
    
    // Dashboard
    'dashboard': 'Tableau de bord',
    'good_morning': 'Bonjour',
    'good_afternoon': 'Bon après-midi',
    'good_evening': 'Bonsoir',
    'todays_progress': 'Progrès du jour',
    'calories': 'Calories',
    'protein': 'Protéines',
    'carbs': 'Glucides',
    'fats': 'Lipides',
    'water': 'Eau',
    'log_meal': 'Enregistrer un repas',
    'view_history': 'Voir l\'historique',
    'meal_planner': 'Planificateur de repas',
    'ai_coach': 'Coach IA',
    'daily_checkin': 'Bilan quotidien',
    
    // AI Coach
    'ai_coach_title': 'Votre Coach IA',
    'ask_anything': 'Posez-moi une question sur la nutrition...',
    'send': 'Envoyer',
    'insights': 'Conseils',
    'tip_of_the_day': 'Conseil du jour',
    
    // Meals
    'meals': 'Repas',
    'breakfast': 'Petit-déjeuner',
    'lunch': 'Déjeuner',
    'dinner': 'Dîner',
    'snack': 'Collation',
    'no_meals_logged': 'Aucun repas enregistré',
    
    // Check-in
    'how_are_you_feeling': 'Comment vous sentez-vous aujourd\'hui ?',
    'energy_level': 'Niveau d\'énergie',
    'mood': 'Humeur',
    'sleep_quality': 'Qualité du sommeil',
    'stress_level': 'Niveau de stress',
    'hydration': 'Hydratation',
    'hunger': 'Faim',
    'submit_checkin': 'Soumettre le bilan',
    
    // Progress
    'progress': 'Progrès',
    'weekly_summary': 'Résumé hebdomadaire',
    'monthly_summary': 'Résumé mensuel',
    'streak': 'Série',
    'days': 'jours',
    
    // Auth
    'sign_in': 'Se connecter',
    'sign_up': 'S\'inscrire',
    'email': 'E-mail',
    'password': 'Mot de passe',
    'forgot_password': 'Mot de passe oublié ?',
    'no_account': 'Pas de compte ?',
    'have_account': 'Déjà un compte ?',
    
    // Onboarding
    'welcome': 'Bienvenue',
    'get_started': 'Commencer',
    'next': 'Suivant',
    'back': 'Retour',
    'finish': 'Terminer',
    
    // Toasts
    'settings_updated': 'Paramètres mis à jour',
    'language_changed': 'Langue changée en',
    'meal_logged': 'Repas enregistré avec succès',
    'checkin_saved': 'Bilan enregistré',
  },
  
  es: {
    // Navigation & General
    'settings': 'Configuración',
    'logout': 'Cerrar sesión',
    'save': 'Guardar',
    'cancel': 'Cancelar',
    'loading': 'Cargando...',
    'error': 'Error',
    'success': 'Éxito',
    
    // Settings
    'display_units': 'Unidades de visualización',
    'use_metric_units': 'Usar unidades métricas',
    'metric_units_desc': 'kg, cm, litros, gramos',
    'imperial_units_desc': 'lbs, ft/in, oz, tazas',
    'your_profile': 'Tu perfil',
    'goal': 'Objetivo',
    'daily_calories': 'Calorías diarias',
    'activity_level': 'Nivel de actividad',
    'not_set': 'No definido',
    'language': 'Idioma',
    'select_language': 'Seleccionar idioma',
    
    // Dashboard
    'dashboard': 'Panel',
    'good_morning': 'Buenos días',
    'good_afternoon': 'Buenas tardes',
    'good_evening': 'Buenas noches',
    'todays_progress': 'Progreso de hoy',
    'calories': 'Calorías',
    'protein': 'Proteína',
    'carbs': 'Carbohidratos',
    'fats': 'Grasas',
    'water': 'Agua',
    'log_meal': 'Registrar comida',
    'view_history': 'Ver historial',
    'meal_planner': 'Planificador de comidas',
    'ai_coach': 'Coach IA',
    'daily_checkin': 'Check-in diario',
    
    // AI Coach
    'ai_coach_title': 'Tu Coach IA',
    'ask_anything': 'Pregúntame sobre nutrición...',
    'send': 'Enviar',
    'insights': 'Consejos',
    'tip_of_the_day': 'Consejo del día',
    
    // Meals
    'meals': 'Comidas',
    'breakfast': 'Desayuno',
    'lunch': 'Almuerzo',
    'dinner': 'Cena',
    'snack': 'Snack',
    'no_meals_logged': 'No hay comidas registradas',
    
    // Check-in
    'how_are_you_feeling': '¿Cómo te sientes hoy?',
    'energy_level': 'Nivel de energía',
    'mood': 'Estado de ánimo',
    'sleep_quality': 'Calidad del sueño',
    'stress_level': 'Nivel de estrés',
    'hydration': 'Hidratación',
    'hunger': 'Hambre',
    'submit_checkin': 'Enviar check-in',
    
    // Progress
    'progress': 'Progreso',
    'weekly_summary': 'Resumen semanal',
    'monthly_summary': 'Resumen mensual',
    'streak': 'Racha',
    'days': 'días',
    
    // Auth
    'sign_in': 'Iniciar sesión',
    'sign_up': 'Registrarse',
    'email': 'Correo electrónico',
    'password': 'Contraseña',
    'forgot_password': '¿Olvidaste tu contraseña?',
    'no_account': '¿No tienes cuenta?',
    'have_account': '¿Ya tienes cuenta?',
    
    // Onboarding
    'welcome': 'Bienvenido',
    'get_started': 'Comenzar',
    'next': 'Siguiente',
    'back': 'Atrás',
    'finish': 'Finalizar',
    
    // Toasts
    'settings_updated': 'Configuración actualizada',
    'language_changed': 'Idioma cambiado a',
    'meal_logged': 'Comida registrada correctamente',
    'checkin_saved': 'Check-in guardado',
  },
  
  it: {
    // Navigation & General
    'settings': 'Impostazioni',
    'logout': 'Esci',
    'save': 'Salva',
    'cancel': 'Annulla',
    'loading': 'Caricamento...',
    'error': 'Errore',
    'success': 'Successo',
    
    // Settings
    'display_units': 'Unità di misura',
    'use_metric_units': 'Usa unità metriche',
    'metric_units_desc': 'kg, cm, litri, grammi',
    'imperial_units_desc': 'lbs, ft/in, oz, tazze',
    'your_profile': 'Il tuo profilo',
    'goal': 'Obiettivo',
    'daily_calories': 'Calorie giornaliere',
    'activity_level': 'Livello di attività',
    'not_set': 'Non impostato',
    'language': 'Lingua',
    'select_language': 'Seleziona lingua',
    
    // Dashboard
    'dashboard': 'Dashboard',
    'good_morning': 'Buongiorno',
    'good_afternoon': 'Buon pomeriggio',
    'good_evening': 'Buonasera',
    'todays_progress': 'Progresso di oggi',
    'calories': 'Calorie',
    'protein': 'Proteine',
    'carbs': 'Carboidrati',
    'fats': 'Grassi',
    'water': 'Acqua',
    'log_meal': 'Registra pasto',
    'view_history': 'Vedi cronologia',
    'meal_planner': 'Pianificatore pasti',
    'ai_coach': 'Coach IA',
    'daily_checkin': 'Check-in giornaliero',
    
    // AI Coach
    'ai_coach_title': 'Il tuo Coach IA',
    'ask_anything': 'Chiedimi della nutrizione...',
    'send': 'Invia',
    'insights': 'Consigli',
    'tip_of_the_day': 'Consiglio del giorno',
    
    // Meals
    'meals': 'Pasti',
    'breakfast': 'Colazione',
    'lunch': 'Pranzo',
    'dinner': 'Cena',
    'snack': 'Spuntino',
    'no_meals_logged': 'Nessun pasto registrato',
    
    // Check-in
    'how_are_you_feeling': 'Come ti senti oggi?',
    'energy_level': 'Livello di energia',
    'mood': 'Umore',
    'sleep_quality': 'Qualità del sonno',
    'stress_level': 'Livello di stress',
    'hydration': 'Idratazione',
    'hunger': 'Fame',
    'submit_checkin': 'Invia check-in',
    
    // Progress
    'progress': 'Progresso',
    'weekly_summary': 'Riepilogo settimanale',
    'monthly_summary': 'Riepilogo mensile',
    'streak': 'Serie',
    'days': 'giorni',
    
    // Auth
    'sign_in': 'Accedi',
    'sign_up': 'Registrati',
    'email': 'Email',
    'password': 'Password',
    'forgot_password': 'Password dimenticata?',
    'no_account': 'Non hai un account?',
    'have_account': 'Hai già un account?',
    
    // Onboarding
    'welcome': 'Benvenuto',
    'get_started': 'Inizia',
    'next': 'Avanti',
    'back': 'Indietro',
    'finish': 'Fine',
    
    // Toasts
    'settings_updated': 'Impostazioni aggiornate',
    'language_changed': 'Lingua cambiata in',
    'meal_logged': 'Pasto registrato con successo',
    'checkin_saved': 'Check-in salvato',
  },
  
  pt: {
    // Navigation & General
    'settings': 'Configurações',
    'logout': 'Sair',
    'save': 'Salvar',
    'cancel': 'Cancelar',
    'loading': 'Carregando...',
    'error': 'Erro',
    'success': 'Sucesso',
    
    // Settings
    'display_units': 'Unidades de exibição',
    'use_metric_units': 'Usar unidades métricas',
    'metric_units_desc': 'kg, cm, litros, gramas',
    'imperial_units_desc': 'lbs, ft/in, oz, xícaras',
    'your_profile': 'Seu perfil',
    'goal': 'Objetivo',
    'daily_calories': 'Calorias diárias',
    'activity_level': 'Nível de atividade',
    'not_set': 'Não definido',
    'language': 'Idioma',
    'select_language': 'Selecionar idioma',
    
    // Dashboard
    'dashboard': 'Painel',
    'good_morning': 'Bom dia',
    'good_afternoon': 'Boa tarde',
    'good_evening': 'Boa noite',
    'todays_progress': 'Progresso de hoje',
    'calories': 'Calorias',
    'protein': 'Proteína',
    'carbs': 'Carboidratos',
    'fats': 'Gorduras',
    'water': 'Água',
    'log_meal': 'Registrar refeição',
    'view_history': 'Ver histórico',
    'meal_planner': 'Planejador de refeições',
    'ai_coach': 'Coach IA',
    'daily_checkin': 'Check-in diário',
    
    // AI Coach
    'ai_coach_title': 'Seu Coach IA',
    'ask_anything': 'Pergunte-me sobre nutrição...',
    'send': 'Enviar',
    'insights': 'Dicas',
    'tip_of_the_day': 'Dica do dia',
    
    // Meals
    'meals': 'Refeições',
    'breakfast': 'Café da manhã',
    'lunch': 'Almoço',
    'dinner': 'Jantar',
    'snack': 'Lanche',
    'no_meals_logged': 'Nenhuma refeição registrada',
    
    // Check-in
    'how_are_you_feeling': 'Como você está se sentindo hoje?',
    'energy_level': 'Nível de energia',
    'mood': 'Humor',
    'sleep_quality': 'Qualidade do sono',
    'stress_level': 'Nível de estresse',
    'hydration': 'Hidratação',
    'hunger': 'Fome',
    'submit_checkin': 'Enviar check-in',
    
    // Progress
    'progress': 'Progresso',
    'weekly_summary': 'Resumo semanal',
    'monthly_summary': 'Resumo mensal',
    'streak': 'Sequência',
    'days': 'dias',
    
    // Auth
    'sign_in': 'Entrar',
    'sign_up': 'Cadastrar',
    'email': 'E-mail',
    'password': 'Senha',
    'forgot_password': 'Esqueceu a senha?',
    'no_account': 'Não tem uma conta?',
    'have_account': 'Já tem uma conta?',
    
    // Onboarding
    'welcome': 'Bem-vindo',
    'get_started': 'Começar',
    'next': 'Próximo',
    'back': 'Voltar',
    'finish': 'Finalizar',
    
    // Toasts
    'settings_updated': 'Configurações atualizadas',
    'language_changed': 'Idioma alterado para',
    'meal_logged': 'Refeição registrada com sucesso',
    'checkin_saved': 'Check-in salvo',
  }
};
