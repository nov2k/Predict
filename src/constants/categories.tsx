import type { ReactNode } from 'react';
import {
  Gavel,
  Bitcoin,
  Coins,
  Trophy,
  Cpu,
  Globe,
  Cloud,
  BarChart3,
  Vote,
  Music,
} from 'lucide-react';

/** Translation slice needed for category labels */
export type CategoryTranslations = {
  catPolitics: string;
  catCrypto: string;
  catFinance: string;
  catSports: string;
  catTech: string;
  catWorld: string;
  catScience: string;
  catEconomy: string;
  catElections: string;
  catCulture: string;
};

export type CategoryItem = { id: string; name: string; icon: ReactNode; search: string };

export function getCategories(t: CategoryTranslations): CategoryItem[] {
  return [
    { id: 'politics', name: t.catPolitics, icon: <Gavel size={18} />, search: 'politics president election trump' },
    { id: 'crypto', name: t.catCrypto, icon: <Bitcoin size={18} />, search: 'crypto bitcoin ethereum btc eth' },
    { id: 'finance', name: t.catFinance, icon: <Coins size={18} />, search: 'finance stock market fed interest rate' },
    { id: 'sports', name: t.catSports, icon: <Trophy size={18} />, search: 'sports nba nfl soccer ufc' },
    { id: 'tech', name: t.catTech, icon: <Cpu size={18} />, search: 'tech ai openai google apple' },
    { id: 'world', name: t.catWorld, icon: <Globe size={18} />, search: 'war ukraine russia china iran israel' },
    { id: 'climate', name: t.catScience, icon: <Cloud size={18} />, search: 'climate weather science nasa' },
    { id: 'economy', name: t.catEconomy, icon: <BarChart3 size={18} />, search: 'economy gdp inflation recession' },
    { id: 'elections', name: t.catElections, icon: <Vote size={18} />, search: 'election vote poll midterm' },
    { id: 'culture', name: t.catCulture, icon: <Music size={18} />, search: 'culture oscar grammy movie music' },
  ];
}

export function getProposalCategoryOptions(t: CategoryTranslations): { value: string; label: string }[] {
  return [
    { value: 'crypto', label: t.catCrypto },
    { value: 'sports', label: t.catSports },
    { value: 'politics', label: t.catPolitics },
    { value: 'tech', label: t.catTech },
    { value: 'science', label: t.catScience },
  ];
}
