// backend/scripts/seedQuizzes.js
const mongoose = require('mongoose');
const Quiz = require('../models/Quiz');
const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
require('dotenv').config();

// Fonction pour parser les fichiers DOCX
async function parseDocxFile(filePath, category, isFree = true) {
  try {
    const { value } = await mammoth.extractRawText({ path: filePath });
    const allText = value;

    const quizzes = [];
    let currentQuiz = {
      title: '',
      description: '',
      category: category,
      free: isFree,
      questions: []
    };

    // Découper en blocs de questions basés sur "Question X" ou "Q X"
    const questionBlocks = allText.split(/(?=(?:Question|Q)\s*\d+[:：]?)/i);

    // Bloc d'entête (titre + description)
    const firstBlock = questionBlocks[0] || "";

    // Titre
    const titleMatch = firstBlock.match(/Titre\s*[:：]?\s*(.+?)(?=\r?\n|Description|Question|$)/i);
    if (titleMatch) {
      currentQuiz.title = titleMatch[1].trim();
    } else {
      currentQuiz.title = path.basename(filePath, '.docx');
    }

    // Description
    const descMatch = firstBlock.match(/Description\s*[:：]?\s*(.+?)(?=\r?\n|Question|$)/i);
    if (descMatch) {
      currentQuiz.description = descMatch[1].trim();
    }

    // Parcourir chaque question
    for (let i = 1; i < questionBlocks.length; i++) {
        const block = questionBlocks[i];

        // --- 1. EXTRACTION DU TEXTE DE LA QUESTION (CORRIGÉ) ---
        
        // On capture le texte entre le "Question X:" et le début des options (a), b), etc.) ou d'autres blocs (Réponse/Justification).
        const questionMatch = block.match(/(?:Question|Q)\s*\d+\s*[:：]?\s*([\s\S]+?)(?=[a-eA-E]\)|\bRéponse\b|\bJustification\b|$)/i);
        
        if (!questionMatch) {
            console.warn(`⚠ Question ${i} ignorée (mauvais format de début):\n${block.substring(0,80)}...`);
            continue;
        }
        // questionMatch[1] contient le texte de la question
        const questionText = questionMatch[1].trim(); 
        
        // Le contenu après la question est utilisé pour trouver les options/réponses
        const contentAfterQuestion = block.substring(block.indexOf(questionMatch[0]) + questionMatch[0].length);


        // --- 2. EXTRACTION DES OPTIONS (CORRIGÉ) ---
        
        const options = [];
        // Regex pour capturer toutes les options (a), b), c)...) jusqu'à "Réponse:" ou "Justification:"
        const optionRegex = /([a-eA-E])\)\s*([\s\S]+?)(?=\s*[a-eA-E]\)|\s*Réponse[:：]|\s*Justification[:：]|$)/gis;
        
        let optionMatch;
        while ((optionMatch = optionRegex.exec(contentAfterQuestion)) !== null) {
            // optionMatch[2] contient le texte de l'option
            // On remplace les sauts de ligne internes par des espaces pour un affichage propre
            options.push(optionMatch[2].trim().replace(/[\r\n]+/g, ' ')); 
        }

        // --- 3. EXTRACTION DES RÉPONSES ---
        
        // On cherche les lettres de réponse (ex: 'c' ou 'b, c, d')
        const answerMatch = block.match(/Réponses?\s*[:：]?\s*([a-eA-E,\s]+)/i);
        
        // Normaliser les réponses: diviser par virgule/espace, prendre la première lettre, filtrer
        const answers = answerMatch
            ? answerMatch[1].split(/[,\s]+/g).map(a => a.trim().toLowerCase()).filter(a => a.length > 0)
            : [];
            
        // Convertir les lettres en indices (a=0, b=1, c=2...)
        const correctAnswers = answers
            .map(a => 'abcde'.indexOf(a.charAt(0)))
            .filter(i => i >= 0);

        // --- 4. EXTRACTION DE LA JUSTIFICATION ---
        
        // On capture le texte après 'Justification:' jusqu'à la prochaine question ou la fin du fichier.
        const justificationMatch = block.match(/Justification\s*[:：]?\s*([\s\S]+?)(?=(?:Question|Q)\s*\d+[:：]?|$)/i);
        const justification = justificationMatch ? justificationMatch[1].trim() : "";

        // --- 5. AJOUT DE LA QUESTION ---
        currentQuiz.questions.push({
            text: questionText,
            options: options.filter(opt => opt.length > 0), // Assurer que les options sont un tableau non vide
            correctAnswers: correctAnswers,
            justification: justification
        });
    }

    quizzes.push(currentQuiz);
    return quizzes;

  } catch (error) {
    console.error(`❌ Erreur parsing DOCX (${filePath}):`, error);
    return [];
  }
}

