import { Story, SpeakingQuestion } from '../types';

export const STORY_DEFAULT_QUESTIONS: Record<string, SpeakingQuestion[]> = {
  'whispering-tree-sapa': [
    {
      id: 'wt-q1',
      question: 'What challenges do you face when learning English, and how do you overcome them?',
      questionVi: 'Em thường gặp khó khăn gì khi học tiếng Anh và em vượt qua như thế nào?',
      hints: [
        'Describe your difficulty (pronunciation, new words, or grammar).',
        'Mention the tree advice: be patient and practice a little every day.',
      ],
      suggestedKeywords: ['patient', 'words', 'remember', 'practice', 'courage'],
      starterPhrase: 'When learning English, I sometimes find it hard to...',
      modelAnswer:
        'When learning English, I sometimes find it hard to remember new vocabulary. To overcome this challenge, I try to be patient and practice a little bit every day, just like the wise tree advised.',
    },
    {
      id: 'wt-q2',
      question: 'Do you agree that learning a language is like planting a seed? Why or why not?',
      questionVi: 'Em có đồng ý rằng việc học một ngôn ngữ giống như trồng một hạt mầm không? Vì sao?',
      hints: [
        'Give your opinion (Yes, I strongly agree / In my opinion...).',
        'Explain why: plants take time and care to grow, just like language skills.',
      ],
      suggestedKeywords: ['important', 'journey', 'slowly', 'grow', 'patient'],
      starterPhrase: 'In my opinion, I completely agree because...',
      modelAnswer:
        'In my opinion, I completely agree because learning takes time. A seed needs daily water and care, and our language skills grow step by step when we read and speak regularly.',
    },
    {
      id: 'wt-q3',
      question: 'What is one small habit you can do every morning to become more confident in English?',
      questionVi: 'Một thói quen nhỏ em có thể làm mỗi buổi sáng để tự tin hơn trong tiếng Anh là gì?',
      hints: [
        'Say what habit you choose (reading aloud, learning 3 new words, listening to a story).',
        'Explain how this habit helps you.',
      ],
      suggestedKeywords: ['tried', 'words', 'courage', 'journey', 'morning'],
      starterPhrase: 'Every morning, one small habit I can build is...',
      modelAnswer:
        'Every morning, I can read one paragraph aloud for five minutes. This small habit helps me discover new words and speak with much greater courage.',
    },
  ],
  'little-helper-family': [
    {
      id: 'lh-q1',
      question: 'What household chores do you do at home, and how do they help your family?',
      questionVi: 'Em thường làm những công việc nhà nào và những việc đó giúp ích gì cho gia đình?',
      hints: [
        'Mention 2-3 chores (washing dishes, sweeping the floor, folding clothes).',
        'Explain that it reduces your parents work and shows love.',
      ],
      suggestedKeywords: ['chores', 'responsibility', 'family bond', 'help'],
      starterPhrase: 'At home, I usually help my family by...',
      modelAnswer:
        'At home, I usually help my family by washing the dishes and cleaning my room. These chores teach me responsibility and strengthen our family bond.',
    },
    {
      id: 'lh-q2',
      question: 'Why is it important for students to take responsibility at home?',
      questionVi: 'Vì sao việc học sinh biết gánh vác trách nhiệm ở nhà lại rất quan trọng?',
      hints: [
        'Discuss building good character and developing gratitude.',
        'Explain that it prepares you for adulthood.',
      ],
      suggestedKeywords: ['responsibility', 'gratitude', 'character', 'important'],
      starterPhrase: 'I believe taking responsibility is essential because...',
      modelAnswer:
        'I believe taking responsibility is essential because it builds good character and develops genuine gratitude for our parents hard work.',
    },
  ],
  'lost-bicycle-hanoi': [
    {
      id: 'lb-q1',
      question: 'Have you ever lost something or had a stressful moment? What happened?',
      questionVi: 'Em đã từng bị thất lạc đồ vật hoặc rơi vào tình huống lo lắng chưa? Chuyện gì đã xảy ra?',
      hints: [
        'Describe what was lost or what happened.',
        'How did someone help you, or how did you solve the problem?',
      ],
      suggestedKeywords: ['panic', 'friendly', 'protect', 'found', 'gratitude'],
      starterPhrase: 'Once, I had a memorable experience when...',
      modelAnswer:
        'Once, I forgot my backpack at a bus stop. I felt worried, but a friendly person protected it and gave it back to me. I felt immense gratitude for their kindness.',
    },
    {
      id: 'lb-q2',
      question: 'How can small acts of kindness create a positive community?',
      questionVi: 'Những hành động tốt bụng nhỏ bé có thể tạo nên một cộng đồng tích cực như thế nào?',
      hints: [
        'Give examples of friendly actions (helping a neighbor, smiling, sharing).',
        'Explain why kindness makes everyone feel safe and happy.',
      ],
      suggestedKeywords: ['friendly', 'protect', 'kindness', 'community', 'memory'],
      starterPhrase: 'Small acts of kindness make our community better because...',
      modelAnswer:
        'Small acts of kindness make our community better because they connect people with warmth. When people protect and support each other, everyone feels safe and welcome.',
    },
  ],
  'brave-sea-turtle': [
    {
      id: 'st-q1',
      question: 'Why is it important to protect sea turtles and ocean marine life?',
      questionVi: 'Vì sao việc bảo vệ rùa biển và các sinh vật đại dương lại rất quan trọng?',
      hints: [
        'Mention threats like plastic waste and fishing nets.',
        'Explain why balanced oceans help all living creatures flourish.',
      ],
      suggestedKeywords: ['challenges', 'ocean', 'rescue', 'flourish', 'protect'],
      starterPhrase: 'Protecting sea turtles is very important because...',
      modelAnswer:
        'Protecting sea turtles is very important because they keep our marine ecosystem healthy. We should reduce plastic waste so ocean wildlife can survive and flourish.',
    },
    {
      id: 'st-q2',
      question: 'Can you describe a situation where determination helped you overcome a challenge?',
      questionVi: 'Em có thể kể về một tình huống mà sự quyết tâm đã giúp em vượt qua thử thách không?',
      hints: [
        'State the challenge (a difficult exam, learning a new sport, speaking in public).',
        'Explain how determination helped you achieve your goal.',
      ],
      suggestedKeywords: ['challenges', 'determination', 'instinct', 'success'],
      starterPhrase: 'A time when determination helped me was...',
      modelAnswer:
        'A time when determination helped me was preparing for an English speaking contest. Although I was nervous, my determination kept me practicing every day until I did well.',
    },
  ],
  'magic-coffee-dalat': [
    {
      id: 'cd-q1',
      question: 'What is your favorite food or drink in Vietnam, and why do you love it?',
      questionVi: 'Món ăn hoặc đồ uống yêu thích của em ở Việt Nam là gì và vì sao em thích nó?',
      hints: [
        'Name your favorite treat (coffee, pho, banh mi, tea).',
        'Describe its taste, aroma, and the special feeling it brings.',
      ],
      suggestedKeywords: ['aroma', 'special', 'sweet', 'memories', 'love'],
      starterPhrase: 'My favorite Vietnamese food or drink is...',
      modelAnswer:
        'My favorite Vietnamese drink is warm Da Lat artichoke tea. It has a sweet aroma and relaxing flavor that brings back fond memories of family trips to the highlands.',
    },
    {
      id: 'cd-q2',
      question: 'Why does dedication and love make any work more meaningful?',
      questionVi: 'Vì sao sự tận tâm và tình yêu thương lại làm cho mọi công việc trở nên ý nghĩa hơn?',
      hints: [
        'Explain how working with care brings joy to others.',
        'Mention creating peace and prosperity for the community.',
      ],
      suggestedKeywords: ['dedication', 'prosperity', 'community', 'meaningful'],
      starterPhrase: 'I think dedication makes our work meaningful because...',
      modelAnswer:
        'I think dedication makes our work meaningful because when we put real care into what we do, the results bring happiness and prosperity to those around us.',
    },
  ],
};

