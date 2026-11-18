'use strict';

const schoolProgress = (() => {
  const storagePrefix = 'fiverox-portal-v3.school.v1.';
  const practiceAnswers = {
    sales: [1, 0, 1, 2, 1],
    ppf: [0, 1, 2, 0, 1],
    tint: [1, 0, 2, 1, 0],
    business: [1, 2, 0, 1, 0],
  };
  const temporaryProgress = new Map();
  let persistent = true;

  function keyFor(trackId, lessonIndex) {
    return storagePrefix + trackId + '.' + lessonIndex;
  }

  function readCompletion(key) {
    if (temporaryProgress.has(key)) return temporaryProgress.get(key);
    try {
      const storedDate = window.localStorage.getItem(key);
      return Number.isFinite(Date.parse(storedDate)) ? storedDate : null;
    } catch {
      persistent = false;
      return null;
    }
  }

  function snapshot() {
    const progress = {};
    const certificates = [];
    for (const track of learnTracks) {
      const dates = track.lessons.map((_, index) => readCompletion(keyFor(track.id, index)));
      const completed = dates.flatMap((date, index) => date ? [index] : []);
      progress[track.id] = completed;
      if (completed.length === track.lessons.length && completed.length > 0) {
        certificates.push({
          track: track.id,
          date: dates.sort().at(-1),
          id: 'FRX-DEMO-' + track.id.toUpperCase(),
        });
      }
    }
    return { progress, certificates };
  }

  function complete(trackId, lessonIndex, answer) {
    const track = learnTracks.find(item => item.id === trackId);
    if (!track || !Number.isInteger(lessonIndex) || !track.lessons[lessonIndex]) {
      throw new Error('Урок не найден.');
    }
    const earlierLessons = track.lessons.slice(0, lessonIndex);
    if (earlierLessons.some((_, index) => !readCompletion(keyFor(track.id, index)))) {
      throw new Error('Сначала завершите предыдущие этапы.');
    }
    if (answer !== practiceAnswers[track.id][lessonIndex]) {
      throw new Error('Ответ пока неверный. Вернитесь к материалу и попробуйте ещё раз.');
    }
    const key = keyFor(track.id, lessonIndex);
    if (!readCompletion(key)) {
      const date = new Date().toISOString();
      try {
        window.localStorage.setItem(key, date);
      } catch {
        persistent = false;
        temporaryProgress.set(key, date);
      }
    }
    return snapshot();
  }

  return {
    snapshot,
    complete,
    isPersistent: () => persistent,
    ownsStorageKey: key => key === null || key.startsWith(storagePrefix),
  };
})();
