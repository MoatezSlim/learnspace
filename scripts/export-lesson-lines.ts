import { writeFileSync } from 'node:fs';
import { allLessonLines } from '../src/assistant/lessonVoices';
const lines = allLessonLines();
writeFileSync(process.argv[2] ?? 'lesson-lines.json', JSON.stringify(lines, null, 1));
console.log('lesson lines', lines.length);
