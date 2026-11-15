const adjectives = ['Amber', 'Quiet', 'Bright', 'Hidden', 'Gentle', 'Swift'];
const animals = ['Moth', 'Otter', 'Robin', 'Panda', 'Heron', 'Fox'];

export function makePseudonym(random: () => number = Math.random) {
  const adjective = adjectives[Math.floor(random() * adjectives.length)] ?? 'Quiet';
  const animal = animals[Math.floor(random() * animals.length)] ?? 'Moth';
  const number = Math.floor(1000 + random() * 9000);
  return `${adjective} ${animal} ${number}`;
}
