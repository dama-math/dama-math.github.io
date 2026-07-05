import { Generator } from '@jspm/generator';

const generator = new Generator({
  mapUrl: import.meta.url,
  env: ['browser', 'module']
});

await generator.install('@codemirror/state@6');
await generator.install('@codemirror/view@6');
await generator.install('@codemirror/commands@6');
await generator.install('@codemirror/search@6');
await generator.install('@codemirror/language@6');
await generator.install('@codemirror/autocomplete@6');
await generator.install('@codemirror/lang-markdown@6');
await generator.install('@codemirror/theme-one-dark@6');
await generator.install('@codemirror/legacy-modes@6/mode/stex');

const map = generator.getMap();
console.log(JSON.stringify(map, null, 2));
