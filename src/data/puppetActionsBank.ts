export interface PuppetActionItem {
  id: string;
  action: string;
}

export const PUPPET_ACTIONS_BANK: PuppetActionItem[] = [
  { id: 'pa_01', action: 'عزف عود وسلطنة' },
  { id: 'pa_02', action: 'يشوت كورة بلنتي بالمرمى' },
  { id: 'pa_03', action: 'تغيير كفر سيارة مبنشر' },
  { id: 'pa_04', action: 'صيد سمك بالصنارة وسحبها' },
  { id: 'pa_05', action: 'حلاقة دقن بالموس قدام المراية' },
  { id: 'pa_06', action: 'تصوير سيلفي مع خيل' },
  { id: 'pa_07', action: 'رمي رمح أولمبي' },
  { id: 'pa_08', action: 'ركوب خيل في سباق' },
  { id: 'pa_09', action: 'صب قهوة عربية بالدلة والفنجال' },
  { id: 'pa_10', action: 'تركيب لمبة سقف محروقة' },
  { id: 'pa_11', action: 'تفتيش في نقطة مرور' },
  { id: 'pa_12', action: 'سحب حبل في لعبة شد الحبل' },
  { id: 'pa_13', action: 'ضرب مسمار بالشاكوش على خشب' },
  { id: 'pa_14', action: 'نفخ كورة هواء بالفم' },
  { id: 'pa_15', action: 'توجيه طيارة على المدرج بالإشارات' },
  { id: 'pa_16', action: 'كي ثوب رسمي بالكواية' },
  { id: 'pa_17', action: 'حفر حفرة بالمجرفة' },
  { id: 'pa_18', action: 'مضاربة بوكسات في حلبة ملاكمة' },
  { id: 'pa_19', action: 'تسلق جبل بالحبل' },
  { id: 'pa_20', action: 'تقطيع بصل مع دموع وصياح' }
];

export const getRandomPuppetAction = (usedIds: Set<string> = new Set()): PuppetActionItem => {
  const pool = PUPPET_ACTIONS_BANK.filter((item) => !usedIds.has(item.id));
  if (pool.length === 0) {
    return PUPPET_ACTIONS_BANK[Math.floor(Math.random() * PUPPET_ACTIONS_BANK.length)];
  }
  return pool[Math.floor(Math.random() * pool.length)];
};