// Fonction principale
async function seedFromDocx() {
  try {
    // NOUVELLE STRUCTURE DE CONFIGURATION PAR MATIÈRE (Classification maintenue)
    const docxSubjects = {
      'Physiologie': [
        {
          path: path.join(__dirname, '../uploads/physiologie-renale.docx'),
          category: 'physiologie-renale',
          free: true
        },
        {
          path: path.join(__dirname, '../uploads/physiologie-respiratoire.docx'),
          category: 'physiologie-respiratoire',
          free: false
        },
        {
          path: path.join(__dirname, '../uploads/echange.docx'),
          category: 'echange',
          free: true
        },
        {
          path: path.join(__dirname, '../uploads/physiologie-musculaire.docx'),
          category: 'physiologie-musculaire',
          free: true
        }
      ],
      'Histologie': [
        {
          path: path.join(__dirname, '../uploads/tissu-epithelial1.docx'),
          category: 'tissu-epithelial1',
          free: true
        },
        {
          path: path.join(__dirname, '../uploads/tissu-conjonctif1.docx'),
          category: 'tissu-conjonctif1',
          free: true
        },
        // ... (Autres fichiers Histologie)
      ]
      // Ajoutez d'autres matières ici (Anatomie, Bactériologie, etc.)
    };

    console.log('🗑 Suppression des anciens quizzes...');
    await Quiz.deleteMany({});
    console.log('✅ Anciens quizzes supprimés');

    let totalQuizzes = 0;
    let totalQuestions = 0;

    // PARCOURIR PAR MATIÈRE
    for (const [subject, configs] of Object.entries(docxSubjects)) {
      console.log(`\n============== Démarrage de la matière : ${subject} ==============`);

      for (const config of configs) {
        if (fs.existsSync(config.path)) {
          console.log(`\n📖 Lecture de ${path.basename(config.path)}`);

          const quizzes = await parseDocxFile(config.path, config.category, config.free);

          if (quizzes.length > 0) {
            // AJOUT DE LA MATIÈRE avant insertion (Classification par matière)
            const quizzesWithSubject = quizzes.map(quiz => ({
              ...quiz,
              subject: subject, // Ajout du champ 'subject'
            }));

            await Quiz.insertMany(quizzesWithSubject);
            console.log(`✅ ${quizzesWithSubject.length} quizzes ajoutés (Matière: ${subject})`);

            totalQuizzes += quizzesWithSubject.length;
            quizzesWithSubject.forEach(quiz => {
              totalQuestions += quiz.questions.length;
              console.log(`   - "${quiz.title}" avec ${quiz.questions.length} questions`);
            });
          } else {
            console.log('❌ Aucun quiz trouvé ou erreur de parsing dans ce fichier');
          }
        } else {
          console.log(`❌ Fichier non trouvé: ${path.basename(config.path)}`);
        }
      }
    }
    
    console.log('\n🎉 Base de données peuplée avec succès!');
    console.log(`📊 ${totalQuizzes} quizzes et ${totalQuestions} questions ajoutés`);

  } catch (error) {
    console.error('❌ Erreur générale lors du seeding:', error);
  } finally {
    // S'assurer que la connexion est fermée
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    process.exit(0);
  }
}

// Connexion MongoDB + lancement du seed
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ Connecté à MongoDB');
    return seedFromDocx();
  })
  .catch(err => {
    console.error('❌ Erreur de connexion MongoDB', err);
    process.exit(1);
  });