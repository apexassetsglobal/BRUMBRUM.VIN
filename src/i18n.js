import {lookupFeatureTranslation} from '../public/assets/service-language.js';
import cs from '../public/assets/locales/cs.js';
import sk from '../public/assets/locales/sk.js';
import de from '../public/assets/locales/de.js';
import uk from '../public/assets/locales/uk.js';

export const languages = Object.freeze({pl:'Polski',en:'English',cs:'Čeština',sk:'Slovenčina',de:'Deutsch',uk:'Українська'});
const locales = {pl:'pl-PL',en:'en-GB',cs:'cs-CZ',sk:'sk-SK',de:'de-DE',uk:'uk-UA'};
const messages = {cs,sk,de,uk};

export function languageCode(value) {
  return typeof value==='string' && Object.hasOwn(languages,value) ? value : null;
}

export const formatLocale = language => locales[languageCode(language)||'pl'];

export function translator(language) {
  const table=Object.hasOwn(messages,language)?messages[language]:null;
  return (pl,en,values)=>{
    const message=language==='pl'?pl:table&&Object.hasOwn(table,en)?table[en]:lookupFeatureTranslation(language,en)??en??pl;
    return values?message.replace(/\{(\w+)\}/g,(match,key)=>Object.hasOwn(values,key)?String(values[key]):match):message;
  };
}
