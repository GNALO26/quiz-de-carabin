// Fichier: backend/scripts/seedQuizzes.js

const mongoose = require('mongoose');
const Quiz = require('../models/Quiz');
const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
require('dotenv').config();

// Fonction pour parser les fichiers DOCX et extraire les QCM
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

    // --- 1. EXTRACTION DU TITRE ET DESCRIPTION ---
    
    const titleMatch = firstBlock.match(/Titre\s*[:：]?\s*(.+?)(?=\r?\n|Description|Question|$)/i);
    currentQuiz.title = titleMatch 
        ? titleMatch[1].trim() 
        : path.basename(filePath, path.extname(filePath)).replace(/-/g, ' ').trim();

    const descMatch = firstBlock.match(/Description\s*[:：]?\s*(.+?)(?=\r?\n|Question|$)/i);
    if (descMatch) {
      currentQuiz.description = descMatch[1].trim();
    }
    
    if (!currentQuiz.title && firstBlock.trim()) {
         currentQuiz.title = firstBlock.split('\n')[0].trim();
    }


    // --- 2. PARSING DES QUESTIONS ---
    
    for (let i = 1; i < questionBlocks.length; i++) {
        const block = questionBlocks[i];

        // 2a. EXTRACTION DU TEXTE DE LA QUESTION 
        const questionMatch = block.match(/(?:Question|Q)\s*\d+\s*[:：]?\s*([\s\S]+?)(?=[a-eA-E]\)|\bRéponse\b|\bJustification\b|$)/i);
        
        if (!questionMatch || questionMatch[1].trim() === '') {
            console.warn(`⚠ Question ${i} ignorée (format incorrect ou vide):\n${block.substring(0,80)}...`);
            continue;
        }
        const questionText = questionMatch[1].trim(); 
        const contentAfterQuestion = block.substring(block.indexOf(questionMatch[0]) + questionMatch[0].length);


        // 2b. EXTRACTION DES OPTIONS ET CRÉATION DE L'ARRAY {text: '...'}
        const optionsRaw = [];
        // Regex pour capturer toutes les options (a), b), c)...)
        const optionRegex = /([a-eA-E])\)\s*([\s\S]+?)(?=\s*[a-eA-E]\)|\s*Réponse[:：]|\s*Justification[:：]|$)/gis;
        
        let optionMatch;
        while ((optionMatch = optionRegex.exec(contentAfterQuestion)) !== null) {
            optionsRaw.push({ text: optionMatch[2].trim().replace(/[\r\n]+/g, ' ') }); 
        }

        // *CORRECTION ICI : Filtrer les options dont le texte est vide après nettoyage*
        const optionsText = optionsRaw.filter(option => option.text.length > 0);


        // 2c. EXTRACTION DES RÉPONSES ET CONVERSION EN INDICES NUMÉRIQUES
        const answerMatch = block.match(/Réponses?\s*[:：]?\s*([a-eA-E,\s]+)/i);
        
        const answersLetters = answerMatch
            ? answerMatch[1].split(/[,\s]+/g).map(a => a.trim().toLowerCase()).filter(a => a.length > 0)
            : [];
            
        // Conversion de 'a', 'b', 'c' en indices [0, 1, 2]
        const correctAnswers = answersLetters
            .map(a => 'abcde'.indexOf(a.charAt(0)))
            .filter(i => i >= 0); // Filtre les indices valides (0-4)

        // 2d. EXTRACTION DE LA JUSTIFICATION
        const justificationMatch = block.match(/Justification\s*[:：]?\s*([\s\S]+?)(?=(?:Question|Q)\s*\d+[:：]?|$)/i);
        const justification = justificationMatch ? justificationMatch[1].trim() : "";
        
        // 2e. AJOUT DE LA QUESTION
        // On s'assure qu'on a au moins deux options (un QCM nécessite un choix) et une réponse
        if (optionsText.length >= 2 && correctAnswers.length > 0) {
            currentQuiz.questions.push({
                text: questionText,
                options: optionsText,
                correctAnswers: correctAnswers,
                justification: justification
            });
        }
    }

    if (currentQuiz.questions.length > 0) {
        quizzes.push(currentQuiz);
    }
    return quizzes;

  } catch (error) {
    console.error(`❌ Erreur parsing DOCX (${filePath}):`, error);
    return [];
  }
}

// Fonction principale d'exécution
async function seedFromDocx() {
  try {
    // NOTE : Assurez-vous que vos fichiers sont nommés exactement comme ci-dessous et placés dans 'backend/uploads/'
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
          category: 'echange-cellulaire',
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
          category: 'tissu-epithelial-1',
          free: true
        },
        {
          path: path.join(__dirname, '../uploads/tissu-conjonctif1.docx'),
          category: 'tissu-conjonctif-1',
          free: true
        },
        {
          path: path.join(__dirname, '../uploads/tissu-conjonctif2.docx'),
          category: 'tissu-conjonctif-2',
          free: false
        },
        {
          path: path.join(__dirname, '../uploads/tissu-cartilagineux.docx'),
          category: 'tissu-cartilagineux',
          free: false
        }
      ]
    };

    console.log('🗑 Suppression des anciens quizzes...');
    await Quiz.deleteMany({});
    console.log('✅ Anciens quizzes supprimés');

    let totalQuizzes = 0;
    let totalQuestions = 0;

    // PARCOURIR PAR MATIÈRE et insérer les quiz en base
    for (const [subject, configs] of Object.entries(docxSubjects)) {
      for (const config of configs) {
        if (fs.existsSync(config.path)) {
          
          console.log(`\n⏳ Parsing de: ${config.path.split('/').pop()}`);
          const quizzes = await parseDocxFile(config.path, config.category, config.free);

          if (quizzes.length > 0) {
            const quizzesWithSubject = quizzes.map(quiz => ({
              ...quiz,
              subject: subject,
            }));

            await Quiz.insertMany(quizzesWithSubject);
            
            totalQuizzes += quizzesWithSubject.length;
            quizzesWithSubject.forEach(quiz => {
              totalQuestions += quiz.questions.length;
            });
            console.log(`✅ ${quizzes[0].title} ajouté avec ${quizzes[0].questions.length} questions.`);
          } else {
             console.log(`⚠ Aucun quiz valide trouvé dans ${config.path.split('/').pop()}`);
          }
        } else {
           console.log(`❌ Fichier introuvable: ${config.path}`);
        }
      }
    }
    
    console.log('\n🎉 Base de données peuplée avec succès!');
    console.log(`📊 ${totalQuizzes} quizzes et ${totalQuestions} questions ajoutés`);

  } catch (error) {
    console.error('❌ Erreur générale lors du seeding:', error);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    process.exit(0);
  }
}

// Connexion MongoDB + lancement du seed
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ Connecté à MongoDB pour le Seeding');
    return seedFromDocx();
  })
  .catch(err => {
    console.error('❌ Erreur de connexion MongoDB', err);
    process.exit(1);
  });