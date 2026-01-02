// HTML checkbox value'ları ile JSON dosya yolları ve JSON içindeki 'file' alanının eşleşmesi
// DİKKAT: Buradaki 'filePath' ve 'jsonFileValue' değerlerini kendi dosyalarınıza göre güncellemeniz gerekecek.
const fileMappings = {
    "Hafta-9": { filePath: "hafta9.json", jsonFileValue: "Hafta 9 Konuları" },
    "Hafta-10": { filePath: "hafta10.json", jsonFileValue: "Hafta 10 Konuları" },
    "Hafta-11": { filePath: "hafta11.json", jsonFileValue: "Hafta 11 Konuları" },
    "Hafta-12": { filePath: "hafta12.json", jsonFileValue: "Hafta 12 Konuları" },
    "Hafta-13": { filePath: "hafta13.json", jsonFileValue: "Hafta 13 Konuları" }
};

// HTML elementlerini seçme
const mainMenu = document.getElementById('main-menu');
const quizArea = document.getElementById('quiz-area');
const endScreen = document.getElementById('end-screen');
const fileCheckboxes = document.querySelectorAll('.file-checkbox');
const rangeRadios = document.querySelectorAll('input[name="question-range"]');
const modeRadios = document.querySelectorAll('input[name="quiz-mode"]');
const startQuizBtn = document.getElementById('start-quiz-btn');
const reviewWrongBtn = document.getElementById('review-wrong-btn');
const wrongAnswersSummary = document.getElementById('wrong-answers-summary');
const wrongAnswersList = document.getElementById('wrong-answers-list');
const wrongCountSpan = document.getElementById('wrong-count');
const clearWrongBtn = document.getElementById('clear-wrong-btn');
const questionCounter = document.getElementById('question-counter');
const currentQSpan = document.getElementById('current-q');
const totalQSpan = document.getElementById('total-q');
const questionText = document.getElementById('question-text');
const optionsContainer = document.getElementById('options-container');
const feedbackDiv = document.getElementById('feedback');
const explanationDiv = document.getElementById('explanation');
const nextQuestionBtn = document.getElementById('next-question-btn');
const backToMenuBtn = document.getElementById('back-to-menu-btn');
const finalScorePara = document.getElementById('final-score');

let allQuestions = [];
let quizPool = [];
let currentLoopQuestions = [];
let currentQuestionIndex = 0;
let correctCountInCurrentQuiz = 0;
let wrongAnswerIds = JSON.parse(localStorage.getItem('wrongAnswerIds') || '[]');

// --- Yardımcı Fonksiyonlar ---

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function saveWrongAnswers() {
    const uniqueWrongIds = [...new Set(wrongAnswerIds)];
    localStorage.setItem('wrongAnswerIds', JSON.stringify(uniqueWrongIds));
    updateWrongAnswersList();
}

function loadWrongAnswers() {
    wrongAnswerIds = JSON.parse(localStorage.getItem('wrongAnswerIds') || '[]');
    updateWrongAnswersList();
}

function updateWrongAnswersList() {
    wrongAnswersList.innerHTML = '';
    const uniqueWrongIds = [...new Set(wrongAnswerIds)];
    wrongCountSpan.textContent = uniqueWrongIds.length;

    if (uniqueWrongIds.length === 0) {
        wrongAnswersSummary.style.display = 'none';
        reviewWrongBtn.style.display = 'none';
        clearWrongBtn.style.display = 'none';
        return;
    }

    wrongAnswersSummary.style.display = 'block';
    reviewWrongBtn.style.display = 'block';
    clearWrongBtn.style.display = 'inline-block';

    uniqueWrongIds.forEach(qId => {
        const question = allQuestions.find(q => q.id === qId);
        if (question) {
            const listItem = document.createElement('li');
            const displayQuestionText = question.question.length > 100 ?
                                        question.question.substring(0, 100) + '...' :
                                        question.question;
            const fileKey = Object.keys(fileMappings).find(key => fileMappings[key].jsonFileValue === question.file);
            const fileDisplay = fileKey ? fileKey.replace('-', ' ') : question.file; // "Hafta-9" -> "Hafta 9"
            listItem.textContent = `${displayQuestionText} [${fileDisplay}]`;
            wrongAnswersList.appendChild(listItem);
        }
    });
}

function clearWrongAnswers() {
    if (confirm("Tüm yanlış cevap listenizi kalıcı olarak silmek istediğinizden emin misiniz?")) {
        wrongAnswerIds = [];
        saveWrongAnswers();
    }
}

// --- Arayüz Durumu Yönetimi ---

function showMainMenu() {
    mainMenu.style.display = 'block';
    quizArea.style.display = 'none';
    endScreen.style.display = 'none';
    currentQuestionIndex = 0;
    correctCountInCurrentQuiz = 0;
    loadWrongAnswers();
}

function showQuizArea() {
    mainMenu.style.display = 'none';
    endScreen.style.display = 'none';
    quizArea.style.display = 'block';
}

