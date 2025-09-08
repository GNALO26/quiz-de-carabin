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

    // Découper en blocs de questions
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

      // Question
      const questionMatch = block.match(/(?:Question|Q)\s*\d+\s*[:：]?\s*(.+?)(?=a\)|b\)|c\)|d\)|e\)|Réponse|Justification|$)/is);
      if (!questionMatch) {
        console.warn(`⚠ Question ignorée (mauvais format):\n${block.substring(0,80)}...`);
        continue;
      }
      const questionText = questionMatch[1].trim();

      // Options
      const options = [];
      const optionRegex = /([a-eA-E])\)\s*(.+?)(?=[a-eA-E]\)|Réponse|Justification|$)/gis;
      let optionMatch;
      while ((optionMatch = optionRegex.exec(block)) !== null) {
        options.push(optionMatch[2].trim());
      }

      // Réponses
      const answerMatch = block.match(/Réponses?\s*[:：]?\s*([a-eA-E,\s]+)/i);
      const answers = answerMatch
        ? answerMatch[1].split(',').map(a => a.trim().toLowerCase())
        : [];
      const correctAnswers = answers
        .map(a => 'abcde'.indexOf(a.charAt(0)))
        .filter(i => i >= 0);

      // Justification
      const justificationMatch = block.match(/Justification\s*[:：]?\s*([\s\S]+?)(?=(?:Question|Q)\s*\d+[:：]?|$)/i);
      const justification = justificationMatch ? justificationMatch[1].trim() : "";

      // Ajouter la question
      currentQuiz.questions.push({
        text: questionText,
        options: options,
        correctAnswers: correctAnswers,
        justification: justification
      });
    }

    quizzes.push(currentQuiz);
    return quizzes;

  } catch (error) {
    console.error('❌ Erreur parsing DOCX:', error);
    return [];
  }
}

// Fonction principale
async function seedFromDocx() {
  try {
    const docxConfig = [
      {
        path: path.join(__dirname, '../uploads/physiologie-renale.docx'),
        category: 'physiologie-renale',
        free: false
      },
      {
        path: path.join(__dirname, '../uploads/tissu-epithelial1.docx'),
        category: 'tissu-epithelial1',
        free: true
      },
      {
        path: path.join(__dirname, '../uploads/tissu-epithelial2.docx'),
        category: 'tissu-epithelial2',
        free: false
      },
      {
        path: path.join(__dirname, '../uploads/tissu-conjonctif1.docx'),
        category: 'tissu-conjonctif1',
        free: false
      },
      {
        path: path.join(__dirname, '../uploads/tissu-conjonctif2.docx'),
        category: 'tissu-conjonctif2',
        free: false
      },
      {
        path: path.join(__dirname, '../uploads/tissu-cartilagineux.docx'),
        category: 'tissu-cartilagineux',
        free: false
      },
      {
        path: path.join(__dirname, '../uploads/echange.docx'),
        category: 'echange',
        free: false
      },
      {
        path: path.join(__dirname, '../uploads/tissu-musculaire1.docx'),
        category: 'tissu-musculaire1',
        free: false
      },
      {
        path: path.join(__dirname, '../uploads/tissu-musculaire2.docx'),
        category: 'tissu-musculaire2',
        free: false
      },
      {
        path: path.join(__dirname, '../uploads/tissu-nerveux1.docx'),
        category: 'tissu-nerveux1',
        free: false
      },
      {
        path: path.join(__dirname, '../uploads/tissu-nerveux2.docx'),
        category: 'tissu-nerveux2',
        free: false
      },
      {
        path: path.join(__dirname, '../uploads/tissu-osseux1.docx'),
        category: 'tissu-osseux1',
        free: false
      },
      {
        path: path.join(__dirname, '../uploads/tissu-osseux2.docx'),
        category: 'tissu-osseux2',
        free: false
      },
      {
        path: path.join(__dirname, '../uploads/physiologie-musculaire.docx'),
        category: 'physiologie-musculaire',
        free: false
      },
      {
        path: path.join(__dirname, '../uploads/physiologie-respiratoire.docx'),
        category: 'physiologie-respiratoire',
        free: false
      }
    ];

    console.log('🗑 Suppression des anciens quizzes...');
    await Quiz.deleteMany({});
    console.log('✅ Anciens quizzes supprimés');

    let totalQuizzes = 0;
    let totalQuestions = 0;

    for (const config of docxConfig) {
      if (fs.existsSync(config.path)) {
        console.log(`\n📖 Lecture de ${path.basename(config.path)}`);
        console.log(`   Catégorie: ${config.category}`);
        console.log(`   Statut: ${config.free ? 'GRATUIT' : 'PAYANT'}`);

        const quizzes = await parseDocxFile(config.path, config.category, config.free);

        if (quizzes.length > 0) {
          await Quiz.insertMany(quizzes);
          console.log(`✅ ${quizzes.length} quizzes ajoutés`);

          totalQuizzes += quizzes.length;
          quizzes.forEach(quiz => {
            totalQuestions += quiz.questions.length;
            console.log(`   - "${quiz.title}" avec ${quiz.questions.length} questions`);
          });
        } else {
          console.log('❌ Aucun quiz trouvé dans ce fichier');
        }
      } else {
        console.log(`❌ Fichier non trouvé: ${path.basename(config.path)}`);
      }
    }

    console.log('\n🎉 Base de données peuplée avec succès!');
    console.log(`📊 ${totalQuizzes} quizzes et ${totalQuestions} questions ajoutés`);

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}
console.log('Quiz model:', Quiz);
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