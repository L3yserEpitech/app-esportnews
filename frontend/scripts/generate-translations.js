const fs = require('fs');
const path = require('path');
const https = require('https');

// Configuration Anthropic
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

const frenchTranslations = fs.readFileSync(
  path.join(__dirname, '../public/locales/fr.json'),
  'utf-8'
);

const frenchData = JSON.parse(frenchTranslations);

// Fonction pour flatter l'objet et récupérer toutes les paires clé-valeur
function flattenObject(obj, prefix = '') {
  let result = {};

  for (const key in obj) {
    const value = obj[key];
    const newKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'string') {
      result[newKey] = value;
    } else if (typeof value === 'object' && value !== null) {
      result = { ...result, ...flattenObject(value, newKey) };
    }
  }

  return result;
}

// Fonction pour reconstituer l'objet à partir du chemin
function setNestedValue(obj, path, value) {
  const keys = path.split('.');
  let current = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!current[key] || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key];
  }

  current[keys[keys.length - 1]] = value;
}

// Fonction pour appeler l'API Anthropic
async function translateToLanguage(language, languageName) {
  const flattened = flattenObject(frenchData);
  const entries = Object.entries(flattened);

  // Diviser en chunks pour éviter les limites de tokens
  const chunkSize = 50;
  const chunks = [];

  for (let i = 0; i < entries.length; i += chunkSize) {
    chunks.push(entries.slice(i, i + chunkSize));
  }

  let allTranslations = {};

  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
    const chunk = chunks[chunkIndex];

    // Créer le prompt pour ce chunk
    const entriesText = chunk
      .map(([key, value]) => `"${key}": "${value.replace(/"/g, '\\"')}"`)
      .join('\n');

    const prompt = `You are a professional translator. Translate the following French text entries to ${languageName}.
Keep the same JSON key structure. Only provide the translations, no explanations.
Return ONLY valid JSON with the translated values.

French entries to translate:
${entriesText}

Respond with ONLY a JSON object like:
{
  "key1": "translated value 1",
  "key2": "translated value 2"
}`;

    console.log(`[${language.toUpperCase()}] Translating chunk ${chunkIndex + 1}/${chunks.length}...`);

    try {
      const response = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 2048,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`API Error: ${response.status} - ${JSON.stringify(error)}`);
      }

      const data = await response.json();
      const translatedText = data.content[0].text;

      // Parser la réponse JSON
      let translatedChunk = {};
      try {
        // Essayer de parser directement
        translatedChunk = JSON.parse(translatedText);
      } catch (e) {
        // Si ça échoue, essayer d'extraire le JSON
        const jsonMatch = translatedText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          translatedChunk = JSON.parse(jsonMatch[0]);
        } else {
          console.error(`Failed to parse JSON for ${language}:`, translatedText);
          throw new Error(`Invalid JSON response for ${language}`);
        }
      }

      allTranslations = { ...allTranslations, ...translatedChunk };

      // Petit délai entre les requêtes
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Error translating chunk ${chunkIndex} to ${language}:`, error);
      throw error;
    }
  }

  // Reconstituer l'objet avec la structure imbriquée
  const result = {};
  for (const [key, value] of Object.entries(allTranslations)) {
    setNestedValue(result, key, value);
  }

  return result;
}

// Fonction principale
async function generateAllTranslations() {
  if (!ANTHROPIC_API_KEY) {
    console.error('Error: ANTHROPIC_API_KEY environment variable is not set');
    process.exit(1);
  }

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Spanish' },
    { code: 'de', name: 'German' },
    { code: 'it', name: 'Italian' }
  ];

  for (const lang of languages) {
    try {
      console.log(`\n📝 Generating translations for ${lang.name}...`);
      const translations = await translateToLanguage(lang.code, lang.name);

      const filePath = path.join(__dirname, `../public/locales/${lang.code}.json`);
      fs.writeFileSync(filePath, JSON.stringify(translations, null, 2));

      console.log(`✅ ${lang.name} translations saved to ${filePath}`);
    } catch (error) {
      console.error(`❌ Error generating ${lang.name} translations:`, error);
      process.exit(1);
    }
  }

  console.log('\n✨ All translations generated successfully!');
}

// Exécuter
generateAllTranslations();