function showEndScreen(correctCount, totalCount) {
    quizArea.style.display = 'none';
    endScreen.style.display = 'block';
    const selectedMode = document.querySelector('input[name="quiz-mode"]:checked').value;

    if (selectedMode === 'infinite') {
        finalScorePara.textContent = `Bir tur tamamlandı! Bu turda ${totalCount} soru çözdünüz. Ana menüye dönüp yanlışlarınızı kontrol edebilir veya yeni bir quize başlayabilirsiniz.`;
    } else {
        finalScorePara.textContent = `Quiz Tamamlandı! Toplam ${totalCount} sorudan ${correctCount} tanesini doğru cevapladınız.`;
    }

    document.getElementById('restart-from-end-btn').onclick = showMainMenu;
    document.getElementById('back-to-menu-from-end-btn').onclick = showMainMenu;
}

// --- Quiz Mantığı ---

function getQuestionNumberFromId(id) {
    const parts = id.split('_q');
    return parts.length === 2 ? parseInt(parts[1], 10) : NaN;
}

async function initializeQuiz(isReviewingWrong = false) {
    quizArea.dataset.isReviewingWrong = isReviewingWrong.toString();
    if (allQuestions.length === 0) {
        await loadQuestions();
        if (allQuestions.length === 0) return;
    }

    const selectedFilesShortNames = Array.from(fileCheckboxes)
        .filter(checkbox => checkbox.checked)
        .map(checkbox => checkbox.value);

    if (selectedFilesShortNames.length === 0 && !isReviewingWrong) {
        alert('Lütfen en az bir hafta seçin.');
        return;
    }

    const selectedFilesJsonValues = selectedFilesShortNames.map(shortName => fileMappings[shortName].jsonFileValue);
    const selectedMode = document.querySelector('input[name="quiz-mode"]:checked').value;
    const selectedRange = document.querySelector('input[name="question-range"]:checked').value;

    let filteredByFiles = allQuestions;
    if (!isReviewingWrong || selectedFilesShortNames.length > 0) {
        if (selectedFilesShortNames.length > 0) {
            filteredByFiles = allQuestions.filter(q => selectedFilesJsonValues.includes(q.file));
        }
    }

    let filteredByRange = filteredByFiles;
    if (selectedRange !== 'all' && !isReviewingWrong) {
        filteredByRange = filteredByFiles.filter(q => {
            const qNumber = getQuestionNumberFromId(q.id);
            if (isNaN(qNumber)) return false;
            if (selectedRange === '1-25') return qNumber >= 1 && qNumber <= 25;
            if (selectedRange === '26-50') return qNumber >= 26 && qNumber <= 50;
            if (selectedRange === '51-75') return qNumber >= 51 && qNumber <= 75;
            if (selectedRange === '76+') return qNumber >= 76;
            return false;
        });
    }

    if (isReviewingWrong) {
        quizPool = filteredByRange.filter(q => wrongAnswerIds.includes(q.id));
        if (quizPool.length === 0) {
            alert('Tekrar çözmek için (seçili kriterlere uyan) yanlış yaptığınız soru bulunmamaktadır.');
            showMainMenu();
            return;
        }
    } else {
        quizPool = filteredByRange;
    }

    if (quizPool.length === 0) {
        alert('Seçtiğiniz kriterlere uygun soru bulunamadı.');
        showMainMenu();
        return;
    }

    currentLoopQuestions = [...quizPool];
    if (selectedMode === 'repeatWrong' && !isReviewingWrong) {
        // Bu mod için yanlışları tutacak geçici bir liste
        quizArea.dataset.tempWrongIds = JSON.stringify([]);
    }

    shuffleArray(currentLoopQuestions);
    currentQuestionIndex = 0;
    correctCountInCurrentQuiz = 0;

    showQuizArea();
    displayCurrentQuestion();
}

function displayCurrentQuestion() {
    // Tur bitti mi kontrolü
    if (currentLoopQuestions.length === 0) {
        const selectedMode = document.querySelector('input[name="quiz-mode"]:checked').value;
        const isReviewingWrong = quizArea.dataset.isReviewingWrong === 'true';
        
        if (selectedMode === 'repeatWrong' && !isReviewingWrong) {
            let tempWrongIds = JSON.parse(quizArea.dataset.tempWrongIds || '[]');
            if (tempWrongIds.length > 0) {
                // Sadece bu turda yapılan yanlışları tekrar sormak için havuzu yeniden doldur
                currentLoopQuestions = quizPool.filter(q => tempWrongIds.includes(q.id));
                quizArea.dataset.tempWrongIds = JSON.stringify([]); // Geçici listeyi sıfırla
                shuffleArray(currentLoopQuestions);
                // Quiz bitmedi, yanlışlar turu başlıyor
            } else {
                endQuiz();
                return;
            }
        } else if (selectedMode === 'infinite' && !isReviewingWrong) {
             currentLoopQuestions = [...quizPool]; // Ana havuzdan turu yenile
             shuffleArray(currentLoopQuestions);
             // Sayaçlar sıfırlanmıyor, sonsuz modda devam ediyor
        } else {
            endQuiz();
            return;
        }
    }

    const question = currentLoopQuestions[0]; // Soruyu al ama henüz diziden çıkarma
    const totalInLoop = quizPool.length;
    
    questionCounter.textContent = `Soru: ${currentQuestionIndex + 1} / ${totalInLoop}`;
    questionText.textContent = question.question;
    optionsContainer.innerHTML = '';
    feedbackDiv.textContent = '';
    explanationDiv.style.display = 'none';
    nextQuestionBtn.style.display = 'none';

    const optionsArray = Object.keys(question.options).map(key => ({
        key: key,
        text: question.options[key]
    }));
    const shuffledOptions = shuffleArray(optionsArray);
    const newLabels = ['A', 'B', 'C', 'D', 'E'];

    shuffledOptions.forEach((option, index) => {
        const button = document.createElement('button');
        button.classList.add('option-button');
        button.textContent = `${newLabels[index]}) ${option.text}`;
        button.dataset.originalKey = option.key;
        button.dataset.questionId = question.id;
        button.addEventListener('click', handleAnswerClick);
        optionsContainer.appendChild(button);
    });
}


