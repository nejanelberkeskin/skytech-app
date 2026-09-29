import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadSource as load} from './load-source.mjs';
const {requestChanges,safeMapLink,requestAccessKey}=load('components/admin/requests/view.ts');
test('request patch sends only changed fields',()=>{
 const item={id:'one',status:'new',adminNote:'previous'};
 assert.deepEqual(requestChanges(item,'contacted','previous'),{id:'one',status:'contacted'});
 assert.deepEqual(requestChanges(item,'new','new note'),{id:'one',adminNote:'new note'});
 assert.deepEqual(requestChanges(item,'new',''),{id:'one',adminNote:''});
 assert.deepEqual(requestChanges({...item,adminNote:null},'new',''),{id:'one'});
});
test('map links reject script, credential and relative URLs',()=>{
 for(const url of ['javascript:alert(1)','data:text/html,hi','https://person:secret@example.com','/local',null])assert.equal(safeMapLink(url),null);
 assert.equal(safeMapLink('https://maps.example.invalid/?q=37,31'),'https://maps.example.invalid/?q=37,31');
});
test('permission changes reset state but polling preserves drafts',()=>{
 const me={admin:{userId:'u',isActive:true},permissions:[{key:'requests.read',scopes:[{kind:'all'}]}],checkedAt:'a'};
 assert.equal(requestAccessKey(me),requestAccessKey({...me,checkedAt:'b'}));
 assert.notEqual(requestAccessKey(me),requestAccessKey({...me,permissions:[]}));
 assert.notEqual(requestAccessKey(me),requestAccessKey({...me,admin:{...me.admin,isActive:false}}));
});
