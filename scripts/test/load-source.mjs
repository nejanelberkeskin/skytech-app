// Isolated source execution: every external dependency must be supplied explicitly.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
export function loadSource(file,mocks={}) {
 const source=readFileSync(new URL('../../'+file,import.meta.url),'utf8');
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const mod={exports:{}};
 new Function('require','module','exports',js)((name)=>{
   if(name in mocks)return mocks[name];
   if(name==='node:crypto')return require(name);
   throw new Error('Unmocked dependency: '+name);
 },mod,mod.exports);
 return mod.exports;
}