/**
 * Returns speaking questions for any story, generating contextual fallbacks if not explicitly defined.
 */
export function getSpeakingQuestionsForStory(story: Story): SpeakingQuestion[] {
  if (story.speakingQuestions && story.speakingQuestions.length > 0) {
    return story.speakingQuestions;
  }

  if (STORY_DEFAULT_QUESTIONS[story.id]) {
    return STORY_DEFAULT_QUESTIONS[story.id];
  }

  // Generate sensible contextual questions from the story title & keywords
  const title = story.title;
  const topKeywords = (story.keywords || []).slice(0, 5);

  return [
    {
      id: `${story.id}-q1`,
      question: `What is the most interesting lesson or message in the story "${title}"?`,
      questionVi: `Bài học hoặc thông điệp thú vị nhất trong câu chuyện "${title}" là gì?`,
      hints: [
        'Mention the main character or event.',
        'Explain what you learned from their experience.',
      ],
      suggestedKeywords: topKeywords,
      starterPhrase: `In this story, the most valuable lesson is...`,
      modelAnswer: `In this story, the most valuable lesson is to persevere and stay hopeful even when facing difficulties.`,
    },
    {
      id: `${story.id}-q2`,
      question: `How does the topic of "${title}" relate to your own personal life or studies?`,
      questionVi: `Chủ đề của câu chuyện "${title}" liên hệ như thế nào với cuộc sống hoặc việc học tập của em?`,
      hints: [
        'Connect the story events to your daily routine, family, or school.',
        'Use at least 1 or 2 new words from the story.',
      ],
      suggestedKeywords: topKeywords,
      starterPhrase: `This story reminds me of my own life because...`,
      modelAnswer: `This story reminds me of my own studies because I also have to practice consistently every day to make steady progress.`,
    },
    {
      id: `${story.id}-q3`,
      question: `If you could talk to the main character in "${title}", what advice or question would you share?`,
      questionVi: `Nếu em có thể trò chuyện với nhân vật chính trong câu chuyện, em sẽ chia sẻ lời khuyên hoặc câu hỏi gì?`,
      hints: [
        'Ask them about their feelings or congratulate them on their journey.',
      ],
      suggestedKeywords: topKeywords,
      starterPhrase: `If I met the main character, I would tell them...`,
      modelAnswer: `If I met the main character, I would encourage them to keep going and thank them for being an inspiring role model.`,
    },
  ];
}