function handleAnswerClick(event) {
    const selectedButton = event.target;
    const selectedOriginalKey = selectedButton.dataset.originalKey;
    const questionId = selectedButton.dataset.questionId;
    const currentQuestion = allQuestions.find(q => q.id === questionId);
    
    if (!currentQuestion) return;

    const correctAnswerKey = currentQuestion.correct_answer;
    
    Array.from(optionsContainer.children).forEach(btn => {
        btn.disabled = true;
        if (btn.dataset.originalKey === correctAnswerKey) {
            btn.classList.add('correct');
        }
    });

    if (selectedOriginalKey === correctAnswerKey) {
        selectedButton.classList.add('correct');
        feedbackDiv.textContent = 'Doğru!';
        feedbackDiv.style.color = 'green';
        correctCountInCurrentQuiz++;
        wrongAnswerIds = wrongAnswerIds.filter(id => id !== questionId);
    } else {
        selectedButton.classList.add('wrong');
        feedbackDiv.textContent = `Yanlış! Doğru Cevap: ${correctAnswerKey}`;
        feedbackDiv.style.color = 'red';
        wrongAnswerIds.push(questionId);
        
        const selectedMode = document.querySelector('input[name="quiz-mode"]:checked').value;
        const isReviewingWrong = quizArea.dataset.isReviewingWrong === 'true';
        if(selectedMode === 'repeatWrong' && !isReviewingWrong) {
            let tempWrongIds = JSON.parse(quizArea.dataset.tempWrongIds || '[]');
            tempWrongIds.push(questionId);
            quizArea.dataset.tempWrongIds = JSON.stringify([...new Set(tempWrongIds)]);
        }
    }
    
    saveWrongAnswers();

    if (currentQuestion.explanation) {
        explanationDiv.textContent = 'Açıklama: ' + currentQuestion.explanation;
        explanationDiv.style.display = 'block';
    }

    nextQuestionBtn.style.display = 'block';
}


function nextQuestion() {
    currentLoopQuestions.shift(); // Soruyu diziden çıkar
    currentQuestionIndex++;
    displayCurrentQuestion();
}


function endQuiz() {
    showEndScreen(correctCountInCurrentQuiz, quizPool.length);
    quizArea.dataset.isReviewingWrong = 'false';
}

// --- Veri Yükleme ---
async function loadQuestions() {
    const fetchPromises = Object.values(fileMappings).map(async fileInfo => {
        try {
            const response = await fetch(fileInfo.filePath);
            if (!response.ok) {
                console.error(`Dosya yüklenemedi: ${fileInfo.filePath}, Status: ${response.status}`);
                return [];
            }
            const questions = await response.json();
            if (!Array.isArray(questions)) {
                console.error(`JSON format hatası: ${fileInfo.filePath} bir dizi değil.`);
                return [];
            }
            return questions.filter(q => q.id && q.file && q.question && q.options && q.correct_answer);
        } catch (error) {
            console.error(`Dosya yüklenirken hata: ${fileInfo.filePath}`, error);
            return [];
        }
    });

    const results = await Promise.all(fetchPromises);
    allQuestions = results.flat();

    if (allQuestions.length === 0) {
        alert('Hiç geçerli soru yüklenemedi. JSON dosyalarını ve yollarını kontrol edin.');
        startQuizBtn.disabled = true;
    } else {
        startQuizBtn.disabled = false;
        updateWrongAnswersList();
    }
}

// --- Olay Dinleyicileri ---
startQuizBtn.addEventListener('click', () => initializeQuiz(false));
nextQuestionBtn.addEventListener('click', nextQuestion);
backToMenuBtn.addEventListener('click', showMainMenu);
clearWrongBtn.addEventListener('click', clearWrongAnswers);
reviewWrongBtn.addEventListener('click', () => initializeQuiz(true));

// --- Uygulamayı Başlat ---
document.addEventListener('DOMContentLoaded', () => {
    showMainMenu();
    loadQuestions();
});