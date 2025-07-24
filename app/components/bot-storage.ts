/**
 * Tiny Firestore helper layer so `autonomous-bots.ts` can stay readable.
 * Only the calls actually used by the bot system are exposed.
 */

import {
    collection, doc, getDoc, getDocs, setDoc, updateDoc,
    query, where, limit, addDoc, Timestamp, onSnapshot,
    writeBatch
  } from 'firebase/firestore';
  import { db } from '../lib/firebase';
  import type {
    BotProfile
  } from './autonomous-bots';
  
  // ----------  BOT PROFILES  ----------
  
  export async function loadBots(): Promise<BotProfile[]> {
    const snap = await getDocs(collection(db,'autonomous-bots'));
    return snap.docs.map(d => ({ id:d.id, ...d.data() } as BotProfile));
  }
  
  export async function createBot(bot: BotProfile){
    await setDoc(doc(db,'autonomous-bots',bot.id),bot);
  }
  
  export async function saveBotPatch(id:string,patch:Partial<BotProfile>){
    await updateDoc(doc(db,'autonomous-bots',id),patch);
  }
  
  // ----------  TRANSACTIONS  ----------
  
  export function streamBotTransactions(cb:(tx:any)=>void){
    return onSnapshot(query(collection(db,'bot-transactions'), limit(50)), snap=>{
      snap.docChanges().forEach(c => cb({ id:c.doc.id, ...c.doc.data() }));
    });
  }
  
  export async function saveBotTransaction(tx:any){
    await addDoc(collection(db,'bot-transactions'),{
      ...tx,
      createdAt: Timestamp.now()
    });
  }
  
  // ----------  OPINIONS  ----------
  
  export async function loadOpinions(){
    const snap = await getDocs(collection(db,'opinions'));
    return snap.docs.map(d => ({ id:d.id, ...d.data() }));
  }
  
  // ----------  SHORTS / BETS  ----------
  
  export function streamShorts(cb:(s:any)=>void){
    return onSnapshot(collection(db,'short-positions'), snap=>{
      snap.docChanges().forEach(c=>cb(c.doc.data()));
    });
  }
  
  export async function saveShortPatch(id:string,patch:any){
    await updateDoc(doc(db,'short-positions',id),patch);
  }
  
  export async function saveAdvancedBet(bet:any){
    await addDoc(collection(db,'advanced-bets'),bet);
  }
  