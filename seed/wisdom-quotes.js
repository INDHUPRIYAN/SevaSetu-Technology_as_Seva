// Teachings for the Wisdom page and "Seva Wisdom for Today".
// Every text is copied verbatim from The Complete Works of Swami Vivekananda and was matched, word
// for word, against two online copies (the `url`, and the same piece on ramakrishnavivekananda.info).
// Neither online copy shows printed page numbers, so `page` is null until someone looks in the book.
// `checked` stays false until a person has found the quote in a printed volume; seed-reflect warns
// while any are unchecked. `url` and `checked` are not stored in the database.
module.exports = [
  {
    theme: 'service',
    // The full sentence opens "My noble Prince, this life is short, the vanities of the world are
    // transient, but they alone live…"; the ellipsis marks the trim.
    text: '…they alone live who live for others, the rest are more dead than alive.',
    source: 'Complete Works, Vol. 4, Writings: Prose, Our Duty to the Masses',
    volume: 4,
    page: null,
    url: 'https://en.wikisource.org/wiki/The_Complete_Works_of_Swami_Vivekananda/Volume_4/Writings:_Prose/Our_Duty_to_the_Masses',
    checked: false,
  },
  {
    theme: 'service',
    text: 'Three things are necessary for great achievements. First, feel from the heart.',
    source: 'Complete Works, Vol. 3, Lectures from Colombo to Almora, My Plan of Campaign',
    volume: 3,
    page: null,
    url: 'https://en.wikisource.org/wiki/The_Complete_Works_of_Swami_Vivekananda/Volume_3/Lectures_from_Colombo_to_Almora/My_Plan_of_Campaign',
    checked: false,
  },
  {
    theme: 'strength',
    text: 'This is the great fact: strength is life, weakness is death.',
    source: 'Complete Works, Vol. 2, Work and its Secret',
    volume: 2,
    page: null,
    url: 'https://en.wikisource.org/wiki/The_Complete_Works_of_Swami_Vivekananda/Volume_2/Work_and_its_Secret',
    checked: false,
  },
  {
    theme: 'strength',
    text: 'Have faith in yourselves, and stand up on that faith and be strong; that is what we need.',
    source: 'Complete Works, Vol. 3, Lectures from Colombo to Almora, The Mission of the Vedanta',
    volume: 3,
    page: null,
    url: 'https://en.wikisource.org/wiki/The_Complete_Works_of_Swami_Vivekananda/Volume_3/Lectures_from_Colombo_to_Almora/The_Mission_of_the_Vedanta',
    checked: false,
  },
  {
    theme: 'patience',
    text: 'Purity, patience, and perseverance overcome all obstacles. All great things must of necessity be slow.',
    source: 'Complete Works, Vol. 6, Epistles - Second Series, LXXXII (Reading, England, 4th Oct., 1895)',
    volume: 6,
    page: null,
    url: 'https://en.wikisource.org/wiki/The_Complete_Works_of_Swami_Vivekananda/Volume_6/Epistles_-_Second_Series/LXXXII_Dear%E2%80%94',
    checked: false,
  },
  {
    theme: 'patience',
    text: 'Each work has to pass through these stages — ridicule, opposition, and then acceptance.',
    source: 'Complete Works, Vol. 5, Epistles - First Series, XLVII Maharaja of Khetri (U.S.A., 9th July, 1895)',
    volume: 5,
    page: null,
    url: 'https://en.wikisource.org/wiki/The_Complete_Works_of_Swami_Vivekananda/Volume_5/Epistles_-_First_Series/XLVII_Maharaja_of_Khetri',
    checked: false,
  },
  {
    theme: 'work',
    text: 'The whole gist of this teaching is that you should work like a master and not as a slave; work incessantly, but do not do slave\'s work.',
    source: 'Complete Works, Vol. 1, Karma-Yoga, The Secret of Work',
    volume: 1,
    page: null,
    url: 'https://en.wikisource.org/wiki/The_Complete_Works_of_Swami_Vivekananda/Volume_1/Karma-Yoga/The_Secret_of_Work',
    checked: false,
  },
  {
    theme: 'work',
    text: 'Let us work on, doing as we go whatever happens to be our duty, and being ever ready to put our shoulders to the wheel.',
    source: 'Complete Works, Vol. 1, Karma-Yoga, What is Duty?',
    volume: 1,
    page: null,
    url: 'https://en.wikisource.org/wiki/The_Complete_Works_of_Swami_Vivekananda/Volume_1/Karma-Yoga/What_is_Duty%3F',
    checked: false,
  },
  // The four below also back the "Why?" explanations (seed/reflect-data.js).
  {
    theme: 'service',
    text: 'You cannot help anyone, you can only serve: serve the children of the Lord, serve the Lord Himself, if you have the privilege.',
    source: 'Complete Works, Vol. 3, Lectures from Colombo to Almora, Vedanta in its Application to Indian Life',
    volume: 3,
    page: null,
    url: 'https://en.wikisource.org/wiki/The_Complete_Works_of_Swami_Vivekananda/Volume_3/Lectures_from_Colombo_to_Almora/Vedanta_in_its_Application_to_Indian_Life',
    checked: false,
  },
  {
    theme: 'strength',
    // In the lecture this follows "…every one will work out his own salvation" and comes before a warning
    // against anyone who says "I will work out the salvation of this woman or child."
    text: 'Liberty is the first condition of growth.',
    source: 'Complete Works, Vol. 3, Lectures from Colombo to Almora, Vedanta in its Application to Indian Life',
    volume: 3,
    page: null,
    url: 'https://en.wikisource.org/wiki/The_Complete_Works_of_Swami_Vivekananda/Volume_3/Lectures_from_Colombo_to_Almora/Vedanta_in_its_Application_to_Indian_Life',
    checked: false,
  },
  {
    theme: 'work',
    text: 'Seek no praise, no reward, for anything you do. No sooner do we perform a good action than we begin to desire credit for it.',
    source: 'Complete Works, Vol. 1, Karma-Yoga, Freedom',
    volume: 1,
    page: null,
    url: 'https://en.wikisource.org/wiki/The_Complete_Works_of_Swami_Vivekananda/Volume_1/Karma-Yoga/Freedom',
    checked: false,
  },
  {
    theme: 'work',
    text: 'There are some who are really the salt of the earth in every country and who work for work\'s sake, who do not care for name, or fame, or even to go to heaven.',
    source: 'Complete Works, Vol. 1, Karma-Yoga, Karma in its Effect on Character',
    volume: 1,
    page: null,
    url: 'https://en.wikisource.org/wiki/The_Complete_Works_of_Swami_Vivekananda/Volume_1/Karma-Yoga/Karma_in_its_Effect_on_Character',
    checked: false,
  },
];
